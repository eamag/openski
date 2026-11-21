import { asset } from '$app/paths';
import type { Catalog, CatalogResort } from '#lib/resort/catalog.ts';

let cache: CatalogResort[] | null = null;
let pending: Promise<CatalogResort[] | null> | null = null;

export function loadCatalog(): Promise<CatalogResort[] | null> {
	if (cache) return Promise.resolve(cache);
	if (!pending) {
		pending = fetch(asset('data/resorts.json' as never))
			.then(async (res) => {
				if (!res.ok) throw new Error(`The ski area list answered ${res.status}`);
				const catalog = (await res.json()) as Catalog;
				cache = catalog.resorts;
				return cache;
			})
			.catch(() => {
				pending = null;
				return null;
			});
	}
	return pending;
}

export async function catalogResort(id: string): Promise<CatalogResort | undefined> {
	const resorts = await loadCatalog();
	return resorts?.find((r) => r.id === id);
}

export function catalogResortSync(id: string): CatalogResort | undefined {
	return cache?.find((r) => r.id === id);
}

const KM_PER_LATITUDE_DEGREE = 110.57;
const KM_PER_LONGITUDE_DEGREE_EQUATOR = 111.32;
const DEG_TO_RAD = Math.PI / 180;

export function kmToResort(r: CatalogResort, lon: number, lat: number): number {
	const [w, s, e, n] = r.bbox;
	const dLon = lon < w ? w - lon : lon > e ? lon - e : 0;
	const dLat = lat < s ? s - lat : lat > n ? lat - n : 0;
	return Math.hypot(
		dLon * KM_PER_LONGITUDE_DEGREE_EQUATOR * Math.cos(lat * DEG_TO_RAD),
		dLat * KM_PER_LATITUDE_DEGREE
	);
}

export function nearestBuilt(
	resorts: CatalogResort[],
	lon: number,
	lat: number,
	minKm = 0
): { resort: CatalogResort; km: number } | null {
	let best: { resort: CatalogResort; km: number } | null = null;
	for (const r of resorts) {
		if (!r.built || r.km < minKm) continue;
		const km = kmToResort(r, lon, lat);
		if (!best || km < best.km) best = { resort: r, km };
	}
	return best;
}

const MIN_RESORT_REACH_KM = 3;
const MAX_RESORT_REACH_KM = 25;
const reachKm = (r: CatalogResort) =>
	Math.min(MAX_RESORT_REACH_KM, Math.max(MIN_RESORT_REACH_KM, r.km / 4));

export function resortAt(
	resorts: CatalogResort[],
	lon: number,
	lat: number,
	prefer?: string | null
): CatalogResort | null {
	let best: { resort: CatalogResort; share: number } | null = null;
	let preferred: CatalogResort | null = null;
	for (const r of resorts) {
		if (!r.built) continue;
		const share = kmToResort(r, lon, lat) / reachKm(r);
		if (share > 1) continue;
		if (r.id === prefer) preferred = r;
		if (!best || share < best.share) best = { resort: r, share };
	}
	const isInsideAnotherResort =
		best?.share === 0 && preferred !== null && kmToResort(preferred, lon, lat) > 0;
	if (isInsideAnotherResort) return best!.resort;
	return preferred ?? best?.resort ?? null;
}
