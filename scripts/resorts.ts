import { APP_USER_AGENT } from '#lib/identity.ts';
import fs from 'node:fs';
import path from 'node:path';

export interface ResortConfig {
	id: string;
	name: string;
	timezone: string;
	queryBbox: [number, number, number, number];
	liftWays: number[];
	liftRels: number[];
	runWays: number[];
	runRels: number[];
	memberBbox: [number, number, number, number];
	oskId: string;
}

interface CatalogEntry {
	id: string;
	name: string;
	center: [number, number];
	bbox: [number, number, number, number];
	osk: string;
}

interface MemberEntry {
	liftWays: number[];
	liftRels: number[];
	runWays: number[];
	runRels: number[];
	bbox: [number, number, number, number];
	hasDownhill?: boolean;
	timezone?: string;
}

const OVERPASS_QUERY_BBOX_MARGIN_DEG = 0.03;
const MIN_TIMEZONE_FETCH_INTERVAL_MS = 1100;
const DEFAULT_FALLBACK_RESORT_SLUG = 'soelden';
const DEFAULT_FALLBACK_TIMEZONE = 'UTC';

let cachedCatalog: Map<string, CatalogEntry> | undefined;
let cachedMembership: Map<string, MemberEntry> | undefined;

export function loadCatalog(): Map<string, CatalogEntry> {
	if (!cachedCatalog) {
		const p = path.resolve(process.cwd(), 'static/data/resorts.json');
		const cat = JSON.parse(fs.readFileSync(p, 'utf8')) as { resorts: CatalogEntry[] };
		cachedCatalog = new Map(cat.resorts.map((r) => [r.id, r]));
	}
	return cachedCatalog;
}

function loadMembership(): Map<string, MemberEntry> {
	if (!cachedMembership) {
		const cache = 'data/cache/openskimap/membership.json';
		const p = fs.existsSync(cache) ? cache : 'data/soelden-membership.json';
		const raw = JSON.parse(fs.readFileSync(p, 'utf8')) as Record<string, MemberEntry>;
		cachedMembership = new Map(Object.entries(raw));
	}
	return cachedMembership;
}

let lastTzFetchTime = 0;

export async function fetchTimezone(lat: number, lon: number): Promise<string> {
	const elapsed = Date.now() - lastTzFetchTime;
	if (elapsed < MIN_TIMEZONE_FETCH_INTERVAL_MS) {
		await new Promise((r) => setTimeout(r, MIN_TIMEZONE_FETCH_INTERVAL_MS - elapsed));
	}
	lastTzFetchTime = Date.now();
	const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m&timezone=auto`;
	const res = await fetch(url, { headers: { 'User-Agent': APP_USER_AGENT } });
	if (!res.ok) throw new Error(`Open-Meteo timezone lookup failed: HTTP ${res.status}`);
	const data = (await res.json()) as { timezone?: string };
	if (!data.timezone) throw new Error('No timezone field in Open-Meteo response');
	return data.timezone;
}

export async function getOrFetchTimezone(slug: string, lat: number, lon: number): Promise<string> {
	const tzFile = path.resolve(process.cwd(), `data/cache/timezone/${slug}.txt`);
	if (fs.existsSync(tzFile)) {
		return fs.readFileSync(tzFile, 'utf8').trim();
	}
	try {
		const tz = await fetchTimezone(lat, lon);
		fs.mkdirSync(path.dirname(tzFile), { recursive: true });
		fs.writeFileSync(tzFile, tz);
		return tz;
	} catch (err) {
		console.warn(`Timezone lookup failed for ${slug} (${lat},${lon}), falling back to UTC:`, err);
		return DEFAULT_FALLBACK_TIMEZONE;
	}
}

export async function resortConfigFor(slug: string): Promise<ResortConfig> {
	const catalog = loadCatalog();
	const entry = catalog.get(slug);
	if (!entry) {
		const known = [...catalog.keys()].slice(0, 10).join(', ');
		throw new Error(`Unknown resort "${slug}". First 10 known: ${known} ...`);
	}

	const membership = loadMembership();
	const m = membership.get(entry.osk);
	if (!m) {
		throw new Error(
			`No membership data for "${slug}". Run bun run data:catalog to prepare the membership cache.`
		);
	}

	const [west, south, east, north] = m.bbox;
	const queryBbox: [number, number, number, number] = [
		south - OVERPASS_QUERY_BBOX_MARGIN_DEG,
		west - OVERPASS_QUERY_BBOX_MARGIN_DEG,
		north + OVERPASS_QUERY_BBOX_MARGIN_DEG,
		east + OVERPASS_QUERY_BBOX_MARGIN_DEG
	];

	const tz = m.timezone ?? (await getOrFetchTimezone(slug, entry.center[1], entry.center[0]));

	return {
		id: slug,
		name: entry.name,
		timezone: tz,
		queryBbox,
		liftWays: m.liftWays,
		liftRels: m.liftRels,
		runWays: m.runWays,
		runRels: m.runRels,
		memberBbox: m.bbox,
		oskId: entry.osk
	};
}

export function resortIdFromArgs(): string {
	const id =
		process.argv.slice(2).find((arg) => !arg.startsWith('--')) ?? DEFAULT_FALLBACK_RESORT_SLUG;
	if (!loadCatalog().has(id)) throw new Error(`Unknown resort "${id}"`);
	return id;
}

export async function resortFromArgs(): Promise<ResortConfig> {
	return resortConfigFor(resortIdFromArgs());
}
