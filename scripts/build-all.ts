import fs from 'node:fs';
import path from 'node:path';
import type { Catalog, CatalogResort } from '../src/lib/resort/catalog.ts';
import { buildResortStep } from './build-resort.ts';
import { buildTerrainStep } from './build-terrain.ts';
import { CATALOG_PATH, hasBuiltResort, syncCatalogFiles } from './catalog-files.ts';
import { fetchDem } from './fetch-dem.ts';
import { fetchOsm } from './fetch-osm.ts';
import { resortConfigFor } from './resorts.ts';

const BUILD_LOG_PATH = path.resolve(process.cwd(), 'data/build-log.jsonl');
const RECENT_FAILURE_WINDOW_SIZE = 50;
const MAX_FAILURES_IN_WINDOW = 10;
const DELAY_BETWEEN_RESORTS_MS = 3000;

export interface BuildLogEntry {
	id: string;
	ok: boolean;
	seconds: {
		osm: number;
		dem: number;
		resort: number;
		terrain: number;
		total: number;
	};
	lifts: number;
	pistes: number;
	kmOurs: number;
	kmCatalogue: number;
	km: {
		ours: number;
		catalogue: number;
	};
	bytes: {
		resort: number;
		terrain: number;
		total: number;
	};
	warnings: string[];
	error: string | null;
}

function appendBuildLog(entry: BuildLogEntry): void {
	fs.mkdirSync(path.dirname(BUILD_LOG_PATH), { recursive: true });
	fs.appendFileSync(BUILD_LOG_PATH, JSON.stringify(entry) + '\n', 'utf8');
}

function cleanUpEmptyBuildArtifacts(id: string): void {
	for (const file of [
		`data/raw/${id}-osm.json`,
		`static/data/${id}.json`,
		`static/data/${id}-terrain.json`
	]) {
		fs.rmSync(file, { force: true });
	}
}

function collectGarbage(): void {
	const globalBun = (globalThis as unknown as { Bun?: { gc?: (force: boolean) => void } }).Bun;
	if (typeof globalBun?.gc === 'function') {
		globalBun.gc(true);
	}
}

export interface BuildAllOptions {
	top?: number;
	ids?: string[];
	ranks?: number[];
	force?: boolean;
}

export function parseArgs(argv: string[]): BuildAllOptions {
	const opts: BuildAllOptions = {};
	for (let i = 2; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === '--force') {
			opts.force = true;
		} else if (arg === '--top') {
			const val = argv[++i];
			if (val) opts.top = parseInt(val, 10);
		} else if (arg.startsWith('--top=')) {
			opts.top = parseInt(arg.slice(6), 10);
		} else if (arg === '--ids') {
			const val = argv[++i];
			if (val)
				opts.ids = val
					.split(',')
					.map((s) => s.trim())
					.filter(Boolean);
		} else if (arg.startsWith('--ids=')) {
			opts.ids = arg
				.slice(6)
				.split(',')
				.map((s) => s.trim())
				.filter(Boolean);
		} else if (arg === '--ranks') {
			const val = argv[++i];
			if (val)
				opts.ranks = val
					.split(',')
					.map((s) => parseInt(s.trim(), 10))
					.filter(Number.isFinite);
		} else if (arg.startsWith('--ranks=')) {
			opts.ranks = arg
				.slice(8)
				.split(',')
				.map((s) => parseInt(s.trim(), 10))
				.filter(Number.isFinite);
		}
	}
	return opts;
}

export async function buildResortPipeline(
	resortInfo: CatalogResort,
	options?: { force?: boolean; mirrorOffset?: number }
): Promise<BuildLogEntry> {
	const id = resortInfo.id;
	const warnings: string[] = [];
	const force = options?.force ?? false;
	const seconds = { osm: 0, dem: 0, resort: 0, terrain: 0, total: 0 };
	const startTime = performance.now();

	try {
		console.log(`\n============================================================`);
		console.log(
			`>>> Building ${resortInfo.name} (${id}) - ${resortInfo.km} km, ${resortInfo.lifts} lifts`
		);
		console.log(`============================================================`);

		const cfg = await resortConfigFor(id);

		console.log(`[1/4] Fetching OSM data...`);
		const osmRes = await fetchOsm(cfg, { force, mirrorOffset: options?.mirrorOffset });
		seconds.osm = osmRes.durationSec;
		warnings.push(...osmRes.warnings);

		console.log(`[2/4] Fetching DEM elevation grids...`);
		const demRes = await fetchDem(cfg, { force });
		seconds.dem = demRes.durationSec;

		console.log(`[3/4] Building resort data...`);
		const resortRes = await buildResortStep(cfg, { force });
		seconds.resort = resortRes.durationSec;
		warnings.push(...resortRes.warnings);
		const { lifts, pistes } = resortRes.resort;
		if (!lifts.length || !pistes.length) {
			throw new Error(`empty build: ${lifts.length} lifts, ${pistes.length} pistes`);
		}

		console.log(`[4/4] Computing terrain model...`);
		const terrainRes = await buildTerrainStep(
			cfg,
			resortRes.skipped ? undefined : resortRes.resort,
			{ force }
		);
		seconds.terrain = terrainRes.durationSec;

		seconds.total = +((performance.now() - startTime) / 1000).toFixed(2);

		const entry: BuildLogEntry = {
			id,
			ok: true,
			seconds,
			lifts: resortRes.resort.lifts.length,
			pistes: resortRes.resort.pistes.length,
			kmOurs: resortRes.pisteKm,
			kmCatalogue: resortInfo.km,
			km: {
				ours: resortRes.pisteKm,
				catalogue: resortInfo.km
			},
			bytes: {
				resort: resortRes.bytes,
				terrain: terrainRes.bytes,
				total: resortRes.bytes + terrainRes.bytes
			},
			warnings,
			error: null
		};

		appendBuildLog(entry);
		console.log(
			`[DONE] ${id}: OK in ${seconds.total} s (lifts: ${entry.lifts}, km: ${entry.kmOurs} vs cat ${entry.kmCatalogue})`
		);
		return entry;
	} catch (err) {
		seconds.total = +((performance.now() - startTime) / 1000).toFixed(2);
		const errorMsg = (err as Error).message ?? String(err);
		if (errorMsg.startsWith('empty build:')) {
			cleanUpEmptyBuildArtifacts(id);
		}
		console.error(`[FAILED] ${id}: ${errorMsg} (${seconds.total} s)`);

		const entry: BuildLogEntry = {
			id,
			ok: false,
			seconds,
			lifts: 0,
			pistes: 0,
			kmOurs: 0,
			kmCatalogue: resortInfo.km,
			km: {
				ours: 0,
				catalogue: resortInfo.km
			},
			bytes: {
				resort: 0,
				terrain: 0,
				total: 0
			},
			warnings,
			error: errorMsg
		};

		appendBuildLog(entry);
		return entry;
	} finally {
		collectGarbage();
	}
}

export async function main(): Promise<void> {
	const opts = parseArgs(process.argv);
	const catFile = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8')) as Catalog;
	const allResorts = catFile.resorts;

	const selectedIds = new Set<string>();

	if (opts.ids && opts.ids.length > 0) {
		for (const id of opts.ids) selectedIds.add(id);
	}

	if (opts.ranks && opts.ranks.length > 0) {
		for (const rank of opts.ranks) {
			if (rank >= 1 && rank <= allResorts.length) {
				selectedIds.add(allResorts[rank - 1].id);
			}
		}
	}

	if (opts.top !== undefined && opts.top > 0) {
		for (let i = 0; i < Math.min(opts.top, allResorts.length); i++) {
			selectedIds.add(allResorts[i].id);
		}
	}

	let targetResorts: CatalogResort[];
	if (selectedIds.size > 0) {
		targetResorts = allResorts.filter((r) => selectedIds.has(r.id));
	} else {
		targetResorts = allResorts;
	}

	console.log(`Found ${allResorts.length} resorts in catalogue.`);
	console.log(
		`Targeting ${targetResorts.length} resorts (largest first). Force: ${opts.force ?? false}`
	);

	let processedCount = 0;
	let successCount = 0;
	let failCount = 0;
	let skipCount = 0;

	const recentBuildResults: boolean[] = [];

	for (let i = 0; i < targetResorts.length; i++) {
		const r = targetResorts[i];
		if (!opts.force && hasBuiltResort(r.id)) {
			console.log(
				`[${i + 1}/${targetResorts.length}] Skipping ${r.id} (map and terrain already built)`
			);
			skipCount++;
			continue;
		}

		processedCount++;
		console.log(`\n--- Resort [${i + 1}/${targetResorts.length}] ---`);
		const result = await buildResortPipeline(r, { force: opts.force, mirrorOffset: i });
		if (result.ok) {
			successCount++;
		} else {
			failCount++;
		}

		const succeeded = result.ok || /^empty build/.test(result.error ?? '');
		recentBuildResults.push(succeeded);
		if (recentBuildResults.length > RECENT_FAILURE_WINDOW_SIZE) recentBuildResults.shift();
		const recentFailures = recentBuildResults.filter((succeeded) => !succeeded).length;
		if (
			recentBuildResults.length >= RECENT_FAILURE_WINDOW_SIZE &&
			recentFailures > MAX_FAILURES_IN_WINDOW
		) {
			console.log(
				`\nStopping: ${recentFailures} of the last ${recentBuildResults.length} resorts failed (threshold ${MAX_FAILURES_IN_WINDOW}).`
			);
			break;
		}

		await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_RESORTS_MS));
	}

	console.log(`\n============================================================`);
	console.log(`Pipeline run finished.`);
	console.log(
		`Total target: ${targetResorts.length}, Processed: ${processedCount}, Succeeded: ${successCount}, Failed: ${failCount}, Previously built / skipped: ${skipCount}`
	);
	console.log(`============================================================`);

	syncCatalogFiles();
}

if (import.meta.main) {
	main().catch((err) => {
		console.error('Fatal pipeline error:', err);
		process.exit(1);
	});
}
