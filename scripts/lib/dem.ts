import fs from 'node:fs';
import path from 'node:path';

export interface DemGrid {
	z: number;
	tileSize: number;
	x0: number;
	y0: number;
	width: number;
	height: number;
	data: Float32Array;
}

export interface DemMetadata {
	z: number;
	tileSize: number;
	x0: number;
	y0: number;
	width: number;
	height: number;
	bbox: [minLon: number, minLat: number, maxLon: number, maxLat: number];
	source: string;
	fetchedAt: string;
}

const DEFAULT_FALLBACK_RESORT_ID = 'soelden';
const BYTES_PER_FLOAT32 = 4;
const SAMPLE_CENTER_OFFSET_PIXELS = 0.5;

export function loadDem(resortIdOrName: string, maybeName?: 'local' | 'wide'): DemGrid {
	let resortId: string;
	let name: 'local' | 'wide';
	if (maybeName !== undefined) {
		resortId = resortIdOrName;
		name = maybeName;
	} else if (resortIdOrName === 'local' || resortIdOrName === 'wide') {
		resortId = DEFAULT_FALLBACK_RESORT_ID;
		name = resortIdOrName;
	} else {
		throw new Error(`Invalid arguments to loadDem: ${resortIdOrName}, ${maybeName}`);
	}

	const dir = path.resolve(process.cwd(), `data/dem/${resortId}`);
	let jsonPath = path.join(dir, `${name}.json`);
	let binPath = path.join(dir, `${name}.bin`);

	if (!fs.existsSync(jsonPath)) {
		const fallbackDir = path.resolve(
			path.dirname(new URL(import.meta.url).pathname),
			`../../data/dem/${resortId}`
		);
		jsonPath = path.join(fallbackDir, `${name}.json`);
		binPath = path.join(fallbackDir, `${name}.bin`);
	}

	if (!fs.existsSync(jsonPath) || !fs.existsSync(binPath)) {
		throw new Error(`DEM grid for resort "${resortId}" (${name}) not found at ${jsonPath}`);
	}

	const metaRaw = fs.readFileSync(jsonPath, 'utf8');
	const meta: DemMetadata = JSON.parse(metaRaw);

	const binBuf = fs.readFileSync(binPath);
	const data = new Float32Array(
		binBuf.buffer,
		binBuf.byteOffset,
		binBuf.byteLength / BYTES_PER_FLOAT32
	);

	return {
		z: meta.z,
		tileSize: meta.tileSize,
		x0: meta.x0,
		y0: meta.y0,
		width: meta.width,
		height: meta.height,
		data
	};
}

function lonLatToPixel(grid: DemGrid, lon: number, lat: number): [number, number] {
	const u = (lon + 180) / 360;
	const phi = (lat * Math.PI) / 180;
	const sinPhi = Math.sin(phi);
	const v = 0.5 - Math.log((1 + sinPhi) / (1 - sinPhi)) / (4 * Math.PI);

	const numTiles = Math.pow(2, grid.z);
	const tileX = u * numTiles;
	const tileY = v * numTiles;

	const px = (tileX - grid.x0) * grid.tileSize;
	const py = (tileY - grid.y0) * grid.tileSize;

	return [px, py];
}

export function elevationAt(grid: DemGrid, lon: number, lat: number): number {
	const [px, py] = lonLatToPixel(grid, lon, lat);

	if (
		Number.isNaN(px) ||
		Number.isNaN(py) ||
		px < 0 ||
		px > grid.width ||
		py < 0 ||
		py > grid.height
	) {
		return NaN;
	}

	const sampleX = Math.max(0, Math.min(grid.width - 1, px - SAMPLE_CENTER_OFFSET_PIXELS));
	const sampleY = Math.max(0, Math.min(grid.height - 1, py - SAMPLE_CENTER_OFFSET_PIXELS));

	const colLeft = Math.floor(sampleX);
	const rowTop = Math.floor(sampleY);
	const colRight = Math.min(colLeft + 1, grid.width - 1);
	const rowBottom = Math.min(rowTop + 1, grid.height - 1);

	const fractionalCol = sampleX - colLeft;
	const fractionalRow = sampleY - rowTop;

	const rowTopOffset = rowTop * grid.width;
	const rowBottomOffset = rowBottom * grid.width;

	const elevationTopLeft = grid.data[rowTopOffset + colLeft];
	const elevationTopRight = grid.data[rowTopOffset + colRight];
	const elevationBottomLeft = grid.data[rowBottomOffset + colLeft];
	const elevationBottomRight = grid.data[rowBottomOffset + colRight];

	const interpolatedTop = elevationTopLeft + fractionalCol * (elevationTopRight - elevationTopLeft);
	const interpolatedBottom =
		elevationBottomLeft + fractionalCol * (elevationBottomRight - elevationBottomLeft);
	return interpolatedTop + fractionalRow * (interpolatedBottom - interpolatedTop);
}
