import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import type { CameraSource, QueueCamera, QueueRegion } from '../src/lib/queues/types.ts';
import type { ResortData } from '../src/lib/resort/types.ts';
import { syncCatalogFiles } from './catalog-files.ts';
import { resortIdFromArgs } from './resorts.ts';

interface RawCamera {
	camera: string;
	skip?: string;
	name?: string;
	pageUrl?: string;
	source:
		| Extract<CameraSource, { kind: 'panomax' }>
		| {
				kind: 'still';
				width: number;
				height: number;
				rotates?: boolean;
				url?: string;
				proxy?: boolean;
		  };
	regions: {
		id: string;
		lift: string | null;
		liftOsm?: string;
		label: string;
		box: [number, number, number, number];
		upscale: number;
		blur?: number;
	}[];
}

interface CameraInfo {
	name: string;
	pageUrl: string;
	imageUrl?: string;
	cors?: string;
}

const id = resortIdFromArgs();
const queuesPath = `data/webcams/${id}-queues.json`;
const contribPath = `data/webcams/contrib/${id}-queues.json`;
if (!existsSync(queuesPath) && !existsSync(contribPath)) {
	console.log(`No webcam queues for ${id} (${queuesPath} not found), skipping.`);
	process.exit(0);
}
const readList = <T>(path: string): T[] =>
	existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : [];
const resort = JSON.parse(readFileSync(`static/data/${id}.json`, 'utf8')) as ResortData;
const handCheckedQueueCameras = readList<RawCamera>(queuesPath);
const contributedQueueCameras = readList<RawCamera>(contribPath);
const knownWebcams = readList<{
	id: string;
	name: string;
	pageUrl: string;
	imageUrl: string;
	cors: string;
}>(`data/webcams/${id}.json`);

function buildCamera(c: RawCamera, cam: CameraInfo, lenient: boolean): QueueCamera | undefined {
	if (!c.regions.length) return undefined;
	const [width, height] =
		c.source.kind === 'panomax'
			? [c.source.composite.width, c.source.composite.height]
			: [c.source.width, c.source.height];
	const source: CameraSource =
		c.source.kind === 'panomax'
			? c.source
			: {
					kind: 'still',
					url: c.source.url ?? (cam.imageUrl as string),
					width,
					height,
					proxy: c.source.proxy ?? cam.cors !== '*',
					rotates: c.source.rotates ?? false
				};
	const ids = new Set<string>();
	const regions: QueueRegion[] = [];
	for (const r of c.regions) {
		try {
			const [x0, y0, x1, y1] = r.box;
			const isBoxWithinImageBounds =
				x0 >= 0 && y0 >= 0 && x1 > x0 && y1 > y0 && x1 <= width && y1 <= height;
			if (!isBoxWithinImageBounds)
				throw new Error(`Region ${c.camera}:${r.id} lies outside the ${width}×${height} picture`);
			if (ids.has(r.id)) throw new Error(`Two regions called ${c.camera}:${r.id}`);
			ids.add(r.id);
			const osmWayId = r.liftOsm?.match(/^way\/(\d+)$/)?.[1];
			const liftByOsmWay = osmWayId ? resort.lifts.find((l) => l.id === `l${osmWayId}`) : undefined;
			const liftByName = r.lift === null ? undefined : resort.lifts.find((l) => l.name === r.lift);
			const lift = liftByOsmWay ?? liftByName;
			if ((r.lift !== null || osmWayId) && !lift) {
				if (!lenient) throw new Error(`No lift named "${r.lift}" in ${id}`);
				console.warn(
					`  ${c.camera}:${r.id}: no lift ${r.liftOsm ?? r.lift} in ${id}, kept as another place`
				);
			}
			regions.push({
				id: `${c.camera}:${r.id}`,
				liftId: lift?.id,
				label: r.label,
				box: r.box,
				upscale: r.upscale,
				...(r.blur != null ? { blur: r.blur } : {})
			});
		} catch (err) {
			if (!lenient) throw err;
			console.warn(`  skipped region: ${err instanceof Error ? err.message : err}`);
		}
	}
	return regions.length
		? { camera: c.camera, name: cam.name, pageUrl: cam.pageUrl, source, regions }
		: undefined;
}

const outputQueueCameras: QueueCamera[] = [];
for (const c of handCheckedQueueCameras) {
	const cam = knownWebcams.find((x) => x.id === c.camera);
	if (!cam) throw new Error(`No webcam "${c.camera}" in data/webcams/${id}.json`);
	const built = buildCamera(c, cam, false);
	if (built) outputQueueCameras.push(built);
}

const normalizePageUrl = (url: string) => url.replace(/\/+$/, '');
const handMadePages = new Set(
	handCheckedQueueCameras
		.flatMap((c) => knownWebcams.find((x) => x.id === c.camera)?.pageUrl ?? [])
		.map(normalizePageUrl)
);
let contributedUsed = 0;
for (const c of contributedQueueCameras) {
	const isCoveredByHandCheckedCamera =
		handCheckedQueueCameras.some((h) => h.camera === c.camera) ||
		(c.pageUrl && handMadePages.has(normalizePageUrl(c.pageUrl)));
	if (isCoveredByHandCheckedCamera) {
		console.log(`  contributed ${c.camera}: not used, a hand-made camera covers it`);
		continue;
	}
	if (!c.name || !c.pageUrl) {
		console.warn(`  contributed ${c.camera}: skipped, it has no name or pageUrl`);
		continue;
	}
	if (c.source.kind === 'still' && !c.source.url) {
		console.warn(`  contributed ${c.camera}: skipped, its still has no url`);
		continue;
	}
	const built = buildCamera(c, { name: c.name, pageUrl: c.pageUrl }, true);
	if (built) {
		outputQueueCameras.push(built);
		contributedUsed++;
	}
}

if (!outputQueueCameras.length) {
	rmSync(`static/data/${id}-queues.json`, { force: true });
	console.log(`static/data/${id}-queues.json: no camera with regions, removed`);
	for (const c of handCheckedQueueCameras.filter((c) => !c.regions.length))
		console.log(`  skipped ${c.camera}: ${c.skip ?? 'no regions'}`);
	syncCatalogFiles(id);
	process.exit(0);
}
writeFileSync(`static/data/${id}-queues.json`, JSON.stringify(outputQueueCameras));
syncCatalogFiles(id);
const regions = outputQueueCameras.flatMap((c) => c.regions);
const lifts = new Set(regions.flatMap((r) => (r.liftId ? [r.liftId] : [])));
console.log(
	`static/data/${id}-queues.json: ${outputQueueCameras.length} of ${knownWebcams.length + contributedUsed} cameras, ${regions.length} regions ` +
		`(${lifts.size} lifts, ${regions.filter((r) => !r.liftId).length} other places)` +
		(contributedUsed ? `, ${contributedUsed} contributed cameras` : '')
);
for (const c of handCheckedQueueCameras.filter((c) => !c.regions.length))
	console.log(`  skipped ${c.camera}: ${c.skip ?? 'no regions'}`);
const missing = knownWebcams.filter(
	(cam) => !handCheckedQueueCameras.some((c) => c.camera === cam.id)
);
if (missing.length) console.log(`  not surveyed: ${missing.map((c) => c.id).join(', ')}`);
