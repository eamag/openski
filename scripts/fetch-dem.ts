import { APP_USER_AGENT } from '#lib/identity.ts';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { resortFromArgs, type ResortConfig } from './resorts.ts';

const SHARP_MAX_CONCURRENCY = 2;
sharp.concurrency(SHARP_MAX_CONCURRENCY);

const TILE_SIZE = 512;
const AWS_SUBTILE_SIZE = 256;
const MAX_CONCURRENT_REQUESTS = 2;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 300;
const TERRARIUM_OFFSET_METERS = 32768;

function decodeTerrariumElevation(red: number, green: number, blue: number): number {
	return red * 256 + green + blue / 256 - TERRARIUM_OFFSET_METERS;
}

interface GridTarget {
	name: 'local' | 'wide';
	z: number;
	bbox: {
		minLon: number;
		maxLon: number;
		minLat: number;
		maxLat: number;
	};
}

function lon2tile(lon: number, z: number): number {
	return ((lon + 180) / 360) * Math.pow(2, z);
}

function lat2tile(lat: number, z: number): number {
	const phi = (lat * Math.PI) / 180;
	const sinPhi = Math.sin(phi);
	return (0.5 - Math.log((1 + sinPhi) / (1 - sinPhi)) / (4 * Math.PI)) * Math.pow(2, z);
}

function tile2lon(x: number, z: number): number {
	return (x / Math.pow(2, z)) * 360 - 180;
}

function tile2lat(y: number, z: number): number {
	const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
	return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

function createLimiter(concurrency: number) {
	let active = 0;
	const queue: (() => void)[] = [];

	return async function <T>(fn: () => Promise<T>): Promise<T> {
		if (active >= concurrency) {
			await new Promise<void>((resolve) => queue.push(resolve));
		}
		active++;
		try {
			return await fn();
		} finally {
			active--;
			if (queue.length > 0) {
				const next = queue.shift()!;
				next();
			}
		}
	};
}

const limitRequest = createLimiter(MAX_CONCURRENT_REQUESTS);

async function fetchWithRetry(url: string, retries: number): Promise<Buffer> {
	let lastError: unknown;
	for (let attempt = 0; attempt <= retries; attempt++) {
		try {
			const res = await limitRequest(() =>
				fetch(url, {
					headers: { 'User-Agent': APP_USER_AGENT }
				})
			);
			if (res.ok) {
				const ab = await res.arrayBuffer();
				return Buffer.from(ab);
			}
			lastError = new Error(`HTTP ${res.status} ${res.statusText}`);
		} catch (err) {
			lastError = err;
		}
		if (attempt < retries) {
			const delayMs = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
			await new Promise((r) => setTimeout(r, delayMs));
		}
	}
	throw lastError;
}

async function fetchAwsFallbackTile(z: number, x: number, y: number): Promise<Buffer> {
	console.warn(
		`[fallback] Mapterhorn tile ${z}/${x}/${y} failed after ${MAX_RETRIES} retries. Falling back to AWS terrarium tiles...`
	);

	const subTiles = [
		{ sx: 2 * x, sy: 2 * y, ox: 0, oy: 0 },
		{ sx: 2 * x + 1, sy: 2 * y, ox: AWS_SUBTILE_SIZE, oy: 0 },
		{ sx: 2 * x, sy: 2 * y + 1, ox: 0, oy: AWS_SUBTILE_SIZE },
		{ sx: 2 * x + 1, sy: 2 * y + 1, ox: AWS_SUBTILE_SIZE, oy: AWS_SUBTILE_SIZE }
	];

	const compositeRgb = Buffer.alloc(TILE_SIZE * TILE_SIZE * 3);

	for (const { sx, sy, ox, oy } of subTiles) {
		const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z + 1}/${sx}/${sy}.png`;
		const buf = await fetchWithRetry(url, MAX_RETRIES);
		const { data: raw, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });

		for (let r = 0; r < AWS_SUBTILE_SIZE; r++) {
			for (let c = 0; c < AWS_SUBTILE_SIZE; c++) {
				const targetIdx = ((oy + r) * TILE_SIZE + (ox + c)) * 3;
				const srcIdx = (r * AWS_SUBTILE_SIZE + c) * info.channels;
				compositeRgb[targetIdx] = raw[srcIdx];
				compositeRgb[targetIdx + 1] = raw[srcIdx + 1];
				compositeRgb[targetIdx + 2] = raw[srcIdx + 2];
			}
		}
	}

	return sharp(compositeRgb, {
		raw: { width: TILE_SIZE, height: TILE_SIZE, channels: 3 }
	})
		.webp({ lossless: true })
		.toBuffer();
}

async function getOrFetchTile(z: number, x: number, y: number): Promise<Buffer> {
	const cacheDir = path.resolve(process.cwd(), 'data/raw/dem-tiles', String(z), String(x));
	const cachePath = path.join(cacheDir, `${y}.webp`);

	if (fs.existsSync(cachePath)) {
		return fs.promises.readFile(cachePath);
	}

	const mapterhornUrl = `https://tiles.mapterhorn.com/${z}/${x}/${y}.webp`;
	let tileBuffer: Buffer;
	try {
		tileBuffer = await fetchWithRetry(mapterhornUrl, MAX_RETRIES);
	} catch (err) {
		console.warn(`[fetch-dem] Failed to fetch Mapterhorn tile ${z}/${x}/${y}: ${err}`);
		tileBuffer = await fetchAwsFallbackTile(z, x, y);
	}

	await fs.promises.mkdir(cacheDir, { recursive: true });
	await fs.promises.writeFile(cachePath, tileBuffer);
	return tileBuffer;
}

async function buildGrid(target: GridTarget, outDir: string) {
	const { name, z, bbox } = target;

	const tileXMin = Math.floor(lon2tile(bbox.minLon, z));
	const tileXMax = Math.floor(lon2tile(bbox.maxLon, z));
	const tileYMin = Math.floor(lat2tile(bbox.maxLat, z));
	const tileYMax = Math.floor(lat2tile(bbox.minLat, z));

	const numCols = tileXMax - tileXMin + 1;
	const numRows = tileYMax - tileYMin + 1;

	const width = numCols * TILE_SIZE;
	const height = numRows * TILE_SIZE;

	const actualMinLon = tile2lon(tileXMin, z);
	const actualMaxLon = tile2lon(tileXMin + numCols, z);
	const actualMaxLat = tile2lat(tileYMin, z);
	const actualMinLat = tile2lat(tileYMin + numRows, z);
	const actualBbox: [number, number, number, number] = [
		actualMinLon,
		actualMinLat,
		actualMaxLon,
		actualMaxLat
	];

	console.log(`\n=== Building ${name} DEM grid ===`);
	console.log(
		`Zoom: ${z}, Tiles: X [${tileXMin}..${tileXMax}] (${numCols}), Y [${tileYMin}..${tileYMax}] (${numRows})`
	);
	console.log(`Dimensions: ${width} x ${height} px (${(width * height).toLocaleString()} samples)`);
	console.log(
		`Covered BBox: lon [${actualMinLon.toFixed(4)}..${actualMaxLon.toFixed(4)}], lat [${actualMinLat.toFixed(4)}..${actualMaxLat.toFixed(4)}]`
	);

	const gridData = new Float32Array(width * height);

	const tileCoords: { x: number; y: number }[] = [];
	for (let y = tileYMin; y <= tileYMax; y++) {
		for (let x = tileXMin; x <= tileXMax; x++) {
			tileCoords.push({ x, y });
		}
	}

	const tileBuffers = await Promise.all(
		tileCoords.map(async ({ x, y }) => {
			const buf = await getOrFetchTile(z, x, y);
			return { x, y, buf };
		})
	);

	for (const { x, y, buf } of tileBuffers) {
		const { data: raw, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });

		const colOffset = (x - tileXMin) * TILE_SIZE;
		const rowOffset = (y - tileYMin) * TILE_SIZE;
		const channels = info.channels;

		for (let r = 0; r < TILE_SIZE; r++) {
			const mosaicRow = rowOffset + r;
			const mosaicRowOffset = mosaicRow * width;
			const tileRowOffset = r * TILE_SIZE;

			for (let c = 0; c < TILE_SIZE; c++) {
				const mosaicCol = colOffset + c;
				const tileIdx = (tileRowOffset + c) * channels;

				const red = raw[tileIdx];
				const green = raw[tileIdx + 1];
				const blue = raw[tileIdx + 2];

				gridData[mosaicRowOffset + mosaicCol] = decodeTerrariumElevation(red, green, blue);
			}
		}
	}

	let minEle = Infinity;
	let maxEle = -Infinity;
	let nanCount = 0;
	for (let i = 0; i < gridData.length; i++) {
		const v = gridData[i];
		if (Number.isNaN(v)) {
			nanCount++;
		} else {
			if (v < minEle) minEle = v;
			if (v > maxEle) maxEle = v;
		}
	}

	console.log(
		`Min elevation: ${minEle.toFixed(2)} m, Max elevation: ${maxEle.toFixed(2)} m (NaNs: ${nanCount})`
	);

	await fs.promises.mkdir(outDir, { recursive: true });

	const binPath = path.join(outDir, `${name}.bin`);
	await fs.promises.writeFile(
		binPath,
		Buffer.from(gridData.buffer, gridData.byteOffset, gridData.byteLength)
	);

	const jsonPath = path.join(outDir, `${name}.json`);
	const meta = {
		z,
		tileSize: TILE_SIZE,
		tileXMin,
		tileYMin,
		width,
		height,
		bbox: actualBbox,
		source: 'https://tiles.mapterhorn.com',
		fetchedAt: new Date().toISOString()
	};
	await fs.promises.writeFile(jsonPath, JSON.stringify(meta, null, 2));

	console.log(
		`Saved: ${jsonPath} and ${binPath} (${(gridData.byteLength / 1024 / 1024).toFixed(2)} MB)`
	);
}

export interface FetchDemResult {
	durationSec: number;
	skipped: boolean;
}

export async function fetchDem(
	cfg: ResortConfig,
	options?: { force?: boolean }
): Promise<FetchDemResult> {
	const [west, south, east, north] = cfg.memberBbox;

	const LOCAL_GRID_ZOOM = 12;
	const WIDE_GRID_ZOOM = 9;
	const LOCAL_MARGIN_DEG = 0.015;
	const WIDE_LON_MARGIN_DEG = 0.3;
	const WIDE_LAT_MARGIN_DEG = 0.2;

	const TARGETS: GridTarget[] = [
		{
			name: 'local',
			z: LOCAL_GRID_ZOOM,
			bbox: {
				minLon: west - LOCAL_MARGIN_DEG,
				maxLon: east + LOCAL_MARGIN_DEG,
				minLat: south - LOCAL_MARGIN_DEG,
				maxLat: north + LOCAL_MARGIN_DEG
			}
		},
		{
			name: 'wide',
			z: WIDE_GRID_ZOOM,
			bbox: {
				minLon: west - WIDE_LON_MARGIN_DEG,
				maxLon: east + WIDE_LON_MARGIN_DEG,
				minLat: south - WIDE_LAT_MARGIN_DEG,
				maxLat: north + WIDE_LAT_MARGIN_DEG
			}
		}
	];

	const outDir = path.resolve(process.cwd(), `data/dem/${cfg.id}`);
	const force = options?.force ?? false;
	if (
		!force &&
		fs.existsSync(path.join(outDir, 'local.bin')) &&
		fs.existsSync(path.join(outDir, 'local.json')) &&
		fs.existsSync(path.join(outDir, 'wide.bin')) &&
		fs.existsSync(path.join(outDir, 'wide.json'))
	) {
		console.log(`DEM grids for ${cfg.id} already exist in ${outDir}, skipping fetch.`);
		return { durationSec: 0, skipped: true };
	}

	console.log(`Building DEM grids for ${cfg.id} → ${outDir}`);
	const started = performance.now();

	for (const target of TARGETS) {
		await buildGrid(target, outDir);
	}
	const durationSec = +((performance.now() - started) / 1000).toFixed(2);
	console.log(`\nDEM tiles fetched and grids successfully built for ${cfg.id} (${durationSec} s).`);
	return { durationSec, skipped: false };
}

async function main() {
	const cfg = await resortFromArgs();
	const force = process.argv.includes('--force');
	await fetchDem(cfg, { force });
}

if (import.meta.main) {
	main().catch((err) => {
		console.error('Fatal error building DEM grids:', err);
		process.exit(1);
	});
}
