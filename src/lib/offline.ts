import { asset } from '$app/paths';
import { t } from '#lib/i18n/index.ts';
import { BASEMAP_TILEJSON, DEM_MAXZOOM, DEM_TILES, GLYPHS } from './map/style.ts';
import { MAX_OFM_TILES } from './offline-config.ts';
import type { ResortData } from './resort/types.ts';
import { catalogResort } from './state/catalog.ts';

const BASE_MAXZOOM = 14;
const MINZOOM = 9;
const FONTS = ['Noto Sans Regular', 'Noto Sans Bold', 'Noto Sans Italic'];
const LAT_MARGIN_DEG = 0.03;
const LON_MARGIN_DEG = 0.045;
const NEIGHBOUR_RING_TILES = 1;

function tileRange(bbox: ResortData['bbox'], z: number) {
	const n = 2 ** z;
	const x = (lon: number) => Math.floor(((lon + 180) / 360) * n);
	const y = (lat: number) => {
		const r = (lat * Math.PI) / 180;
		return Math.floor(((1 - Math.asinh(Math.tan(r)) / Math.PI) / 2) * n);
	};
	return { x0: x(bbox[0]), x1: x(bbox[2]), y0: y(bbox[3]), y1: y(bbox[1]) };
}

function countOfmTiles(bbox: ResortData['bbox'], maxZoom: number): number {
	let count = 0;
	for (let z = MINZOOM; z <= maxZoom; z++) {
		const r = tileRange(bbox, z);
		count +=
			(r.x1 - r.x0 + 1 + 2 * NEIGHBOUR_RING_TILES) * (r.y1 - r.y0 + 1 + 2 * NEIGHBOUR_RING_TILES);
	}
	return count;
}

export async function offlineTileUrls(resort: ResortData): Promise<string[]> {
	const bbox: ResortData['bbox'] = [
		resort.bbox[0] - LON_MARGIN_DEG,
		resort.bbox[1] - LAT_MARGIN_DEG,
		resort.bbox[2] + LON_MARGIN_DEG,
		resort.bbox[3] + LAT_MARGIN_DEG
	];

	let effectiveMaxZoom = BASE_MAXZOOM;
	while (effectiveMaxZoom > MINZOOM && countOfmTiles(bbox, effectiveMaxZoom) > MAX_OFM_TILES) {
		effectiveMaxZoom--;
	}

	const tilejsonRes = await fetch(BASEMAP_TILEJSON);
	const tilejson = (await tilejsonRes.json()) as { tiles: string[] };
	const base = tilejson.tiles[0];
	const urls: string[] = [BASEMAP_TILEJSON];
	const fill = (template: string, z: number, x: number, y: number) =>
		template.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));

	for (let z = MINZOOM; z <= effectiveMaxZoom; z++) {
		const r = tileRange(bbox, z);
		for (let x = r.x0 - NEIGHBOUR_RING_TILES; x <= r.x1 + NEIGHBOUR_RING_TILES; x++) {
			for (let y = r.y0 - NEIGHBOUR_RING_TILES; y <= r.y1 + NEIGHBOUR_RING_TILES; y++) {
				urls.push(fill(base, z, x, y));
				if (z <= DEM_MAXZOOM) urls.push(fill(DEM_TILES, z, x, y));
			}
		}
	}
	for (const font of FONTS) {
		for (const range of ['0-255', '256-511']) {
			urls.push(GLYPHS.replace('{fontstack}', encodeURIComponent(font)).replace('{range}', range));
		}
	}
	return urls;
}

export interface DownloadProgress {
	done: number;
	total: number;
	failed: number;
}

export async function downloadOffline(
	resort: ResortData,
	onProgress: (p: DownloadProgress) => void
): Promise<DownloadProgress> {
	if (!('serviceWorker' in navigator)) throw new Error(t.offline.needServiceWorker);
	const registration = await navigator.serviceWorker.ready;
	const worker = registration.active;
	if (!worker) throw new Error(t.offline.appInstalling);

	const tileUrls = await offlineTileUrls(resort);
	const entry = await catalogResort(resort.id);
	const hasQueues = entry?.cams === true;
	const hasWebcams = Boolean(entry?.webcams);
	const dataUrls = [
		asset('data/resorts.json' as never),
		asset(`data/${resort.id}.json` as never),
		asset(`data/${resort.id}-terrain.json` as never),
		...(hasQueues ? [asset(`data/${resort.id}-queues.json` as never)] : []),
		...(hasWebcams ? [asset(`data/${resort.id}-webcams.json` as never)] : []),
		`/api/weather/${resort.id}`
	];
	const urls = [...dataUrls, ...tileUrls];

	return new Promise((resolve) => {
		const onMessage = (event: MessageEvent) => {
			const data = event.data as ({ type?: string; id?: string } & DownloadProgress) | undefined;
			if (data?.type !== 'download-progress' || data?.id !== resort.id) return;
			onProgress(data);
			if (data.done >= data.total) {
				navigator.serviceWorker.removeEventListener('message', onMessage);
				resolve(data);
			}
		};
		navigator.serviceWorker.addEventListener('message', onMessage);
		worker.postMessage({ type: 'download-tiles', id: resort.id, urls });
	});
}

export async function forgetOffline(id: string): Promise<void> {
	if (!('serviceWorker' in navigator)) return;
	const registration = await navigator.serviceWorker.ready;
	registration.active?.postMessage({ type: 'forget-resort', id });
}
