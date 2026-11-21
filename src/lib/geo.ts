export type LngLat = [lon: number, lat: number];

const EARTH_RADIUS_METERS = 6371008.8;
const DEG_TO_RAD = Math.PI / 180;

export function haversine(from: LngLat, to: LngLat): number {
	const dLat = (to[1] - from[1]) * DEG_TO_RAD;
	const dLon = (to[0] - from[0]) * DEG_TO_RAD;
	const s =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(from[1] * DEG_TO_RAD) * Math.cos(to[1] * DEG_TO_RAD) * Math.sin(dLon / 2) ** 2;
	return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function bearing(from: LngLat, to: LngLat): number {
	const y = Math.sin((to[0] - from[0]) * DEG_TO_RAD) * Math.cos(to[1] * DEG_TO_RAD);
	const x =
		Math.cos(from[1] * DEG_TO_RAD) * Math.sin(to[1] * DEG_TO_RAD) -
		Math.sin(from[1] * DEG_TO_RAD) *
			Math.cos(to[1] * DEG_TO_RAD) *
			Math.cos((to[0] - from[0]) * DEG_TO_RAD);
	return (Math.atan2(y, x) / DEG_TO_RAD + 360) % 360;
}

export function angleDiff(bearingA: number, bearingB: number): number {
	const diff = Math.abs(bearingA - bearingB) % 360;
	return diff > 180 ? 360 - diff : diff;
}

export class LocalProjection {
	readonly kx: number;
	readonly ky: number;
	constructor(
		readonly lon0: number,
		readonly lat0: number
	) {
		this.ky = EARTH_RADIUS_METERS * DEG_TO_RAD;
		this.kx = EARTH_RADIUS_METERS * DEG_TO_RAD * Math.cos(lat0 * DEG_TO_RAD);
	}
	x(lon: number): number {
		return (lon - this.lon0) * this.kx;
	}
	y(lat: number): number {
		return (lat - this.lat0) * this.ky;
	}
	lon(x: number): number {
		return this.lon0 + x / this.kx;
	}
	lat(y: number): number {
		return this.lat0 + y / this.ky;
	}
}

export interface SegmentProjection {
	t: number;
	x: number;
	y: number;
	d2: number;
}

export function projectOnSegment(
	px: number,
	py: number,
	ax: number,
	ay: number,
	bx: number,
	by: number
): SegmentProjection {
	const dx = bx - ax;
	const dy = by - ay;
	const l2 = dx * dx + dy * dy;
	let t = l2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / l2;
	t = t < 0 ? 0 : t > 1 ? 1 : t;
	const x = ax + t * dx;
	const y = ay + t * dy;
	return { t, x, y, d2: (px - x) ** 2 + (py - y) ** 2 };
}

export function segmentIntersection(
	ax: number,
	ay: number,
	bx: number,
	by: number,
	cx: number,
	cy: number,
	dx: number,
	dy: number
): { t: number; u: number; x: number; y: number } | null {
	const rx = bx - ax;
	const ry = by - ay;
	const sx = dx - cx;
	const sy = dy - cy;
	const den = rx * sy - ry * sx;
	if (Math.abs(den) < 1e-9) return null;
	const t = ((cx - ax) * sy - (cy - ay) * sx) / den;
	const u = ((cx - ax) * ry - (cy - ay) * rx) / den;
	const eps = 1e-6;
	if (t <= eps || t >= 1 - eps || u <= eps || u >= 1 - eps) return null;
	return { t, u, x: ax + t * rx, y: ay + t * ry };
}
