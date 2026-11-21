import { APP_USER_AGENT } from '#lib/identity.ts';
import fs from 'node:fs';
import path from 'node:path';
import type { ResortConfig } from './resorts.ts';
import { resortFromArgs } from './resorts.ts';

const MIRRORS = [
	'https://overpass.openstreetmap.fr/api/interpreter',
	'https://overpass.private.coffee/api/interpreter',
	'https://overpass-api.de/api/interpreter',
	'https://overpass.kumi.systems/api/interpreter'
];

export interface FetchOsmOptions {
	force?: boolean;
	maxRetries?: number;
	mirrorOffset?: number;
}

export interface FetchOsmResult {
	path: string;
	elementCount: number;
	durationSec: number;
	skipped: boolean;
	warnings: string[];
}

let lastOverpassRequestTime = 0;

const mirrorRestUntil = new Map<string, number>();
const MIRROR_REST_MS = 30 * 60_000;
const OVERPASS_MIN_INTERVAL_MS = 2000;
const OVERPASS_TIMEOUT_MS = 90_000;
const RETRY_BACKOFF_PER_ATTEMPT_MS = 5000;
const RATE_LIMIT_BACKOFF_MS = 5000;
const DEFAULT_MAX_RETRIES = 2;

async function throttleOverpass(minIntervalMs: number = OVERPASS_MIN_INTERVAL_MS): Promise<void> {
	const elapsed = Date.now() - lastOverpassRequestTime;
	if (elapsed < minIntervalMs) {
		await new Promise((resolve) => setTimeout(resolve, minIntervalMs - elapsed));
	}
}

export async function fetchOsm(
	cfg: ResortConfig,
	options?: FetchOsmOptions
): Promise<FetchOsmResult> {
	const outPath = path.resolve(process.cwd(), `data/raw/${cfg.id}-osm.json`);
	const warnings: string[] = [];

	if (!options?.force && fs.existsSync(outPath)) {
		try {
			const text = fs.readFileSync(outPath, 'utf8');
			const parsed = JSON.parse(text) as { elements?: unknown[] };
			const count = parsed.elements?.length ?? 0;
			return {
				path: outPath,
				elementCount: count,
				durationSec: 0,
				skipped: true,
				warnings
			};
		} catch (err) {
			console.warn(`Existing OSM file corrupted for ${cfg.id}, re-fetching:`, err);
		}
	}

	const bb = cfg.queryBbox.join(',');
	const query = `[out:json][timeout:120];(\nway["piste:type"](${bb});relation["piste:type"](${bb});\nway["aerialway"](${bb});node["aerialway"](${bb});\nrelation["route"="piste"](${bb});relation["site"="piste"](${bb});\nnode["amenity"~"restaurant|cafe|bar|toilets|first_aid"](${bb});\nnode["tourism"~"alpine_hut|viewpoint"](${bb});\nway["amenity"~"restaurant|cafe|bar"](${bb});way["tourism"="alpine_hut"](${bb});\nnode["natural"="peak"](${bb});\n);out body;>;out skel qt;`;

	const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
	const started = performance.now();
	let text: string | undefined;
	let lastError: unknown;

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		if (attempt > 0) {
			const backoffDelay = RETRY_BACKOFF_PER_ATTEMPT_MS * attempt;
			console.warn(
				`[fetch-osm] Retry attempt ${attempt}/${maxRetries} for ${cfg.id} after ${backoffDelay} ms...`
			);
			await new Promise((r) => setTimeout(r, backoffDelay));
		}

		const offset =
			(((options?.mirrorOffset ?? 0) % MIRRORS.length) + MIRRORS.length) % MIRRORS.length;
		const rotated = [...MIRRORS.slice(offset), ...MIRRORS.slice(0, offset)];
		const rested = rotated.filter((url) => (mirrorRestUntil.get(url) ?? 0) <= Date.now());
		const orderedMirrors = rested.length ? rested : rotated;

		for (const url of orderedMirrors) {
			await throttleOverpass(OVERPASS_MIN_INTERVAL_MS);
			lastOverpassRequestTime = Date.now();
			try {
				const res = await fetch(url, {
					method: 'POST',
					headers: { 'User-Agent': APP_USER_AGENT },
					body: new URLSearchParams({ data: query }),
					signal: AbortSignal.timeout(OVERPASS_TIMEOUT_MS)
				});

				if (res.status === 429 || res.status === 504) {
					console.warn(`[fetch-osm] ${url}: HTTP ${res.status} - backing off 5s...`);
					mirrorRestUntil.set(url, Date.now() + MIRROR_REST_MS);
					await new Promise((r) => setTimeout(r, RATE_LIMIT_BACKOFF_MS));
					continue;
				}

				if (!res.ok) {
					console.warn(`[fetch-osm] ${url}: HTTP ${res.status}`);
					mirrorRestUntil.set(url, Date.now() + MIRROR_REST_MS);
					continue;
				}

				const resText = await res.text();
				const parsed = JSON.parse(resText) as { elements?: unknown[]; remark?: string };
				if (parsed.remark && !parsed.elements) {
					console.warn(`[fetch-osm] ${url} returned remark error: ${parsed.remark}`);
					continue;
				}
				if (!Array.isArray(parsed.elements)) {
					console.warn(`[fetch-osm] ${url} returned no elements array`);
					continue;
				}
				const expectedResortWayIds = cfg.liftWays.length ? cfg.liftWays : cfg.runWays;
				const receivedWayIds = new Set(
					(parsed.elements as { type?: string; id?: number }[])
						.filter((e) => e.type === 'way')
						.map((e) => e.id)
				);
				const hasAtLeastOneExpectedWay =
					!expectedResortWayIds.length || expectedResortWayIds.some((id) => receivedWayIds.has(id));
				if (!hasAtLeastOneExpectedWay) {
					lastError = new Error(`${url} answered without any of the resort's ways`);
					console.warn(
						`[fetch-osm] ${(lastError as Error).message} (${parsed.elements.length} elements)`
					);
					mirrorRestUntil.set(url, Date.now() + MIRROR_REST_MS);
					continue;
				}

				text = resText;
				break;
			} catch (err) {
				lastError = err;
				mirrorRestUntil.set(url, Date.now() + MIRROR_REST_MS);
				console.warn(`[fetch-osm] ${url}: ${(err as Error).message}`);
			}
		}

		if (text) break;
	}

	if (!text) {
		throw new Error(
			`All Overpass mirrors failed for ${cfg.id}: ${lastError ? (lastError as Error).message : 'unknown error'}`
		);
	}

	const parsed = JSON.parse(text) as { elements: unknown[] };
	fs.mkdirSync(path.dirname(outPath), { recursive: true });
	fs.writeFileSync(outPath, text);

	const durationSec = +((performance.now() - started) / 1000).toFixed(2);
	console.log(`data/raw/${cfg.id}-osm.json: ${parsed.elements.length} elements (${durationSec} s)`);

	return {
		path: outPath,
		elementCount: parsed.elements.length,
		durationSec,
		skipped: false,
		warnings
	};
}

if (import.meta.main) {
	const cfg = await resortFromArgs();
	const force = process.argv.includes('--force');
	await fetchOsm(cfg, { force });
}
