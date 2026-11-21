import { APP_USER_AGENT } from '#lib/identity.ts';
import { createReadStream } from 'node:fs';
import fs from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { gzipSync } from 'node:zlib';
import type { Catalog, CatalogResort } from '../src/lib/resort/catalog.ts';
import type { Difficulty } from '../src/lib/resort/types.ts';

const CACHE_DIR = 'data/cache/openskimap';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const EARTH_RADIUS_KM = 6371;
const MAX_SLUG_LENGTH = 40;
const MIN_SLUG_LENGTH = 3;
const MAX_SLUG_MATCH_DISTANCE_KM = 2;
const COORDINATE_PRECISION_FACTOR = 100000;

function roundCoordinate(coord: number): number {
	return Math.round(coord * COORDINATE_PRECISION_FACTOR) / COORDINATE_PRECISION_FACTOR;
}

const UMLAUT_COUNTRIES = new Set(['AT', 'DE', 'CH', 'LI']);
const RESERVED = new Set([
	'api',
	'dev',
	'demo',
	'data',
	'icons',
	'models',
	'now',
	'route',
	'track',
	'progress'
]);

const DIFFICULTIES: Record<string, Difficulty> = {
	novice: 'novice',
	easy: 'easy',
	intermediate: 'intermediate',
	advanced: 'advanced',
	expert: 'expert',
	freeride: 'freeride',
	other: 'unknown'
};

function fileAge(p: string): number {
	try {
		return Date.now() - fs.statSync(p).mtimeMs;
	} catch {
		return Infinity;
	}
}

async function ensureCached(url: string, dest: string): Promise<void> {
	if (fileAge(dest) < MAX_AGE_MS) {
		console.log(`  cache hit: ${dest}`);
		return;
	}
	console.log(`  downloading ${url} → ${dest}`);
	fs.mkdirSync(path.dirname(dest), { recursive: true });
	const res = await fetch(url, { headers: { 'User-Agent': APP_USER_AGENT } });
	if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
	const buf = Buffer.from(await res.arrayBuffer());
	fs.writeFileSync(dest, buf);
	console.log(`  saved ${dest} (${(buf.length / 1024 / 1024).toFixed(1)} MB)`);
}

async function streamFeatures(filePath: string, onFeature: (line: string) => void): Promise<void> {
	const stream = createReadStream(filePath, { encoding: 'utf8' });
	const rl = createInterface({ input: stream, crlfDelay: Infinity });
	for await (const raw of rl) {
		const line = raw.trim().replace(/,$/, '');
		if (line.startsWith('{"type":"Feature"') || line.startsWith('{"properties":{')) {
			onFeature(line);
		}
	}
}

function removeDiacritics(s: string): string {
	return s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}

function umlauts(s: string): string {
	return s
		.replace(/ä/gi, (m) => (m === 'Ä' ? 'Ae' : 'ae'))
		.replace(/ö/gi, (m) => (m === 'Ö' ? 'Oe' : 'oe'))
		.replace(/ü/gi, (m) => (m === 'Ü' ? 'Ue' : 'ue'))
		.replace(/ß/g, 'ss');
}

function cutToWordBoundary(s: string, maxLen = MAX_SLUG_LENGTH): string {
	if (s.length <= maxLen) return s;
	const sub = s.slice(0, maxLen);
	if (s[maxLen] === '-') return sub;
	const lastDash = sub.lastIndexOf('-');
	if (lastDash > 0) return sub.slice(0, lastDash);
	return sub;
}

function slugifyPart(part: string, country: string): string {
	let s = country && UMLAUT_COUNTRIES.has(country) ? umlauts(part.trim()) : part.trim();
	s = removeDiacritics(s);
	const slug = s
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return cutToWordBoundary(slug, MAX_SLUG_LENGTH);
}

function toSlug(name: string, country: string): string {
	for (const part of name.split(',')) {
		const slug = slugifyPart(part, country);
		if (slug.length >= MIN_SLUG_LENGTH) return slug;
	}
	return '';
}

function haversineKm(lon1: number, lat1: number, lon2: number, lat2: number): number {
	const dLat = ((lat2 - lat1) * Math.PI) / 180;
	const dLon = ((lon2 - lon1) * Math.PI) / 180;
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
	return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

interface SlugEntry {
	slug: string;
	name: string;
	country: string;
	center: [number, number];
}

type SlugRegistry = Record<string, SlugEntry>;

function loadRegistry(): SlugRegistry {
	try {
		return JSON.parse(fs.readFileSync('data/slugs.json', 'utf8'));
	} catch {
		return {};
	}
}

function saveRegistry(reg: SlugRegistry): void {
	const sorted = Object.fromEntries(Object.entries(reg).sort((a, b) => a[0].localeCompare(b[0])));
	const lines = Object.entries(sorted)
		.map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`)
		.join(',\n');
	fs.writeFileSync('data/slugs.json', `{\n${lines}\n}\n`);
}

interface MemberEntry {
	liftWays: number[];
	liftRels: number[];
	runWays: number[];
	runRels: number[];
	bbox: [number, number, number, number];
	hasDownhill?: boolean;
}

type MembershipCache = Record<string, MemberEntry>;

async function main() {
	console.log('=== build-catalog.ts ===');

	const files = {
		skiAreas: path.join(CACHE_DIR, 'ski_areas.geojson'),
		lifts: path.join(CACHE_DIR, 'lifts.geojson'),
		runs: path.join(CACHE_DIR, 'runs.geojson')
	};
	console.log('\n--- ensuring OpenSkiMap dumps ---');
	await ensureCached('https://tiles.openskimap.org/geojson/ski_areas.geojson', files.skiAreas);
	await ensureCached('https://tiles.openskimap.org/geojson/lifts.geojson', files.lifts);
	await ensureCached('https://tiles.openskimap.org/geojson/runs.geojson', files.runs);

	console.log('\n--- loading ski areas ---');
	interface SkiArea {
		id: string;
		name: string;
		status: string;
		activities: string[];
		sources: { type: string; id: string | number }[];
		websites?: string[];
		places: { iso3166_1Alpha2?: string; localized?: { en?: { region?: string } } }[];
		statistics: {
			minElevation?: number;
			maxElevation?: number;
			lifts?: { byType?: Record<string, { count: number }> };
			runs?: {
				byActivity?: {
					downhill?: {
						byDifficulty?: Record<string, { count: number; lengthInKm: number }>;
					};
				};
			};
		};
		viewportHint?: { center?: [number, number] };
	}

	const skiAreas = new Map<string, SkiArea>();
	let totalAreas = 0;
	await streamFeatures(files.skiAreas, (line) => {
		totalAreas++;
		try {
			const feat = JSON.parse(line);
			const props = feat.properties as SkiArea;
			if (
				props.status === 'operating' &&
				Array.isArray(props.activities) &&
				props.activities.includes('downhill') &&
				props.name
			) {
				skiAreas.set(props.id, props);
			}
		} catch {
			return;
		}
	});
	console.log(`Total areas in dump: ${totalAreas}, operating+downhill+named: ${skiAreas.size}`);

	const memberCachePath = path.join(CACHE_DIR, 'membership.json');
	let memberCache: MembershipCache = {};
	const hasValidMemberCache =
		fs.existsSync(memberCachePath) && fileAge(memberCachePath) < MAX_AGE_MS;

	if (hasValidMemberCache) {
		console.log(`\n--- loading cached membership from ${memberCachePath} ---`);
		memberCache = JSON.parse(fs.readFileSync(memberCachePath, 'utf8'));
	} else {
		console.log('\n--- streaming lifts ---');
		const membership = new Map<
			string,
			{
				liftWays: Set<number>;
				liftRels: Set<number>;
				runWays: Set<number>;
				runRels: Set<number>;
				hasDownhill: boolean;
				coords: [number, number][];
			}
		>();

		const getMember = (id: string) => {
			let m = membership.get(id);
			if (!m) {
				m = {
					liftWays: new Set(),
					liftRels: new Set(),
					runWays: new Set(),
					runRels: new Set(),
					hasDownhill: false,
					coords: []
				};
				membership.set(id, m);
			}
			return m;
		};

		let liftLines = 0;
		await streamFeatures(files.lifts, (line) => {
			liftLines++;
			try {
				const feat = JSON.parse(line);
				const props = feat.properties;
				const skiAreaList = props.skiAreas ?? [];
				for (const sa of skiAreaList) {
					const areaId = sa?.properties?.id;
					if (!areaId || !skiAreas.has(areaId)) continue;
					const m = getMember(areaId);
					for (const src of props.sources ?? []) {
						if (src.type !== 'openstreetmap') continue;
						const osmId = String(src.id);
						if (osmId.startsWith('way/')) m.liftWays.add(Number(osmId.slice(4)));
						else if (osmId.startsWith('relation/')) m.liftRels.add(Number(osmId.slice(9)));
					}
					const coords = feat.geometry?.coordinates;
					if (Array.isArray(coords)) {
						for (const pt of coords) {
							if (Array.isArray(pt) && pt.length >= 2) {
								m.coords.push([pt[0], pt[1]]);
							}
						}
					}
				}
			} catch {
				return;
			}
		});
		console.log(`Processed ${liftLines} lift features`);

		console.log('\n--- streaming runs ---');
		let runLines = 0;
		await streamFeatures(files.runs, (line) => {
			runLines++;
			try {
				const feat = JSON.parse(line);
				const props = feat.properties;
				const uses: string[] = props.uses ?? [];
				const isDownhill = uses.includes('downhill');
				const isConnection = uses.includes('connection');
				if (!isDownhill && !isConnection) return;

				const skiAreaList = props.skiAreas ?? [];
				for (const sa of skiAreaList) {
					const areaId = sa?.properties?.id;
					if (!areaId || !skiAreas.has(areaId)) continue;
					const m = getMember(areaId);
					if (isDownhill) m.hasDownhill = true;
					for (const src of props.sources ?? []) {
						if (src.type !== 'openstreetmap') continue;
						const osmId = String(src.id);
						if (osmId.startsWith('way/')) m.runWays.add(Number(osmId.slice(4)));
						else if (osmId.startsWith('relation/')) m.runRels.add(Number(osmId.slice(9)));
					}
					const coords = feat.geometry?.coordinates;
					if (Array.isArray(coords)) {
						for (const pt of coords) {
							if (Array.isArray(pt) && pt.length >= 2) {
								m.coords.push([pt[0], pt[1]]);
							}
						}
					}
				}
			} catch {
				return;
			}
		});
		console.log(`Processed ${runLines} run features`);

		for (const [id, m] of membership) {
			if (m.liftWays.size + m.liftRels.size === 0) continue;
			if (!m.hasDownhill) continue;
			let west = Infinity,
				south = Infinity,
				east = -Infinity,
				north = -Infinity;
			for (const [lon, lat] of m.coords) {
				if (lon < west) west = lon;
				if (lon > east) east = lon;
				if (lat < south) south = lat;
				if (lat > north) north = lat;
			}
			memberCache[id] = {
				liftWays: [...m.liftWays],
				liftRels: [...m.liftRels],
				runWays: [...m.runWays],
				runRels: [...m.runRels],
				bbox: [
					roundCoordinate(west),
					roundCoordinate(south),
					roundCoordinate(east),
					roundCoordinate(north)
				],
				hasDownhill: true
			};
		}
		fs.writeFileSync(memberCachePath, JSON.stringify(memberCache));
		console.log(
			`Wrote ${memberCachePath} (${(fs.statSync(memberCachePath).size / 1024).toFixed(0)} kB)`
		);
	}

	console.log('\n--- filtering qualified areas ---');
	const qualified = new Map<string, SkiArea>();
	for (const [id, area] of skiAreas) {
		const m = memberCache[id];
		if (!m) continue;
		if (m.liftWays.length + m.liftRels.length === 0) continue;
		if (!m.hasDownhill) continue;
		qualified.set(id, area);
	}
	console.log(`Qualified (OSM lift + OSM downhill run): ${qualified.size}`);

	console.log('\n--- assigning slugs ---');
	const registry = loadRegistry();

	const soeldenOsmId = 'relation/15961562';
	if (!registry[soeldenOsmId]) {
		registry[soeldenOsmId] = {
			slug: 'soelden',
			name: 'Sölden',
			country: 'AT',
			center: [10.9606, 46.948]
		};
	}

	const areaKey = (area: SkiArea): string => {
		const osmSrc = area.sources?.find((s) => s.type === 'openstreetmap');
		if (osmSrc) return String(osmSrc.id);
		return `osk:${area.id}`;
	};

	interface AreaInfo {
		id: string;
		area: SkiArea;
		key: string;
		country: string;
		region?: string;
		center: [number, number];
		km: number;
	}

	const areaInfos: AreaInfo[] = [];
	for (const [id, area] of qualified) {
		const stats = area.statistics;
		const downhill = stats?.runs?.byActivity?.downhill?.byDifficulty ?? {};
		let km = 0;
		for (const d of Object.values(downhill)) {
			km += (d as { lengthInKm: number }).lengthInKm;
		}
		const country = area.places?.[0]?.iso3166_1Alpha2 ?? '';
		const region = area.places?.[0]?.localized?.en?.region ?? undefined;
		const mc = memberCache[id];
		const center: [number, number] =
			area.viewportHint?.center ??
			(mc
				? [
						roundCoordinate((mc.bbox[0] + mc.bbox[2]) / 2),
						roundCoordinate((mc.bbox[1] + mc.bbox[3]) / 2)
					]
				: [0, 0]);

		areaInfos.push({ id, area, key: areaKey(area), country, region, km, center });
	}

	areaInfos.sort((a, b) => b.km - a.km || a.id.localeCompare(b.id));

	const usedSlugs = new Set<string>();
	const areaToSlug = new Map<string, string>();

	const isHashSlug = (slug: string): boolean => /^resort-[0-9a-f]{6}$/.test(slug);

	for (const info of areaInfos) {
		if (registry[info.key]) {
			const reg = registry[info.key];
			const betterAvailable =
				isHashSlug(reg.slug) && toSlug(info.area.name, info.country).length >= MIN_SLUG_LENGTH;
			if (betterAvailable) continue;
			if (!usedSlugs.has(reg.slug)) {
				usedSlugs.add(reg.slug);
				areaToSlug.set(info.id, reg.slug);
			}
		}
	}

	let clashCount = 0;
	for (const info of areaInfos) {
		const { id, area, key, country, region, center } = info;
		if (areaToSlug.has(id)) continue;

		const canGenerate = toSlug(area.name, country).length >= MIN_SLUG_LENGTH;
		let matchedSlug: string | undefined;
		for (const [, entry] of Object.entries(registry)) {
			if (entry.country !== country || entry.name !== area.name || usedSlugs.has(entry.slug))
				continue;
			if (isHashSlug(entry.slug) && canGenerate) continue;
			const dist = haversineKm(center[0], center[1], entry.center[0], entry.center[1]);
			if (dist <= MAX_SLUG_MATCH_DISTANCE_KM) {
				matchedSlug = entry.slug;
				break;
			}
		}

		if (matchedSlug) {
			usedSlugs.add(matchedSlug);
			registry[key] = {
				slug: matchedSlug,
				name: area.name,
				country,
				center: [roundCoordinate(center[0]), roundCoordinate(center[1])]
			};
			areaToSlug.set(id, matchedSlug);
			continue;
		}

		let baseSlug = toSlug(area.name, country);
		if (baseSlug.length === 0) baseSlug = 'resort';

		let slug: string;
		if (!usedSlugs.has(baseSlug) && !RESERVED.has(baseSlug)) {
			slug = baseSlug;
		} else {
			clashCount++;
			const countryCandidate = country ? `${baseSlug}-${country.toLowerCase()}` : '';
			const regSlug = region ? toSlug(region, country) : '';
			const regionCandidate = regSlug ? `${baseSlug}-${regSlug}` : '';
			const oskCandidate = `${baseSlug}-${id.slice(0, 6)}`;

			if (countryCandidate && !usedSlugs.has(countryCandidate) && !RESERVED.has(countryCandidate)) {
				slug = countryCandidate;
			} else if (
				regionCandidate &&
				!usedSlugs.has(regionCandidate) &&
				!RESERVED.has(regionCandidate)
			) {
				slug = regionCandidate;
			} else if (!usedSlugs.has(oskCandidate) && !RESERVED.has(oskCandidate)) {
				slug = oskCandidate;
			} else {
				let resolved = '';
				for (let len = 7; len <= id.length; len++) {
					const cand = `${baseSlug}-${id.slice(0, len)}`;
					if (!usedSlugs.has(cand)) {
						resolved = cand;
						break;
					}
				}
				if (!resolved) {
					let n = 2;
					while (usedSlugs.has(`${baseSlug}-${n}`)) n++;
					resolved = `${baseSlug}-${n}`;
				}
				slug = resolved;
			}
		}

		usedSlugs.add(slug);
		registry[key] = {
			slug,
			name: area.name,
			country,
			center: [roundCoordinate(center[0]), roundCoordinate(center[1])]
		};
		areaToSlug.set(id, slug);
	}

	const isBuilt = (slug: string): boolean =>
		fs.existsSync(`static/data/${slug}.json`) && fs.existsSync(`static/data/${slug}-terrain.json`);

	const webcamCount = (slug: string): number => {
		const file = `static/data/${slug}-webcams.json`;
		if (!fs.existsSync(file)) return 0;
		try {
			return (JSON.parse(fs.readFileSync(file, 'utf8')) as unknown[]).length;
		} catch {
			return 0;
		}
	};

	console.log('\n--- building catalog ---');
	const resorts: CatalogResort[] = [];
	for (const info of areaInfos) {
		const { id, area, country, region, center, km } = info;
		const slug = areaToSlug.get(id);
		if (!slug) continue;

		const stats = area.statistics;
		const mc = memberCache[id];
		const liftCount = Object.values(stats?.lifts?.byType ?? {}).reduce(
			(s, v) => s + (v as { count: number }).count,
			0
		);

		const pisteKm: Partial<Record<Difficulty, number>> = {};
		for (const [key, d] of Object.entries(stats?.runs?.byActivity?.downhill?.byDifficulty ?? {})) {
			const difficulty = DIFFICULTIES[key];
			const length = (d as { lengthInKm: number }).lengthInKm;
			if (!difficulty || !Number.isFinite(length) || length <= 0) continue;
			pisteKm[difficulty] = Math.round(((pisteKm[difficulty] ?? 0) + length) * 10) / 10;
		}

		const webcams = webcamCount(slug);
		const skimap = Number(area.sources?.find((s) => s.type === 'skimap.org')?.id);
		const web = area.websites?.find((w) => /^https?:\/\//.test(w));
		const resort: CatalogResort = {
			id: slug,
			name: area.name,
			country,
			...(region ? { region } : {}),
			center: [roundCoordinate(center[0]), roundCoordinate(center[1])],
			bbox: mc.bbox,
			ele: [Math.round(stats?.minElevation ?? 0), Math.round(stats?.maxElevation ?? 0)],
			lifts: liftCount || mc.liftWays.length + mc.liftRels.length,
			km: Math.round(km * 10) / 10,
			...(Object.keys(pisteKm).length ? { pisteKm } : {}),
			built: isBuilt(slug),
			...(fs.existsSync(`static/data/${slug}-queues.json`) ? { cams: true } : {}),
			...(webcams ? { webcams } : {}),
			...(skimap > 0 ? { skimap } : {}),
			...(web ? { web } : {}),
			osk: id
		};
		resorts.push(resort);
	}

	const catalog: Catalog = {
		built: new Date().toISOString(),
		resorts
	};

	fs.mkdirSync('static/data', { recursive: true });
	const catalogJson = JSON.stringify(catalog);
	fs.writeFileSync('static/data/resorts.json', catalogJson);

	saveRegistry(registry);

	const gzipped = gzipSync(catalogJson);
	console.log(`\nResults:`);
	console.log(`  Areas in dump: ${totalAreas}`);
	console.log(`  Areas kept: ${resorts.length}`);
	console.log(`  Slug clashes resolved: ${clashCount}`);
	console.log(
		`  static/data/resorts.json: ${(catalogJson.length / 1024).toFixed(1)} kB raw, ${(gzipped.length / 1024).toFixed(1)} kB gzipped`
	);
	console.log(`  Built resorts: ${resorts.filter((r) => r.built).length}`);
}

if (import.meta.main) {
	main().catch((err) => {
		console.error('Fatal:', err);
		process.exit(1);
	});
}
