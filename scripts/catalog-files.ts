import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import type { TerrainData } from '../src/lib/conditions/terrain-types.ts';
import type { Catalog } from '../src/lib/resort/catalog.ts';
import type { ResortData } from '../src/lib/resort/types.ts';

export const CATALOG_PATH = 'static/data/resorts.json';

function readData<T>(file: string): T | undefined {
	try {
		return JSON.parse(readFileSync(`static/data/${file}.json`, 'utf8')) as T;
	} catch {
		return undefined;
	}
}

export function hasBuiltResort(id: string): boolean {
	const resort = readData<ResortData>(id);
	if (!resort?.version || (!resort.lifts?.length && !resort.pistes?.length)) return false;
	const hasMatchingTerrainVersion =
		readData<TerrainData>(`${id}-terrain`)?.version === resort.version;
	return hasMatchingTerrainVersion;
}

export function syncCatalogFiles(id?: string): void {
	const catalogue = JSON.parse(readFileSync(CATALOG_PATH, 'utf8')) as Catalog;
	const before = JSON.stringify(catalogue.resorts);
	for (const resort of catalogue.resorts) {
		if (id && resort.id !== id) continue;
		resort.built = hasBuiltResort(resort.id);
		const queueCameras = readData<unknown>(`${resort.id}-queues`);
		const osmWebcams = readData<unknown>(`${resort.id}-webcams`);
		const hasQueueCameras = Array.isArray(queueCameras) && queueCameras.length > 0;
		if (hasQueueCameras) resort.cams = true;
		else delete resort.cams;
		const hasOsmWebcams = Array.isArray(osmWebcams) && osmWebcams.length > 0;
		if (hasOsmWebcams) resort.webcams = osmWebcams.length;
		else delete resort.webcams;
	}
	const hasCatalogChanged = JSON.stringify(catalogue.resorts) !== before;
	if (!hasCatalogChanged) return;
	catalogue.built = new Date().toISOString();
	const temporaryPath = `${CATALOG_PATH}.${process.pid}.tmp`;
	writeFileSync(temporaryPath, JSON.stringify(catalogue));
	renameSync(temporaryPath, CATALOG_PATH);
	console.log(`Updated ${CATALOG_PATH}`);
}

if (import.meta.main) syncCatalogFiles();
