import type { ResortData } from '../../src/lib/resort/types.ts';
import {
	HORIZON_STEPS_PER_DEGREE,
	type TerrainData
} from '../../src/lib/conditions/terrain-types.ts';

export interface DemGrid {
	z: number;
	tileSize: number;
	x0: number;
	y0: number;
	width: number;
	height: number;
	data: Float32Array;
}

const HORIZON_AZIMUTH_BINS = 24;
const TPI_SAMPLE_DIRECTIONS = 8;
const DEGREES_IN_CIRCLE = 360;
const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const EARTH_RADIUS_METERS = 6371000;
const HAVERSINE_EARTH_RADIUS_METERS = 6371008.8;

const CENTRAL_DIFFERENCE_OFFSET_METERS = 30;
const CENTRAL_DIFFERENCE_BASELINE_METERS = 2 * CENTRAL_DIFFERENCE_OFFSET_METERS;
const TPI_INNER_RADIUS_METERS = 150;
const TPI_OUTER_RADIUS_METERS = 300;
const TPI_TOTAL_SAMPLE_COUNT = 16;
const OBSERVER_EYE_HEIGHT_METERS = 2;
const EARTH_CURVATURE_REFRACTION_FACTOR = 0.87;

const NEAR_HORIZON_MIN_DIST_METERS = 50;
const NEAR_HORIZON_MAX_DIST_METERS = 4000;
const NEAR_HORIZON_STEP_METERS = 25;
const FAR_HORIZON_MIN_DIST_METERS = 4150;
const FAR_HORIZON_MAX_DIST_METERS = 30000;
const FAR_HORIZON_STEP_METERS = 150;

const AZIMUTH_SINS: number[] = new Array(HORIZON_AZIMUTH_BINS);
const AZIMUTH_COSS: number[] = new Array(HORIZON_AZIMUTH_BINS);
for (let b = 0; b < HORIZON_AZIMUTH_BINS; b++) {
	const rad = b * (DEGREES_IN_CIRCLE / HORIZON_AZIMUTH_BINS) * RAD;
	AZIMUTH_SINS[b] = Math.sin(rad);
	AZIMUTH_COSS[b] = Math.cos(rad);
}

const TPI_SINS: number[] = new Array(TPI_SAMPLE_DIRECTIONS);
const TPI_COSS: number[] = new Array(TPI_SAMPLE_DIRECTIONS);
for (let k = 0; k < TPI_SAMPLE_DIRECTIONS; k++) {
	const rad = k * (DEGREES_IN_CIRCLE / TPI_SAMPLE_DIRECTIONS) * RAD;
	TPI_SINS[k] = Math.sin(rad);
	TPI_COSS[k] = Math.cos(rad);
}

function haversine(lon1: number, lat1: number, lon2: number, lat2: number): number {
	const dLat = (lat2 - lat1) * RAD;
	const dLon = (lon2 - lon1) * RAD;
	const s =
		Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLon / 2) ** 2;
	return 2 * HAVERSINE_EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function elevationAt(g: DemGrid, lon: number, lat: number): number {
	const uLon = (lon + 180) / 360;
	const phi = (lat * Math.PI) / 180;
	const sinPhi = Math.sin(phi);
	const vLat = 0.5 - Math.log((1 + sinPhi) / (1 - sinPhi)) / (4 * Math.PI);

	const numTiles = Math.pow(2, g.z);
	const px = (uLon * numTiles - g.x0) * g.tileSize;
	const py = (vLat * numTiles - g.y0) * g.tileSize;

	if (Number.isNaN(px) || Number.isNaN(py) || px < 0 || px > g.width || py < 0 || py > g.height) {
		return NaN;
	}

	const u = Math.max(0, Math.min(g.width - 1, px - 0.5));
	const v = Math.max(0, Math.min(g.height - 1, py - 0.5));

	const i0 = Math.floor(u);
	const j0 = Math.floor(v);
	const i1 = Math.min(i0 + 1, g.width - 1);
	const j1 = Math.min(j0 + 1, g.height - 1);

	const fx = u - i0;
	const fy = v - j0;

	const row0 = j0 * g.width;
	const row1 = j1 * g.width;

	const v00 = g.data[row0 + i0];
	const v10 = g.data[row0 + i1];
	const v01 = g.data[row1 + i0];
	const v11 = g.data[row1 + i1];

	const top = v00 + fx * (v10 - v00);
	const bottom = v01 + fx * (v11 - v01);
	return top + fy * (bottom - top);
}

function getEdgeMidpoint(resort: ResortData, edgeIndex: number): [number, number] {
	const e = resort.edges[edgeIndex];
	const a = resort.nodes[e.a];
	const b = resort.nodes[e.b];

	if (!e.g || e.g.length === 0) {
		return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
	}

	const lons: number[] = [a[0]];
	const lats: number[] = [a[1]];
	for (let i = 0; i < e.g.length; i += 2) {
		lons.push(e.g[i]);
		lats.push(e.g[i + 1]);
	}
	lons.push(b[0]);
	lats.push(b[1]);

	const n = lons.length;
	const segLens: number[] = new Array(n - 1);
	let totalLen = 0;
	for (let i = 0; i < n - 1; i++) {
		const d = haversine(lons[i], lats[i], lons[i + 1], lats[i + 1]);
		segLens[i] = d;
		totalLen += d;
	}

	if (totalLen <= 0) {
		return [a[0], a[1]];
	}

	const halfLen = totalLen / 2;
	let accumulated = 0;
	for (let i = 0; i < segLens.length; i++) {
		const d = segLens[i];
		if (i === segLens.length - 1 || accumulated + d >= halfLen) {
			const t = d > 0 ? Math.max(0, Math.min(1, (halfLen - accumulated) / d)) : 0;
			return [lons[i] + t * (lons[i + 1] - lons[i]), lats[i] + t * (lats[i + 1] - lats[i])];
		}
		accumulated += d;
	}

	return [b[0], b[1]];
}

function sampleElevation(local: DemGrid, wide: DemGrid, lon: number, lat: number): number {
	let z = elevationAt(local, lon, lat);
	if (Number.isNaN(z)) {
		z = elevationAt(wide, lon, lat);
	}
	return z;
}

export function computeTerrain(resort: ResortData, local: DemGrid, wide: DemGrid): TerrainData {
	const nEdges = resort.edges.length;
	const aspect = new Array<number>(nEdges);
	const slope = new Array<number>(nEdges);
	const tpi = new Array<number>(nEdges);
	const horizon = new Array<number>(nEdges * HORIZON_AZIMUTH_BINS);

	for (let i = 0; i < nEdges; i++) {
		const e = resort.edges[i];
		if (e.k !== 'p') {
			aspect[i] = -1;
			slope[i] = -1;
			tpi[i] = 0;
			const offset = i * HORIZON_AZIMUTH_BINS;
			for (let b = 0; b < HORIZON_AZIMUTH_BINS; b++) {
				horizon[offset + b] = 0;
			}
			continue;
		}

		const [lon0, lat0] = getEdgeMidpoint(resort, i);

		const mPerDegLat = RAD * EARTH_RADIUS_METERS;
		const mPerDegLon = RAD * EARTH_RADIUS_METERS * Math.cos(lat0 * RAD);
		const degPerMLat = 1 / mPerDegLat;
		const degPerMLon = 1 / mPerDegLon;

		const midEle = sampleElevation(local, wide, lon0, lat0);

		const dLon30 = CENTRAL_DIFFERENCE_OFFSET_METERS * degPerMLon;
		const dLat30 = CENTRAL_DIFFERENCE_OFFSET_METERS * degPerMLat;

		const zEast = sampleElevation(local, wide, lon0 + dLon30, lat0);
		const zWest = sampleElevation(local, wide, lon0 - dLon30, lat0);
		const zNorth = sampleElevation(local, wide, lon0, lat0 + dLat30);
		const zSouth = sampleElevation(local, wide, lon0, lat0 - dLat30);

		const dzdx = (zEast - zWest) / CENTRAL_DIFFERENCE_BASELINE_METERS;
		const dzdy = (zNorth - zSouth) / CENTRAL_DIFFERENCE_BASELINE_METERS;

		const gradMag = Math.hypot(dzdx, dzdy);
		const slopeDeg = Math.atan(gradMag) * DEG;
		slope[i] = Math.round(slopeDeg * 10) / 10;

		if (gradMag < 1e-9) {
			aspect[i] = 0;
		} else {
			let aspDeg = Math.atan2(-dzdx, -dzdy) * DEG;
			aspDeg = ((aspDeg % 360) + 360) % 360;
			let aspRound = Math.round(aspDeg);
			if (aspRound === 360) aspRound = 0;
			aspect[i] = aspRound;
		}

		let tpiSum = 0;
		for (let k = 0; k < TPI_SAMPLE_DIRECTIONS; k++) {
			const sinT = TPI_SINS[k];
			const cosT = TPI_COSS[k];

			const lon150 = lon0 + TPI_INNER_RADIUS_METERS * sinT * degPerMLon;
			const lat150 = lat0 + TPI_INNER_RADIUS_METERS * cosT * degPerMLat;
			tpiSum += sampleElevation(local, wide, lon150, lat150);

			const lon300 = lon0 + TPI_OUTER_RADIUS_METERS * sinT * degPerMLon;
			const lat300 = lat0 + TPI_OUTER_RADIUS_METERS * cosT * degPerMLat;
			tpiSum += sampleElevation(local, wide, lon300, lat300);
		}
		const tpiMean = tpiSum / TPI_TOTAL_SAMPLE_COUNT;
		tpi[i] = Math.round(midEle - tpiMean);

		const eyeEle = midEle + OBSERVER_EYE_HEIGHT_METERS;
		const offset = i * HORIZON_AZIMUTH_BINS;

		for (let b = 0; b < HORIZON_AZIMUTH_BINS; b++) {
			const ux = AZIMUTH_SINS[b] * degPerMLon;
			const uy = AZIMUTH_COSS[b] * degPerMLat;

			let maxAngle = 0;

			for (
				let d = NEAR_HORIZON_MIN_DIST_METERS;
				d <= NEAR_HORIZON_MAX_DIST_METERS;
				d += NEAR_HORIZON_STEP_METERS
			) {
				const lon = lon0 + d * ux;
				const lat = lat0 + d * uy;
				let ele = elevationAt(local, lon, lat);
				if (Number.isNaN(ele)) {
					ele = elevationAt(wide, lon, lat);
				}
				if (!Number.isNaN(ele)) {
					const drop = ((d * d) / (2 * EARTH_RADIUS_METERS)) * EARTH_CURVATURE_REFRACTION_FACTOR;
					const effEle = ele - drop;
					const ang = Math.atan((effEle - eyeEle) / d);
					if (ang > maxAngle) maxAngle = ang;
				}
			}

			for (
				let d = FAR_HORIZON_MIN_DIST_METERS;
				d <= FAR_HORIZON_MAX_DIST_METERS;
				d += FAR_HORIZON_STEP_METERS
			) {
				const lon = lon0 + d * ux;
				const lat = lat0 + d * uy;
				const ele = elevationAt(wide, lon, lat);
				if (!Number.isNaN(ele)) {
					const drop = ((d * d) / (2 * EARTH_RADIUS_METERS)) * EARTH_CURVATURE_REFRACTION_FACTOR;
					const effEle = ele - drop;
					const ang = Math.atan((effEle - eyeEle) / d);
					if (ang > maxAngle) maxAngle = ang;
				}
			}

			let angDeg = maxAngle * DEG;
			if (angDeg < 0) angDeg = 0;
			if (angDeg > 90) angDeg = 90;
			horizon[offset + b] = Math.round(angDeg * HORIZON_STEPS_PER_DEGREE);
		}
	}

	return {
		version: resort.version,
		bins: HORIZON_AZIMUTH_BINS,
		aspect,
		slope,
		tpi,
		horizon
	};
}
