import { t } from '../i18n/index.ts';
import type { CameraSource, QueueCamera, QueueRegion } from './types.ts';

export interface Frame {
	date: string;
	time: string;
}

type Panomax = Extract<CameraSource, { kind: 'panomax' }>;
type Still = Extract<CameraSource, { kind: 'still' }>;

export interface Picture {
	frame: Frame;
	crop(region: QueueRegion, signal?: AbortSignal): Promise<OffscreenCanvas>;
	sources(region: QueueRegion): string[];
}

interface RecentDayResponse {
	panodate?: string;
	imagetimes?: string[];
	images?: { time?: string; image_available?: boolean }[];
}

const PANOMAX_RECENT_DAY_URL =
	'https://delivery.panomax.com/interfaces/json/PanoAction.GetRecentDay';
const DIRECT_FERATEL_HEAD_REQUEST_ATTEMPTS = 4;
const PROXIED_HEAD_REQUEST_ATTEMPTS = 1;

async function panomaxFrames(
	source: Panomax,
	count: number,
	signal?: AbortSignal
): Promise<Frame[]> {
	try {
		const res = await fetch(PANOMAX_RECENT_DAY_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ camId: source.panomaxId }),
			signal
		});
		if (!res.ok) return [];
		const data = (await res.json()) as RecentDayResponse;
		if (!data?.panodate) return [];
		const times = Array.isArray(data.images)
			? data.images
					.filter((i) => i?.time && i.image_available !== false)
					.map((i) => i.time as string)
			: [];
		const all = times.length ? times : (data.imagetimes ?? []);
		return all
			.slice(-count)
			.reverse()
			.map((time) => ({ date: data.panodate as string, time: time.slice(0, 5) }));
	} catch {
		return [];
	}
}

export function stillUrl(resort: string, cam: QueueCamera): string {
	const source = cam.source as Still;
	return source.proxy ? `/api/webcam/${resort}/${cam.camera}` : source.url;
}

const localParts = (timezone: string) =>
	new Intl.DateTimeFormat('en-CA', {
		timeZone: timezone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23'
	});

export function frameAt(when: Date, timezone: string): Frame {
	const parts = Object.fromEntries(
		localParts(timezone)
			.formatToParts(when)
			.map((p) => [p.type, p.value])
	);
	return {
		date: `${parts.year}-${parts.month}-${parts.day}`,
		time: `${parts.hour}:${parts.minute}`
	};
}

async function stillFrame(
	url: string,
	asks: number,
	timezone: string,
	signal?: AbortSignal
): Promise<Frame[]> {
	const answers = await Promise.all(
		Array.from({ length: asks }, async () => {
			try {
				const res = await fetch(url, { method: 'HEAD', cache: 'no-store', signal });
				const when = new Date((res.ok && res.headers.get('last-modified')) || '').getTime();
				return Number.isNaN(when) ? 0 : when;
			} catch {
				return 0;
			}
		})
	);
	const newest = Math.max(...answers);
	return newest ? [frameAt(new Date(newest), timezone)] : [];
}

export function recentFrames(
	resort: { id: string; timezone: string },
	cam: QueueCamera,
	count = 3,
	signal?: AbortSignal
): Promise<Frame[]> {
	if (cam.source.kind === 'panomax') {
		return panomaxFrames(cam.source, count, signal);
	}
	const headAttempts = cam.source.proxy
		? PROXIED_HEAD_REQUEST_ATTEMPTS
		: DIRECT_FERATEL_HEAD_REQUEST_ATTEMPTS;
	return stillFrame(stillUrl(resort.id, cam), headAttempts, resort.timezone, signal);
}

export function regionTiles(
	source: Panomax,
	region: QueueRegion,
	frame: Frame
): { url: string; dx: number; dy: number }[] {
	const [yyyy, mm, dd] = frame.date.split('-');
	const [hh, mi] = frame.time.split(':').map((p) => p.padStart(2, '0'));
	const [x0, y0, x1, y1] = region.box;
	const { width, height, cols, rows } = source.tile;

	const minCol = Math.max(0, Math.floor(x0 / width));
	const maxCol = Math.min(cols - 1, Math.floor((x1 - 1) / width));
	const minRow = Math.max(0, Math.floor(y0 / height));
	const maxRow = Math.min(rows - 1, Math.floor((y1 - 1) / height));

	const tiles: { url: string; dx: number; dy: number }[] = [];
	for (let row = minRow; row <= maxRow; row++) {
		for (let col = minCol; col <= maxCol; col++) {
			tiles.push({
				url: `https://panodata.panomax.com/cams/${source.panomaxId}/${yyyy}/${mm}/${dd}/${hh}-${mi}-00_${source.resolution}_${col}_${row}.jpg`,
				dx: col * width - x0,
				dy: row * height - y0
			});
		}
	}
	return tiles;
}

function blank(region: QueueRegion): {
	canvas: OffscreenCanvas;
	ctx: OffscreenCanvasRenderingContext2D;
} {
	const [x0, y0, x1, y1] = region.box;
	const canvas = new OffscreenCanvas(x1 - x0, y1 - y0);
	const ctx = canvas.getContext('2d', { willReadFrequently: true });
	if (!ctx) throw new Error(t.queues.error.cannotDrawOffscreen);
	return { canvas, ctx };
}

async function bitmap(url: string, signal?: AbortSignal): Promise<ImageBitmap> {
	const res = await fetch(url, { signal });
	if (!res.ok) throw new Error(`Webcam picture missing (${res.status}): ${url}`);
	return createImageBitmap(await res.blob());
}

export function openPicture(
	resort: { id: string; timezone: string },
	cam: QueueCamera,
	frame: Frame
): Picture {
	const source = cam.source;
	if (source.kind === 'panomax') {
		return {
			frame,
			async crop(region, signal) {
				const { canvas, ctx } = blank(region);
				await Promise.all(
					regionTiles(source, region, frame).map(async (tile) => {
						const image = await bitmap(tile.url, signal);
						ctx.drawImage(image, tile.dx, tile.dy);
						image.close();
					})
				);
				return canvas;
			},
			sources: (region) => regionTiles(source, region, frame).map((t) => t.url)
		};
	}

	const url = stillUrl(resort.id, cam);
	let whole: Promise<ImageBitmap> | null = null;
	const picture: Picture = {
		frame,
		async crop(region, signal) {
			whole ??= (async () => {
				const res = await fetch(url, { signal, cache: 'no-store' });
				if (!res.ok) throw new Error(`Webcam picture missing (${res.status}): ${url}`);
				const when = new Date(res.headers.get('last-modified') ?? '');
				const modified = Number.isNaN(when.getTime())
					? picture.frame
					: frameAt(when, resort.timezone);
				if (`${modified.date} ${modified.time}` > `${picture.frame.date} ${picture.frame.time}`)
					picture.frame = modified;
				return createImageBitmap(await res.blob());
			})();
			const image = await whole.catch((err) => {
				whole = null;
				throw err;
			});
			const { canvas, ctx } = blank(region);
			ctx.drawImage(image, -region.box[0], -region.box[1]);
			return canvas;
		},
		sources: () => [source.url]
	};
	return picture;
}

export function viewerUrl(cam: QueueCamera, frame: Frame): string {
	if (cam.source.kind !== 'panomax') return cam.pageUrl;
	const url = new URL(cam.pageUrl);
	url.searchParams.set('t', `${frame.date} ${frame.time.replace(':', '-')}-00`);
	return url.href;
}
