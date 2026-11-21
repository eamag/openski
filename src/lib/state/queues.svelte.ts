import { get, set } from 'idb-keyval';
import { asset } from '$app/paths';
import { readStored, readStoredJson, writeStored } from '#lib/browser-storage.ts';
import { t } from '#lib/i18n/index.ts';
import type { Frame } from '#lib/queues/pictures.ts';
import type { ContributedCamera, Detection, QueueCamera, QueueRegion } from '#lib/queues/types.ts';
import { waitSeconds } from '#lib/queues/wait.ts';
import { app } from './app.svelte.ts';
import { catalogResort } from './catalog.ts';

export interface QueueReading {
	regionId: string;
	liftId?: string;
	camera: string;
	people: number;
	wait: number;
	frame: Frame;
	detections: Detection[];
	size: [number, number];
	sources: string[];
}

export const OPEN_FROM = '07:45';
export const OPEN_UNTIL = '16:45';
const OPT_IN = 'queues-enabled';
const SAVED = 'queues-last';
const CROPS = (resort: string) => `queue-crops:${resort}`;
const FRESH_FOR = 30 * 60_000;
const STALE_MINUTES = 60;
const PROOF_WIDTH = 1400;
const MODEL = 'models/yolo11n.onnx';

const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const round1 = (n: number) => Math.round(n * 10) / 10;

class QueueState {
	cameras = $state.raw<QueueCamera[]>([]);
	readings = $state.raw<Record<string, QueueReading>>({});
	crops = $state.raw<Record<string, string>>({});
	phase = $state<'idle' | 'looking' | 'model' | 'counting'>('idle');
	progress = $state(0);
	counted = $state(0);
	total = $state(0);
	error = $state<string | null>(null);
	failed = $state.raw<string[]>([]);
	closed = $state(false);
	checked = $state<number | null>(null);
	attempted = $state<number | null>(null);
	enabled = $state(false);

	private loadedFor: string | null = null;
	private loading: Promise<void> | null = null;

	reset(): void {
		this.readings = {};
		this.setCrops({});
		this.cameras = [];
		this.checked = null;
		this.attempted = null;
		this.error = null;
		this.failed = [];
		this.closed = false;
		this.counted = 0;
		this.total = 0;
		this.phase = 'idle';
		this.loadedFor = null;
		this.loading = null;
	}

	init(): Promise<void> {
		const resort = app.resort;
		if (!resort) return Promise.resolve();
		if (this.loadedFor !== resort.id) {
			this.loadedFor = resort.id;
			this.loading = this.load(resort.id);
		}
		return this.loading ?? Promise.resolve();
	}

	private async load(id: string): Promise<void> {
		this.readings = {};
		this.setCrops({});
		this.cameras = [];
		this.checked = null;
		this.error = null;
		this.failed = [];
		this.closed = false;
		this.enabled = readStored(OPT_IN) === '1';
		const saved = readStoredJson<{
			resort: string;
			checked: number;
			readings: Record<string, QueueReading>;
		} | null>(SAVED, null);
		const isSavedReadingUsable =
			saved?.resort === id &&
			Date.now() - saved.checked < FRESH_FOR &&
			Object.values(saved.readings ?? {}).every((r) => r.regionId && r.size);
		if (saved && isSavedReadingUsable) {
			this.readings = saved.readings;
			this.checked = saved.checked;
			const blobs = (await get<Record<string, Blob>>(CROPS(id)).catch(() => undefined)) ?? {};
			this.setCrops(Object.fromEntries(Object.entries(blobs).filter(([id]) => this.readings[id])));
		}
		const hasCams = (await catalogResort(id))?.cams === true;
		const [handMade, contributed] = await Promise.all([
			hasCams
				? fetch(asset(`data/${id}-queues.json` as never))
						.then((res) => (res.ok ? (res.json() as Promise<QueueCamera[]>) : []))
						.catch(() => [])
				: [],
			this.contributed(id)
		]);
		if (this.loadedFor !== id) return;
		const page = (url: string) => url.replace(/\/+$/, '');
		const pages = new Set(handMade.map((c) => page(c.pageUrl)));
		this.cameras = [...handMade, ...contributed.filter((c) => !pages.has(page(c.pageUrl)))];
	}

	private async contributed(id: string): Promise<QueueCamera[]> {
		let list: ContributedCamera[];
		try {
			const res = await fetch(`/api/contrib/queues/${id}`);
			if (!res.ok) return [];
			list = (await res.json()) as ContributedCamera[];
		} catch {
			return [];
		}
		const lifts = app.resort?.id === id ? app.resort.data.lifts : [];
		return list.flatMap((c) => {
			const regions = c.regions.map(({ liftOsm, liftName, ...r }): QueueRegion => {
				const way = liftOsm?.match(/^way\/(\d+)$/)?.[1];
				const lift =
					(way ? lifts.find((l) => l.id === `l${way}`) : undefined) ??
					(liftName ? lifts.find((l) => l.name === liftName) : undefined);
				return { ...r, ...(lift ? { liftId: lift.id } : {}) };
			});
			return regions.length ? [{ ...c, regions }] : [];
		});
	}

	private setCrops(blobs: Record<string, Blob>) {
		for (const url of Object.values(this.crops)) URL.revokeObjectURL(url);
		this.crops = Object.fromEntries(
			Object.entries(blobs).map(([id, blob]) => [id, URL.createObjectURL(blob)])
		);
	}

	private setCrop(id: string, blob: Blob) {
		if (this.crops[id]) URL.revokeObjectURL(this.crops[id]);
		this.crops = { ...this.crops, [id]: URL.createObjectURL(blob) };
	}

	covered = $derived(
		new Set(this.cameras.flatMap((c) => c.regions.flatMap((r) => (r.liftId ? [r.liftId] : []))))
	);

	byLift = $derived.by(() => {
		const out: Record<string, QueueReading> = {};
		for (const r of Object.values(this.readings)) {
			if (r.liftId && (!out[r.liftId] || r.people > out[r.liftId].people)) out[r.liftId] = r;
		}
		return out;
	});

	liftWait = $derived.by((): ((lift: number) => number | undefined) | undefined => {
		const resort = app.resort;
		const byLift = this.byLift;
		if (!resort || !Object.keys(byLift).length) return undefined;
		if (!this.checked || Date.now() - this.checked > FRESH_FOR) return undefined;
		return (lift) => {
			const r = byLift[resort.data.lifts[lift].id];
			return r ? Math.max(30, r.wait) : undefined;
		};
	});

	async check(at?: Frame): Promise<void> {
		const resort = app.resort;
		if (!resort || this.phase !== 'idle') return;
		if (!navigator.onLine) {
			this.error = t.queues.error.needsConnection;
			return;
		}
		this.phase = 'looking';
		await this.init();
		if (!this.cameras.length) {
			this.phase = 'idle';
			this.error = t.queues.error.noWebcamList;
			return;
		}
		this.attempted = Date.now();
		this.error = null;
		this.closed = false;
		this.enabled = true;
		writeStored(OPT_IN, '1');
		let detector: Awaited<ReturnType<typeof import('#lib/queues/detect.ts').loadDetector>> | null =
			null;
		try {
			const [{ recentFrames, openPicture, frameAt }, { loadDetector }] = await Promise.all([
				import('#lib/queues/pictures.ts'),
				import('#lib/queues/detect.ts')
			]);
			const place = { id: resort.id, timezone: resort.data.timezone };
			const cameras = [...this.cameras].sort(
				(a, b) => Number(b.regions.some((r) => r.liftId)) - Number(a.regions.some((r) => r.liftId))
			);

			const now = frameAt(new Date(), place.timezone);
			const current = (f: Frame) =>
				f.date === now.date && minutesOf(now.time) - minutesOf(f.time) <= STALE_MINUTES;
			const candidates = await Promise.all(
				cameras.map(async (cam) => {
					if (at) return cam.source.kind === 'panomax' ? [at] : [];
					return (await recentFrames(place, cam)).filter(current);
				})
			);
			if (!candidates.some((list) => list.length))
				throw new Error(t.queues.error.webcamsNotAnswering);
			if (
				!at &&
				candidates.every(
					(list) => !list.length || list[0].time < OPEN_FROM || list[0].time > OPEN_UNTIL
				)
			) {
				this.closed = true;
				this.readings = {};
				this.setCrops({});
				this.failed = [];
				this.checked = Date.now();
				return;
			}

			this.phase = 'model';
			this.progress = 0;
			detector = await loadDetector(asset(MODEL as never), (share) => (this.progress = share));
			this.counted = 0;
			this.total = cameras.reduce(
				(n, cam, i) => n + (candidates[i].length ? cam.regions.length : 0),
				0
			);
			this.phase = 'counting';

			const next: Record<string, QueueReading> = {};
			const blobs: Record<string, Blob> = {};
			const failed: string[] = [];
			for (const [i, cam] of cameras.entries()) {
				let pictures = candidates[i].map((frame) => openPicture(place, cam, frame));
				let seen = 0;
				for (const region of cam.regions) {
					for (const picture of pictures) {
						try {
							const image = await picture.crop(region);
							const detections = await detector.detect(image, region.upscale, region.blur);
							const lift = region.liftId
								? resort.data.lifts.find((l) => l.id === region.liftId)
								: undefined;
							next[region.id] = {
								regionId: region.id,
								liftId: lift?.id,
								camera: cam.camera,
								people: detections.length,
								wait: lift ? waitSeconds(lift, detections.length) : 0,
								frame: picture.frame,
								detections: detections.map((d) => ({
									x: round1(d.x),
									y: round1(d.y),
									w: round1(d.w),
									h: round1(d.h),
									score: Math.round(d.score * 100) / 100
								})),
								size: [image.width, image.height],
								sources: picture.sources(region)
							};
							blobs[region.id] = await proofBlob(image);
							this.setCrop(region.id, blobs[region.id]);
							this.readings = { ...this.readings, ...next };
							pictures = [picture];
							seen++;
							break;
						} catch {
							continue;
						}
					}
					if (candidates[i].length) this.counted++;
				}
				if (!seen) failed.push(cam.camera);
			}
			if (!Object.keys(next).length) throw new Error(t.queues.error.noWebcamImages);
			this.readings = next;
			for (const id of Object.keys(this.crops)) {
				if (!next[id]) URL.revokeObjectURL(this.crops[id]);
			}
			this.crops = Object.fromEntries(Object.entries(this.crops).filter(([id]) => next[id]));
			this.failed = failed;
			if (failed.length)
				this.error = t.queues.error.camerasFailed(failed.length, cameras.length, Boolean(at));
			this.checked = Date.now();
			writeStored(
				SAVED,
				JSON.stringify({ resort: resort.id, checked: this.checked, readings: next })
			);
			void set(CROPS(resort.id), blobs).catch(() => undefined);
		} catch (err) {
			this.error = (err as Error).message || t.queues.error.checkFailed;
		} finally {
			this.phase = 'idle';
			void detector?.release();
		}
	}

	afterHours(): boolean {
		const zone = app.resort?.data.timezone;
		try {
			const now = new Intl.DateTimeFormat('en-GB', {
				hour: '2-digit',
				minute: '2-digit',
				hourCycle: 'h23',
				timeZone: zone || undefined
			}).format(new Date());
			return now < OPEN_FROM || now > OPEN_UNTIL;
		} catch {
			return false;
		}
	}

	camera(id: string): QueueCamera | undefined {
		return this.cameras.find((c) => c.camera === id);
	}

	region(id: string): QueueRegion | undefined {
		for (const cam of this.cameras) {
			const region = cam.regions.find((r) => r.id === id);
			if (region) return region;
		}
		return undefined;
	}
}

async function proofBlob(image: OffscreenCanvas): Promise<Blob> {
	if (image.width <= PROOF_WIDTH) return image.convertToBlob({ type: 'image/jpeg', quality: 0.82 });
	const scale = PROOF_WIDTH / image.width;
	const small = new OffscreenCanvas(PROOF_WIDTH, Math.round(image.height * scale));
	const ctx = small.getContext('2d');
	if (!ctx) throw new Error(t.queues.error.cannotDrawOffscreen);
	ctx.imageSmoothingQuality = 'high';
	ctx.drawImage(image, 0, 0, small.width, small.height);
	return small.convertToBlob({ type: 'image/jpeg', quality: 0.82 });
}

export const queues = new QueueState();
