import type { addProtocol as AddProtocol } from 'maplibre-gl';
import { DEM_TILES } from './style.ts';

export const SLOPE_TILES = 'slope://{z}/{x}/{y}';

export const SLOPE_CLASSES = [
	{ from: 30, color: [245, 211, 59] },
	{ from: 35, color: [240, 140, 46] },
	{ from: 40, color: [215, 38, 61] },
	{ from: 45, color: [142, 68, 173] }
] as const;

const SLOPE_OVERLAY_ALPHA = 150;
const EARTH_EQUATORIAL_CIRCUMFERENCE_METERS = 40075016.686;
const TERRARIUM_ELEVATION_OFFSET_METERS = 32768;

function shade(
	rgba: Uint8ClampedArray,
	size: number,
	z: number,
	y: number
): Uint8ClampedArray<ArrayBuffer> {
	const ele = new Float32Array(size * size);
	for (let i = 0; i < ele.length; i++)
		ele[i] =
			rgba[i * 4] * 256 +
			rgba[i * 4 + 1] +
			rgba[i * 4 + 2] / 256 -
			TERRARIUM_ELEVATION_OFFSET_METERS;
	const out = new Uint8ClampedArray(size * size * 4);
	const n = 2 ** z;
	const slopeAngleTangentThresholds = SLOPE_CLASSES.map((c) => Math.tan((c.from * Math.PI) / 180));
	for (let row = 0; row < size; row++) {
		const lat = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + (row + 0.5) / size)) / n)));
		const metersPerPixel = (EARTH_EQUATORIAL_CIRCUMFERENCE_METERS * Math.cos(lat)) / (size * n);
		const up = Math.max(0, row - 1) * size;
		const here = row * size;
		const down = Math.min(size - 1, row + 1) * size;
		for (let col = 0; col < size; col++) {
			const l = Math.max(0, col - 1);
			const r = Math.min(size - 1, col + 1);
			const dx =
				(ele[up + r] +
					2 * ele[here + r] +
					ele[down + r] -
					(ele[up + l] + 2 * ele[here + l] + ele[down + l])) /
				(8 * metersPerPixel);
			const dy =
				(ele[down + l] +
					2 * ele[down + col] +
					ele[down + r] -
					(ele[up + l] + 2 * ele[up + col] + ele[up + r])) /
				(8 * metersPerPixel);
			const slopeGradientMagnitude = Math.hypot(dx, dy);
			let slopeClassIndex = -1;
			for (let c = 0; c < slopeAngleTangentThresholds.length; c++)
				if (slopeGradientMagnitude >= slopeAngleTangentThresholds[c]) slopeClassIndex = c;
			if (slopeClassIndex < 0) continue;
			const pixelByteOffset = (here + col) * 4;
			const [cr, cg, cb] = SLOPE_CLASSES[slopeClassIndex].color;
			out[pixelByteOffset] = cr;
			out[pixelByteOffset + 1] = cg;
			out[pixelByteOffset + 2] = cb;
			out[pixelByteOffset + 3] = SLOPE_OVERLAY_ALPHA;
		}
	}
	return out;
}

let registered = false;

export function setupSlopes(addProtocol: typeof AddProtocol): void {
	if (registered) return;
	registered = true;
	addProtocol('slope', async (params, abort) => {
		const [z, x, y] = params.url.slice('slope://'.length).split('/').map(Number);
		const url = DEM_TILES.replace('{z}', String(z))
			.replace('{x}', String(x))
			.replace('{y}', String(y));
		const res = await fetch(url, { signal: abort.signal });
		if (!res.ok) throw new Error(`elevation tile ${res.status}`);
		const bitmap = await createImageBitmap(await res.blob(), {
			colorSpaceConversion: 'none',
			premultiplyAlpha: 'none'
		});
		const size = bitmap.width;
		const canvas = new OffscreenCanvas(size, size);
		const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
		ctx.drawImage(bitmap, 0, 0);
		bitmap.close();
		const pixels = shade(ctx.getImageData(0, 0, size, size).data, size, z, y);
		ctx.putImageData(new ImageData(pixels, size, size), 0, 0);
		const png = await canvas.convertToBlob({ type: 'image/png' });
		return { data: await png.arrayBuffer() };
	});
}
