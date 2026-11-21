import { t } from '../i18n/index.ts';
import type { Detector } from './detect.ts';
import { openPicture, recentFrames, type Frame } from './pictures.ts';
import type { CameraSource, QueueCamera, QueueRegion } from './types.ts';

export interface Suggestion {
	box: [number, number, number, number];
	upscale: number;
	people: number;
	frames: number;
}

interface Seen {
	x: number;
	y: number;
	h: number;
	top: number;
	frame: number;
}

const PANORAMA_STRIP_WIDTH_PX = 2048;
const PANORAMA_STRIP_OVERLAP_PX = 160;
const SMALL_PERSON_HEIGHT_THRESHOLD_PX = 40;
const MAX_SUGGESTION_COUNT = 8;
const DEFAULT_ANALYSIS_FRAME_COUNT = 5;
const MAX_PANOMAX_CANDIDATE_FRAMES = 200;

function spread(frames: Frame[], count: number): Frame[] {
	const day = frames.filter((f) => f.time >= '09:00' && f.time <= '16:00');
	const pool = (day.length >= count ? day : frames)
		.slice()
		.sort((a, b) => a.time.localeCompare(b.time));
	if (pool.length <= count) return pool;
	return Array.from(
		{ length: count },
		(_, i) => pool[Math.round((i * (pool.length - 1)) / (count - 1))]
	);
}

async function peopleIn(
	resort: { id: string; timezone: string },
	cam: QueueCamera,
	frame: Frame,
	size: { width: number; height: number },
	detector: Detector,
	signal?: AbortSignal
): Promise<Omit<Seen, 'frame'>[]> {
	const picture = openPicture(resort, cam, frame);
	const found: Omit<Seen, 'frame'>[] = [];
	for (let x0 = 0; x0 < size.width; x0 += PANORAMA_STRIP_WIDTH_PX - PANORAMA_STRIP_OVERLAP_PX) {
		const x1 = Math.min(size.width, x0 + PANORAMA_STRIP_WIDTH_PX);
		const strip: QueueRegion = {
			id: 'strip',
			label: 'strip',
			box: [x0, 0, x1, size.height],
			upscale: 1
		};
		const canvas = await picture.crop(strip, signal);
		for (const d of await detector.detect(canvas, 1)) {
			const x = x0 + d.x + d.w / 2;
			if (found.some((f) => Math.abs(f.x - x) < d.h / 2 && Math.abs(f.y - (d.y + d.h)) < d.h / 2))
				continue;
			found.push({ x, y: d.y + d.h, h: d.h, top: d.y });
		}
		if (x1 === size.width) break;
	}
	return found;
}

export async function suggestRegions(
	resort: { id: string; timezone: string },
	source: CameraSource,
	detector: Detector,
	options: {
		frames?: number;
		onProgress?: (done: number, total: number) => void;
		signal?: AbortSignal;
	} = {}
): Promise<Suggestion[]> {
	const cam: QueueCamera = { camera: 'suggest', name: '', pageUrl: '', source, regions: [] };
	const size =
		source.kind === 'panomax' ? source.composite : { width: source.width, height: source.height };
	const frames =
		source.kind === 'panomax'
			? spread(
					await recentFrames(resort, cam, MAX_PANOMAX_CANDIDATE_FRAMES, options.signal),
					options.frames ?? DEFAULT_ANALYSIS_FRAME_COUNT
				)
			: await recentFrames(resort, cam, 1, options.signal);
	if (!frames.length) throw new Error(t.queues.error.noPicturesToday);

	const seen: Seen[] = [];
	for (const [i, frame] of frames.entries()) {
		options.onProgress?.(i, frames.length);
		try {
			const people = await peopleIn(resort, cam, frame, size, detector, options.signal);
			seen.push(...people.map((p) => ({ ...p, frame: i })));
		} catch (err) {
			if (options.signal?.aborted) throw err;
		}
	}
	options.onProgress?.(frames.length, frames.length);
	return cluster(seen, frames.length, size);
}

function cluster(
	seen: Seen[],
	frameCount: number,
	size: { width: number; height: number }
): Suggestion[] {
	const parent = seen.map((_, i) => i);
	const root = (i: number): number => (parent[i] === i ? i : (parent[i] = root(parent[i])));
	for (let i = 0; i < seen.length; i++) {
		for (let j = i + 1; j < seen.length; j++) {
			const a = seen[i];
			const b = seen[j];
			const h = (a.h + b.h) / 2;
			if (Math.abs(a.x - b.x) < 2.5 * h && Math.abs(a.y - b.y) < 1.2 * h) parent[root(i)] = root(j);
		}
	}
	const groups = new Map<number, Seen[]>();
	seen.forEach((s, i) => groups.set(root(i), [...(groups.get(root(i)) ?? []), s]));

	const needFrames = Math.min(2, frameCount);
	const out: Suggestion[] = [];
	for (const group of groups.values()) {
		const frames = new Set(group.map((s) => s.frame)).size;
		if (frames < needFrames || group.length < 3) continue;
		const h = group.reduce((sum, s) => sum + s.h, 0) / group.length;
		const xs = group.map((s) => s.x);
		const ys = group.map((s) => s.y);
		const isStationaryObjectFalsePositive =
			Math.max(...xs) - Math.min(...xs) < h / 2 && Math.max(...ys) - Math.min(...ys) < h / 3;
		const persistsAcrossMostFrames = frameCount >= 3 && frames >= Math.ceil(frameCount * 0.75);
		if (persistsAcrossMostFrames && isStationaryObjectFalsePositive) continue;
		const x0 = Math.max(0, Math.round(Math.min(...xs) - 1.5 * h));
		const x1 = Math.min(size.width, Math.round(Math.max(...xs) + 1.5 * h));
		const y0 = Math.max(0, Math.round(Math.min(...group.map((s) => s.top)) - 0.5 * h));
		const y1 = Math.min(size.height, Math.round(Math.max(...ys) + 0.5 * h));
		const upscale = h < SMALL_PERSON_HEIGHT_THRESHOLD_PX ? 2 : 1;
		out.push({ box: [x0, y0, x1, y1], upscale, people: group.length, frames });
	}
	return out
		.sort((a, b) => b.frames - a.frames || b.people - a.people)
		.slice(0, MAX_SUGGESTION_COUNT);
}
