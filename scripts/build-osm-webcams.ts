import { APP_USER_AGENT } from '#lib/identity.ts';
import fs from 'node:fs';
import path from 'node:path';
import type { Catalog, CatalogResort } from '../src/lib/resort/catalog.ts';
import { adapters as ADAPTERS, resolveWebcam } from '../src/lib/webcams/resolve.ts';
import type { ResolvedWebcam, WebcamAdapter } from '../src/lib/webcams/types.ts';
import { syncCatalogFiles } from './catalog-files.ts';

const RAW_PATH = path.resolve(process.cwd(), 'data/raw/osm-webcams.json');
const CACHE_PATH = path.resolve(process.cwd(), 'data/cache/webcam-resolve.json');
const CATALOG_PATH = path.resolve(process.cwd(), 'static/data/resorts.json');

const MIRRORS = [
	'https://overpass.openstreetmap.fr/api/interpreter',
	'https://overpass.private.coffee/api/interpreter',
	'https://overpass-api.de/api/interpreter',
	'https://overpass.kumi.systems/api/interpreter'
];

const PER_HOST_REQUESTS = 2;
const MIN_GAP_MS = 800;
const FETCH_TIMEOUT_MS = 25_000;
const RETRY_TRANSIENT_AFTER_MS = 30 * 60_000;
const PAD_KM = 1;
const MIN_OVERPASS_REQUEST_GAP_MS = 2000;
const KM_PER_LATITUDE_DEGREE = 111.32;
const MAX_BOUNDING_LATITUDE = 89;
const RESOLVE_TIMEOUT_MS = 120_000;
const SAVE_CACHE_INTERVAL = 25;
const FOTO_WEBCAM_STANDARD_RES = '/current/1200.jpg';
const FOTO_WEBCAM_LOWER_RES_FALLBACK = '/current/816.jpg';

const TOTAL_REQUESTS = 24;

export interface OsmWebcam {
	osm: string;
	name: string;
	lat: number;
	lon: number;
	direction: number | null;
	fov: number | null;
	url: string;
	provider: string | null;
	cameraId: string | null;
	imageUrl: string | null;
	error?: string;
}

interface OverpassElement {
	type: 'node' | 'way' | 'relation';
	id: number;
	lat?: number;
	lon?: number;
	center?: { lat: number; lon: number };
	tags?: Record<string, string>;
}

interface RawFile {
	fetchedAt: string;
	queries: { name: string; mirror: string; elements: number }[];
	elements: OverpassElement[];
}

type CacheEntry =
	| { at: string; adapter?: string; ok: true; result: ResolvedWebcam }
	| { at: string; adapter?: string; ok: false; error: string; transient: boolean };

const QUERIES: { name: string; ql: string; min: number }[] = [
	{
		name: 'surveillance=webcam',
		ql: '[out:json][timeout:180];(node["surveillance"="webcam"];way["surveillance"="webcam"];);out center tags;',
		min: 1000
	},
	{
		name: 'contact:webcam',
		ql: '[out:json][timeout:180];(node["contact:webcam"];way["contact:webcam"];);out center tags;',
		min: 5000
	},
	{
		name: 'webcam',
		ql: '[out:json][timeout:180];(node["webcam"];way["webcam"];);out center tags;',
		min: 10
	}
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let lastOverpassRequest = 0;

async function overpass(
	q: (typeof QUERIES)[number]
): Promise<{ mirror: string; elements: OverpassElement[] }> {
	let lastError = 'no mirror tried';
	for (const mirror of MIRRORS) {
		const wait = MIN_OVERPASS_REQUEST_GAP_MS - (Date.now() - lastOverpassRequest);
		if (wait > 0) await sleep(wait);
		lastOverpassRequest = Date.now();
		try {
			console.log(`[osm-webcams] ${q.name}: ${mirror}`);
			const res = await fetch(mirror, {
				method: 'POST',
				headers: { 'User-Agent': APP_USER_AGENT },
				body: new URLSearchParams({ data: q.ql }),
				signal: AbortSignal.timeout(200_000)
			});
			if (!res.ok) {
				lastError = `${mirror}: HTTP ${res.status}`;
				console.warn(`[osm-webcams] ${lastError}`);
				continue;
			}
			const parsed = JSON.parse(await res.text()) as {
				elements?: OverpassElement[];
				remark?: string;
			};
			if (parsed.remark && /error|timed out|out of memory/i.test(parsed.remark)) {
				lastError = `${mirror}: ${parsed.remark}`;
				console.warn(`[osm-webcams] ${lastError}`);
				continue;
			}
			if (!Array.isArray(parsed.elements) || parsed.elements.length < q.min) {
				lastError = `${mirror}: ${parsed.elements?.length ?? 'no'} elements, expected at least ${q.min}`;
				console.warn(`[osm-webcams] ${lastError}`);
				continue;
			}
			return { mirror, elements: parsed.elements };
		} catch (err) {
			lastError = `${mirror}: ${(err as Error).message}`;
			console.warn(`[osm-webcams] ${lastError}`);
		}
	}
	throw new Error(`All Overpass mirrors failed for ${q.name}: ${lastError}`);
}

async function loadRaw(refresh: boolean): Promise<RawFile> {
	if (!refresh && fs.existsSync(RAW_PATH)) {
		try {
			const raw = JSON.parse(fs.readFileSync(RAW_PATH, 'utf8')) as RawFile;
			if (Array.isArray(raw.elements) && raw.elements.length) {
				console.log(
					`[osm-webcams] cached ${RAW_PATH}: ${raw.elements.length} elements (${raw.fetchedAt})`
				);
				return raw;
			}
		} catch (err) {
			console.warn(`[osm-webcams] cache unreadable, downloading again: ${(err as Error).message}`);
		}
	}
	const byKey = new Map<string, OverpassElement>();
	const queries: RawFile['queries'] = [];
	for (const q of QUERIES) {
		const { mirror, elements } = await overpass(q);
		queries.push({ name: q.name, mirror, elements: elements.length });
		for (const el of elements) byKey.set(`${el.type}/${el.id}`, el);
		console.log(`[osm-webcams] ${q.name}: ${elements.length} elements from ${mirror}`);
	}
	const raw: RawFile = {
		fetchedAt: new Date().toISOString(),
		queries,
		elements: [...byKey.values()]
	};
	fs.mkdirSync(path.dirname(RAW_PATH), { recursive: true });
	fs.writeFileSync(RAW_PATH, JSON.stringify(raw));
	console.log(`[osm-webcams] wrote ${RAW_PATH}: ${raw.elements.length} distinct elements`);
	return raw;
}

const COMPASS: Record<string, number> = {
	n: 0,
	nne: 22.5,
	ne: 45,
	ene: 67.5,
	e: 90,
	ese: 112.5,
	se: 135,
	sse: 157.5,
	s: 180,
	ssw: 202.5,
	sw: 225,
	wsw: 247.5,
	w: 270,
	wnw: 292.5,
	nw: 315,
	nnw: 337.5,
	north: 0,
	northeast: 45,
	east: 90,
	southeast: 135,
	south: 180,
	southwest: 225,
	west: 270,
	northwest: 315
};

const norm360 = (deg: number) => Math.round((((deg % 360) + 360) % 360) * 10) / 10;

function parseOne(raw: string): { direction: number | null; fov: number | null } | null {
	const s = raw
		.trim()
		.toLowerCase()
		.replace(/°|deg(rees)?$/g, '')
		.trim();
	if (!s) return null;
	const range = s.match(/^(-?\d+(?:[.,]\d+)?)\s*(?:-|–|—|to)\s*(\d+(?:[.,]\d+)?)$/);
	if (range) {
		const a = Number(range[1].replace(',', '.'));
		const b = Number(range[2].replace(',', '.'));
		let width = b - a;
		if (width <= 0) width += 360;
		if (width >= 359) return { direction: null, fov: 360 };
		return { direction: norm360(a + width / 2), fov: Math.round(width * 10) / 10 };
	}
	if (/^-?\d+(?:[.,]\d+)?$/.test(s)) {
		const n = Number(s.replace(',', '.'));
		if (Number.isFinite(n)) return { direction: norm360(n), fov: null };
	}
	if (s in COMPASS) return { direction: COMPASS[s], fov: null };
	return null;
}

export function parseDirection(value: string | undefined): {
	direction: number | null;
	fov: number | null;
} {
	if (!value) return { direction: null, fov: null };
	const parsed = value
		.split(/;|,\s+/)
		.map(parseOne)
		.filter((p): p is { direction: number | null; fov: number | null } => p !== null);
	if (!parsed.length) return { direction: null, fov: null };
	if (parsed.length >= 3 && parsed.every((p) => p.direction !== null)) {
		const dirs = parsed.map((p) => p.direction as number).sort((a, b) => a - b);
		let maxGap = dirs[0] + 360 - dirs[dirs.length - 1];
		for (let i = 1; i < dirs.length; i++) maxGap = Math.max(maxGap, dirs[i] - dirs[i - 1]);
		if (maxGap <= 120) return { direction: null, fov: 360 };
	}
	return parsed[0];
}

function urlsFrom(value: string | undefined): string[] {
	if (!value) return [];
	const out: string[] = [];
	for (const part of value.split(/[;\s]+/)) {
		let s = part.trim();
		if (!s || s === 'yes' || s === 'no') continue;
		if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) {
			if (!/^[^\s/]+\.[a-z]{2,}(?:[/:?#]|$)/i.test(s)) continue;
			s = `https://${s}`;
		}
		try {
			const u = new URL(s);
			if (u.protocol === 'http:' || u.protocol === 'https:') out.push(u.href);
		} catch {
			continue;
		}
	}
	return out;
}

const supportingAdapter = (url: string): WebcamAdapter | undefined => {
	const u = new URL(url);
	return ADAPTERS.find((a) => a.match(u));
};

const looksLikePicture = (url: string) => /\.(?:jpe?g|png|webp|gif)$/i.test(new URL(url).pathname);

function pickUrl(tags: Record<string, string>): string {
	const candidates = [
		...urlsFrom(tags['contact:webcam']),
		...urlsFrom(tags.webcam),
		...(tags.surveillance === 'webcam'
			? [...urlsFrom(tags.url), ...urlsFrom(tags.website), ...urlsFrom(tags['contact:website'])]
			: [])
	];
	return (
		candidates.find((u) => supportingAdapter(u)?.name !== 'direct') ??
		candidates.find(looksLikePicture) ??
		candidates[0] ??
		''
	);
}

function toWebcam(el: OverpassElement): OsmWebcam | null {
	const lat = el.lat ?? el.center?.lat;
	const lon = el.lon ?? el.center?.lon;
	if (lat == null || lon == null || !el.tags) return null;
	const tags = el.tags;
	const { direction, fov } = parseDirection(tags['camera:direction'] ?? tags.direction);
	return {
		osm: `${el.type}/${el.id}`,
		name: tags.name ?? tags['name:en'] ?? tags.description ?? '',
		lat: Math.round(lat * 1e6) / 1e6,
		lon: Math.round(lon * 1e6) / 1e6,
		direction,
		fov,
		url: pickUrl(tags),
		provider: null,
		cameraId: null,
		imageUrl: null
	};
}

const PROVIDER_RAW_PATH = path.resolve(process.cwd(), 'data/raw/provider-webcams.json');

interface PanomaxMapInstance {
	id: number;
	name?: string;
	cam?: { id?: number; name?: string; latitude?: number; longitude?: number; viewAngle?: number };
}

interface FotoWebcamMeta {
	id: string;
	name?: string;
	title?: string;
	offline?: boolean;
	hidden?: boolean;
	link?: string;
	latitude?: number;
	longitude?: number;
	direction?: number;
	sector?: number;
}

interface ProviderRaw {
	fetchedAt: string;
	panomax: PanomaxMapInstance[];
	fotoWebcam: FotoWebcamMeta[];
}

async function loadProviderRaw(refresh: boolean): Promise<ProviderRaw> {
	if (!refresh && fs.existsSync(PROVIDER_RAW_PATH)) {
		const raw = JSON.parse(fs.readFileSync(PROVIDER_RAW_PATH, 'utf8')) as ProviderRaw;
		console.log(
			`[osm-webcams] cached ${PROVIDER_RAW_PATH}: ${raw.panomax.length} Panomax, ${raw.fotoWebcam.length} foto-webcam.eu (${raw.fetchedAt})`
		);
		return raw;
	}
	const get = async (url: string) => {
		const res = await fetch(url, {
			headers: { 'User-Agent': APP_USER_AGENT },
			signal: AbortSignal.timeout(60_000)
		});
		if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
		return res.json();
	};
	const map = (await get('https://api.panomax.com/1.0/maps/panomaxweb')) as {
		instances?: Record<string, PanomaxMapInstance>;
	};
	const meta = (await get('https://www.foto-webcam.eu/webcam/include/metadata.php')) as {
		cams?: FotoWebcamMeta[];
	};
	const raw: ProviderRaw = {
		fetchedAt: new Date().toISOString(),
		panomax: Object.values(map.instances ?? {}),
		fotoWebcam: meta.cams ?? []
	};
	if (raw.panomax.length < 300 || raw.fotoWebcam.length < 300)
		throw new Error(
			`Provider lists look truncated: ${raw.panomax.length} Panomax, ${raw.fotoWebcam.length} foto-webcam.eu`
		);
	fs.mkdirSync(path.dirname(PROVIDER_RAW_PATH), { recursive: true });
	fs.writeFileSync(PROVIDER_RAW_PATH, JSON.stringify(raw));
	console.log(
		`[osm-webcams] wrote ${PROVIDER_RAW_PATH}: ${raw.panomax.length} Panomax, ${raw.fotoWebcam.length} foto-webcam.eu`
	);
	return raw;
}

const round6 = (x: number) => Math.round(x * 1e6) / 1e6;

function providerWebcams(raw: ProviderRaw): OsmWebcam[] {
	const out: OsmWebcam[] = [];
	for (const i of raw.panomax) {
		const cam = i.cam;
		if (cam?.id == null || typeof cam.latitude !== 'number' || typeof cam.longitude !== 'number')
			continue;
		out.push({
			osm: `panomax/${cam.id}`,
			name: (i.name ?? cam.name ?? '').trim(),
			lat: round6(cam.latitude),
			lon: round6(cam.longitude),
			direction: null,
			fov:
				typeof cam.viewAngle === 'number' && cam.viewAngle > 0
					? Math.min(360, cam.viewAngle)
					: null,
			url: `https://www.panomax.com/${i.id}`,
			provider: 'panomax',
			cameraId: String(cam.id),
			imageUrl: `https://panodata.panomax.com/cams/${cam.id}/recent_default.jpg`
		});
	}
	for (const c of raw.fotoWebcam) {
		if (c.offline || c.hidden || typeof c.latitude !== 'number' || typeof c.longitude !== 'number')
			continue;
		const page = `https://www.foto-webcam.eu/webcam/${c.id}/`;
		const fov = typeof c.sector === 'number' && c.sector > 0 ? Math.min(360, c.sector) : null;
		out.push({
			osm: `foto-webcam/${c.id}`,
			name: (c.title ?? c.name ?? c.id).trim(),
			lat: round6(c.latitude),
			lon: round6(c.longitude),
			direction:
				typeof c.direction === 'number' && fov != null && fov < 360 ? norm360(c.direction) : null,
			fov,
			url: page,
			provider: 'foto-webcam',
			cameraId: c.id,
			imageUrl: `${page}current/1200.jpg`
		});
	}
	return out;
}

const isBuilt = (id: string) =>
	fs.existsSync(`static/data/${id}.json`) && fs.existsSync(`static/data/${id}-terrain.json`);

function padded(bbox: CatalogResort['bbox'], km: number): CatalogResort['bbox'] {
	const [w, s, e, n] = bbox;
	const dLat = km / KM_PER_LATITUDE_DEGREE;
	const maxLat = Math.min(MAX_BOUNDING_LATITUDE, Math.max(Math.abs(s), Math.abs(n)));
	const dLon = km / (KM_PER_LATITUDE_DEGREE * Math.cos((maxLat * Math.PI) / 180));
	return [w - dLon, s - dLat, e + dLon, n + dLat];
}

export function hostKey(host: string): string {
	const labels = host
		.toLowerCase()
		.replace(/^www\./, '')
		.split('.');
	if (labels.length <= 2) return labels.join('.');
	const tld = labels[labels.length - 1];
	const sld = labels[labels.length - 2];
	const take =
		tld.length === 2 && ['co', 'com', 'org', 'net', 'gov', 'ac', 'ne', 'or'].includes(sld) ? 3 : 2;
	return labels.slice(-take).join('.');
}

class Semaphore {
	private waiting: (() => void)[] = [];
	private free: number;
	constructor(n: number) {
		this.free = n;
	}
	async acquire(): Promise<() => void> {
		if (this.free > 0) this.free--;
		else await new Promise<void>((resolve) => this.waiting.push(resolve));
		return () => {
			const next = this.waiting.shift();
			if (next) next();
			else this.free++;
		};
	}
}

const hostLimits = new Map<string, Semaphore>();
const nextStart = new Map<string, number>();
const totalLimit = new Semaphore(TOTAL_REQUESTS);

const limitedFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
	const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
	const key = hostKey(new URL(href).hostname);
	let sem = hostLimits.get(key);
	if (!sem) hostLimits.set(key, (sem = new Semaphore(PER_HOST_REQUESTS)));
	const release = await sem.acquire();
	try {
		const slot = Math.max(Date.now(), nextStart.get(key) ?? 0);
		nextStart.set(key, slot + MIN_GAP_MS);
		if (slot > Date.now()) await sleep(slot - Date.now());
		const releaseTotal = await totalLimit.acquire();
		try {
			return await fetch(input, {
				...init,
				signal: init?.signal ?? AbortSignal.timeout(FETCH_TIMEOUT_MS)
			});
		} finally {
			releaseTotal();
		}
	} finally {
		release();
	}
}) as typeof fetch;

function loadCache(): Record<string, CacheEntry> {
	try {
		return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')) as Record<string, CacheEntry>;
	} catch {
		return {};
	}
}

function saveCache(cache: Record<string, CacheEntry>): void {
	fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
	const tmp = `${CACHE_PATH}.tmp`;
	fs.writeFileSync(tmp, JSON.stringify(cache));
	fs.renameSync(tmp, CACHE_PATH);
}

const isTransient = (message: string) =>
	/HTTP (5\d\d|429|408)|Could not determine Panomax camera ID|fetch failed|timeout|timed out|aborted|ECONN|ENOTFOUND|EAI_AGAIN|socket|network|unable to connect/i.test(
		message
	);

async function resolveAll(
	urls: string[],
	cache: Record<string, CacheEntry>,
	retryErrors: boolean
): Promise<{ requested: number; resolved: number; failed: number }> {
	const todo = urls.filter((u) => {
		const e = cache[u];
		if (!e) return true;
		if (e.adapter && e.adapter !== supportingAdapter(u)?.name) return true;
		if (e.ok) return false;
		if (retryErrors) return true;
		return e.transient && Date.now() - new Date(e.at).getTime() > RETRY_TRANSIENT_AFTER_MS;
	});

	const groups = new Map<string, string[]>();
	for (const u of todo) {
		const key = hostKey(new URL(u).hostname);
		(groups.get(key) ?? groups.set(key, []).get(key)!).push(u);
	}

	let done = 0;
	let resolved = 0;
	let failed = 0;
	const started = Date.now();
	const worker = async (queue: string[]) => {
		for (let url = queue.shift(); url; url = queue.shift()) {
			let entry: CacheEntry;
			const adapter = supportingAdapter(url)?.name;
			try {
				const result = await Promise.race([
					resolveWebcam(url, limitedFetch),
					new Promise<never>((_, reject) =>
						setTimeout(() => reject(new Error('timeout resolving camera')), RESOLVE_TIMEOUT_MS)
					)
				]);
				entry = { at: new Date().toISOString(), adapter, ok: true, result };
				resolved++;
			} catch (err) {
				const error = ((err as Error).message ?? String(err)).slice(0, 300);
				entry = {
					at: new Date().toISOString(),
					adapter,
					ok: false,
					error,
					transient: isTransient(error)
				};
				failed++;
			}
			cache[url] = entry;
			done++;
			if (done % SAVE_CACHE_INTERVAL === 0) {
				saveCache(cache);
				console.log(
					`[osm-webcams] resolve ${done}/${todo.length} (${resolved} ok, ${failed} failed, ${Math.round((Date.now() - started) / 1000)} s)`
				);
			}
		}
	};

	const workers: Promise<void>[] = [];
	for (const queue of groups.values()) {
		for (let i = 0; i < PER_HOST_REQUESTS; i++) workers.push(worker(queue));
	}
	await Promise.all(workers);
	if (todo.length) saveCache(cache);
	return { requested: todo.length, resolved, failed };
}

function applyResolution(w: OsmWebcam, cache: Record<string, CacheEntry>): void {
	if (!w.url) return;
	const adapter = supportingAdapter(w.url);
	if (!adapter) return;
	const entry = cache[w.url];
	if (!entry) return;
	if (entry.adapter && entry.adapter !== adapter.name) return;
	if (!entry.ok && adapter.name === 'direct') return;
	if (entry.ok) {
		const r = entry.result;
		w.provider = r.provider;
		w.cameraId = r.cameraId;
		w.imageUrl = r.imageUrl;
		if (!w.name) w.name = r.name;
	} else {
		w.provider = adapter.name;
		w.error = entry.error;
	}
}

const byCountDesc = (a: [string, number], b: [string, number]) =>
	b[1] - a[1] || a[0].localeCompare(b[0]);

async function main(): Promise<void> {
	const t0 = Date.now();
	const argv = process.argv.slice(2);
	const raw = await loadRaw(argv.includes('--refresh'));

	const all = new Map<string, OsmWebcam>();
	let withoutPosition = 0;
	for (const el of raw.elements) {
		const w = toWebcam(el);
		if (w) all.set(w.osm, w);
		else withoutPosition++;
	}
	const worldwide = [...all.values()];
	console.log(
		`\nWebcams worldwide: ${worldwide.length} (${worldwide.filter((w) => w.osm.startsWith('node/')).length} nodes, ${worldwide.filter((w) => w.osm.startsWith('way/')).length} ways, ${withoutPosition} without position skipped)`
	);

	const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8')) as Catalog;
	const built = catalog.resorts.filter((r) => isBuilt(r.id));
	const boxes = built.map((r) => ({ id: r.id, box: padded(r.bbox, PAD_KM) }));
	const perResort = new Map<string, OsmWebcam[]>();
	const inResort = new Set<string>();
	let assignments = 0;
	for (const w of worldwide) {
		for (const { id, box } of boxes) {
			if (w.lon < box[0] || w.lon > box[2] || w.lat < box[1] || w.lat > box[3]) continue;
			(perResort.get(id) ?? perResort.set(id, []).get(id)!).push(w);
			inResort.add(w.osm);
			assignments++;
		}
	}
	console.log(
		`Built resorts: ${built.length} of ${catalog.resorts.length}; webcams inside a built resort: ${inResort.size} (${assignments} assignments, resorts may overlap)`
	);

	const placed = [...inResort].map((osm) => all.get(osm)!);
	const noUrl = placed.filter((w) => !w.url).length;
	const urls = [
		...new Set(placed.filter((w) => w.url && supportingAdapter(w.url)).map((w) => w.url))
	];
	const cache = loadCache();
	if (argv.includes('--no-resolve')) {
		console.log(`Resolve skipped (--no-resolve); ${urls.length} addresses`);
	} else {
		const r = await resolveAll(urls, cache, argv.includes('--retry-errors'));
		console.log(
			`Resolve: ${urls.length} addresses, ${urls.length - r.requested} answered from the cache, ${r.requested} requested (${r.resolved} ok, ${r.failed} failed)`
		);
	}
	for (const w of placed) applyResolution(w, cache);

	const providerRaw = await loadProviderRaw(argv.includes('--refresh'));
	const fromProviders = providerWebcams(providerRaw);
	const providerAdded = new Map<string, OsmWebcam>();
	let duplicates = 0;
	for (const { id, box } of boxes) {
		const list = perResort.get(id) ?? [];
		const known = new Set(
			list.flatMap((w) => (w.provider && w.cameraId ? [`${w.provider}/${w.cameraId}`] : []))
		);
		for (const w of fromProviders) {
			if (w.lon < box[0] || w.lon > box[2] || w.lat < box[1] || w.lat > box[3]) continue;
			if (known.has(w.osm)) {
				duplicates++;
				continue;
			}
			list.push(w);
			providerAdded.set(w.osm, w);
		}
		if (list.length) perResort.set(id, list);
	}
	await Promise.all(
		[...providerAdded.values()]
			.filter((w) => w.provider === 'foto-webcam')
			.map(async (w) => {
				const res = await limitedFetch(w.imageUrl!, {
					method: 'HEAD',
					headers: { 'User-Agent': APP_USER_AGENT }
				}).catch(() => null);
				if (res && !res.ok)
					w.imageUrl = w.imageUrl!.replace(
						FOTO_WEBCAM_STANDARD_RES,
						FOTO_WEBCAM_LOWER_RES_FALLBACK
					);
			})
	);
	console.log(
		`Provider lists: ${fromProviders.length} cameras, ${providerAdded.size} added to built resorts (${[...providerAdded.values()].filter((w) => w.provider === 'panomax').length} Panomax, ${[...providerAdded.values()].filter((w) => w.provider === 'foto-webcam').length} foto-webcam.eu), ${duplicates} already in OSM`
	);

	let written = 0;
	let removed = 0;
	for (const r of built) {
		const file = `static/data/${r.id}-webcams.json`;
		const list = perResort.get(r.id);
		if (!list?.length) {
			if (fs.existsSync(file)) {
				fs.rmSync(file);
				removed++;
			}
			continue;
		}
		list.sort((a, b) => {
			const [ta, ia] = a.osm.split('/');
			const [tb, ib] = b.osm.split('/');
			const rank = (t: string) => (t === 'node' || t === 'way' ? 0 : 1);
			return (
				rank(ta) - rank(tb) ||
				ta.localeCompare(tb) ||
				(rank(ta) === 0 ? Number(ia) - Number(ib) : ia.localeCompare(ib))
			);
		});
		fs.writeFileSync(file, JSON.stringify(list));
		written++;
	}
	console.log(
		`Wrote ${written} static/data/<id>-webcams.json files (${removed} stale ones removed)`
	);
	syncCatalogFiles();

	console.log(`\nResorts with at least one webcam: ${perResort.size}`);
	console.log(`Webcams in built resorts without any address: ${noUrl}`);
	const hostStats = (list: OsmWebcam[]) => {
		const stats = new Map<string, { count: number; adapter: string; resolved: number }>();
		for (const w of list) {
			const key = w.url ? hostKey(new URL(w.url).hostname) : '(no address)';
			const s = stats.get(key) ?? { count: 0, adapter: '-', resolved: 0 };
			s.count++;
			const name = w.url ? supportingAdapter(w.url)?.name : undefined;
			if (name && (s.adapter === '-' || s.adapter === 'direct')) s.adapter = name;
			if (w.imageUrl) s.resolved++;
			stats.set(key, s);
		}
		return [...stats.entries()].sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]));
	};
	for (const [title, list] of [
		['in built resorts', placed],
		['worldwide', worldwide]
	] as const) {
		console.log(`\nTop 15 hosts ${title} (count / resolved / adapter):`);
		for (const [host, s] of hostStats(list).slice(0, 15)) {
			console.log(
				`  ${host.padEnd(34)} ${String(s.count).padStart(5)} ${String(s.resolved).padStart(5)}  ${s.adapter}`
			);
		}
	}
	const providers = new Map<string, [number, number]>();
	for (const w of placed) {
		if (!w.provider) continue;
		const p = providers.get(w.provider) ?? [0, 0];
		p[0]++;
		if (w.imageUrl) p[1]++;
		providers.set(w.provider, p);
	}
	console.log(
		`\nBy provider, in built resorts (matched / resolved): ${JSON.stringify(Object.fromEntries(providers))}`
	);
	console.log(
		`Webcams in built resorts with a picture address: ${placed.filter((w) => w.imageUrl).length} of ${placed.length}`
	);
	const directFailures = new Map<string, number>();
	let directOk = 0;
	let directUnasked = 0;
	for (const w of placed) {
		if (!w.url || supportingAdapter(w.url)?.name !== 'direct') continue;
		const e = cache[w.url];
		if (!e) directUnasked++;
		else if (e.ok) directOk++;
		else {
			const reason = (
				e.error.match(/^(Not an image: [^ (]+|HTTP \d+)/)?.[1] ?? e.error.slice(0, 50)
			).replace(/\s+/g, ' ');
			directFailures.set(reason, (directFailures.get(reason) ?? 0) + 1);
		}
	}
	console.log(
		`Direct addresses (no provider adapter): ${directOk} are pictures, ${[...directFailures.values()].reduce((a, b) => a + b, 0)} are not or did not answer, ${directUnasked} not asked`
	);
	for (const [reason, n] of [...directFailures.entries()].sort(byCountDesc).slice(0, 12))
		console.log(`  ${n}x ${reason}`);
	const errors = new Map<string, number>();
	for (const w of placed)
		if (w.error) errors.set(w.error.slice(0, 90), (errors.get(w.error.slice(0, 90)) ?? 0) + 1);
	if (errors.size) {
		console.log('Resolve errors:');
		for (const [msg, n] of [...errors.entries()].sort(byCountDesc).slice(0, 10))
			console.log(`  ${n}x ${msg}`);
	}
	console.log(`\nDone in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}

if (import.meta.main) {
	main().catch((err) => {
		console.error('Fatal:', err);
		process.exit(1);
	});
}
