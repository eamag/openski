import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { TerrainData } from '../src/lib/conditions/terrain-types.ts';
import type { ResortData } from '../src/lib/resort/types.ts';
import { syncCatalogFiles } from './catalog-files.ts';
import { loadDem } from './lib/dem.ts';
import { computeTerrain } from './lib/terrain.ts';
import type { ResortConfig } from './resorts.ts';
import { resortIdFromArgs } from './resorts.ts';

export interface BuildTerrainResult {
	terrain: TerrainData;
	durationSec: number;
	bytes: number;
	skipped: boolean;
}

export async function buildTerrainStep(
	cfg: Pick<ResortConfig, 'id'>,
	resort?: ResortData,
	options?: { force?: boolean }
): Promise<BuildTerrainResult> {
	const terrainPath = `static/data/${cfg.id}-terrain.json`;

	const resortData =
		resort ?? (JSON.parse(readFileSync(`static/data/${cfg.id}.json`, 'utf8')) as ResortData);

	if (!options?.force && existsSync(terrainPath)) {
		const json = readFileSync(terrainPath, 'utf8');
		const terrain = JSON.parse(json) as TerrainData;
		const isTerrainMatchingResortBuild = terrain.version === resortData.version;
		if (isTerrainMatchingResortBuild) {
			return { terrain, durationSec: 0, bytes: Buffer.byteLength(json), skipped: true };
		}
	}

	const started = performance.now();
	const terrain = computeTerrain(resortData, loadDem(cfg.id, 'local'), loadDem(cfg.id, 'wide'));
	const json = JSON.stringify(terrain);
	writeFileSync(terrainPath, json);

	const pistes = resortData.edges.flatMap((e, i) => (e.k === 'p' ? [i] : []));
	const MIDDAY_SOUTH_AZIMUTH_BIN_OFFSET = terrain.bins / 2;
	const WINTER_SOLSTICE_MIDDAY_SOLAR_ELEVATION_DEG = 19.6;
	const HORIZON_ENCODING_SCALE = 2;

	const shaded = pistes.filter((pisteEdgeIndex) => {
		const southHorizonElevationDeg =
			terrain.horizon[pisteEdgeIndex * terrain.bins + MIDDAY_SOUTH_AZIMUTH_BIN_OFFSET] /
			HORIZON_ENCODING_SCALE;
		return southHorizonElevationDeg > WINTER_SOLSTICE_MIDDAY_SOLAR_ELEVATION_DEG;
	}).length;
	const durationSec = +((performance.now() - started) / 1000).toFixed(2);
	const bytes = Buffer.byteLength(json);

	console.log(
		`static/data/${cfg.id}-terrain.json: ${(bytes / 1024).toFixed(0)} kB, ${pistes.length} piste segments, ` +
			`${shaded} without midday sun on 21 Dec, ${Math.round(performance.now() - started)} ms`
	);

	return {
		terrain,
		durationSec,
		bytes,
		skipped: false
	};
}

if (import.meta.main) {
	const cfg = { id: resortIdFromArgs() };
	const force = process.argv.includes('--force');
	await buildTerrainStep(cfg, undefined, { force });
	syncCatalogFiles(cfg.id);
}
