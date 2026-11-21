import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { ResortData } from '../src/lib/resort/types.ts';
import type { OsmElement } from './lib/build-resort.ts';
import { buildResort } from './lib/build-resort.ts';
import { elevationAt, loadDem } from './lib/dem.ts';
import type { ResortConfig } from './resorts.ts';
import { resortFromArgs } from './resorts.ts';

export interface BuildResortResult {
	resort: ResortData;
	durationSec: number;
	bytes: number;
	warnings: string[];
	pisteKm: number;
	skipped: boolean;
}

function calculateTotalPisteKm(resort: ResortData): number {
	const totalLengthMeters = resort.edges
		.filter((e) => e.k === 'p')
		.reduce((sum, edge) => sum + edge.len, 0);
	return Math.round((totalLengthMeters / 1000) * 10) / 10;
}

export async function buildResortStep(
	cfg: ResortConfig,
	options?: { force?: boolean }
): Promise<BuildResortResult> {
	const resortPath = `static/data/${cfg.id}.json`;
	const terrainPath = `static/data/${cfg.id}-terrain.json`;

	if (!options?.force && existsSync(resortPath) && existsSync(terrainPath)) {
		const json = readFileSync(resortPath, 'utf8');
		const resort = JSON.parse(json) as ResortData;
		if (resort.lifts.length || resort.pistes.length) {
			return {
				resort,
				durationSec: 0,
				bytes: Buffer.byteLength(json),
				warnings: [],
				pisteKm: calculateTotalPisteKm(resort),
				skipped: true
			};
		}
	}

	const started = performance.now();
	const rawOsmPath = `data/raw/${cfg.id}-osm.json`;
	if (!existsSync(rawOsmPath)) {
		throw new Error(`Raw OSM data for ${cfg.id} not found at ${rawOsmPath}`);
	}

	const raw = JSON.parse(readFileSync(rawOsmPath, 'utf8')) as {
		elements: OsmElement[];
	};
	const localDem = loadDem(cfg.id, 'local');
	let wideDem: ReturnType<typeof loadDem> | undefined;
	try {
		wideDem = loadDem(cfg.id, 'wide');
	} catch {
		wideDem = undefined;
	}

	const memberWays = new Set<number>([...cfg.liftWays, ...cfg.runWays]);
	const relIds = new Set<number>([...cfg.liftRels, ...cfg.runRels]);
	if (relIds.size > 0) {
		for (const el of raw.elements) {
			if (el.type === 'relation' && relIds.has(el.id)) {
				for (const m of el.members) {
					if (m.type === 'way') memberWays.add(m.ref);
				}
			}
		}
	}

	const warnings: string[] = [];
	const resort = buildResort({
		elements: raw.elements,
		memberWays,
		elevationAt: (lon, lat) => {
			let ele = elevationAt(localDem, lon, lat);
			if (Number.isNaN(ele) && wideDem) {
				ele = elevationAt(wideDem, lon, lat);
			}
			return ele;
		},
		meta: {
			id: cfg.id,
			name: cfg.name,
			timezone: cfg.timezone
		},
		warnings
	});

	if (!resort.lifts.length && !resort.pistes.length) {
		throw new Error(`empty build: ${resort.lifts.length} lifts, ${resort.pistes.length} pistes`);
	}

	mkdirSync('static/data', { recursive: true });
	const json = JSON.stringify(resort);
	writeFileSync(resortPath, json);

	const pisteKm = calculateTotalPisteKm(resort);
	const count = (k: string) => resort.edges.filter((e) => e.k === k).length;
	const durationSec = +((performance.now() - started) / 1000).toFixed(2);
	const bytes = Buffer.byteLength(json);

	console.log(
		`static/data/${cfg.id}.json: ${(bytes / 1024).toFixed(0)} kB, ${resort.nodes.length} nodes, ` +
			`${count('p')} piste segments (${pisteKm.toFixed(1)} km), ${count('l')} lift spans, ` +
			`${count('c')} links, ${resort.pistes.length} pistes (${resort.pistes.filter((p) => p.counted).length} counted), ` +
			`${resort.lifts.length} lifts, ${resort.areas.length} areas, ${resort.pois.length} POIs (${durationSec} s)`
	);

	return {
		resort,
		durationSec,
		bytes,
		warnings,
		pisteKm: Math.round(pisteKm * 10) / 10,
		skipped: false
	};
}

if (import.meta.main) {
	const cfg = await resortFromArgs();
	const force = process.argv.includes('--force');
	await buildResortStep(cfg, { force });
}
