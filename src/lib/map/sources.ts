import type { Feature, FeatureCollection, LineString, Point, Polygon } from 'geojson';
import type { LngLat } from '../geo.ts';
import type { Resort } from '../resort/model.ts';
import { DRAG_LIFTS, type ResortData } from '../resort/types.ts';
import type { Webcam } from '../state/webcams.svelte.ts';

export const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };

export const fc = <G extends LineString | Point | Polygon>(
	features: Feature<G>[]
): FeatureCollection<G> => ({
	type: 'FeatureCollection',
	features
});

export const line = (
	coords: LngLat[],
	properties: Record<string, unknown> = {},
	id?: number
): Feature<LineString> => ({
	type: 'Feature',
	id,
	properties,
	geometry: { type: 'LineString', coordinates: coords }
});

const APPROX_METERS_PER_LATITUDE_DEGREE = 111320;
const MAJOR_LIFT_MIN_LENGTH_METERS = 350;
const STATION_DISPLAY_MIN_LIFT_LENGTH_METERS = 150;
const WEBCAM_VIEW_CONE_RADIUS_METERS = 250;
const DEFAULT_CAMERA_FOV_DEGREES = 60;
const OMNIDIRECTIONAL_FOV_THRESHOLD_DEGREES = 359;

export function resortSources(resort: Resort) {
	const { edges, pistes, lifts, areas, pois, nodes } = resort.data;

	const segments = fc(
		edges.flatMap((e, i) =>
			e.k === 'p' ? [line(resort.edgeCoords(i), { d: e.d, o: e.o, kind: 'piste' }, i)] : []
		)
	);

	const liftLines = fc(
		lifts.map((l, i) =>
			line(l.coords, {
				name: l.name,
				lift: i,
				kind: 'lift',
				drag: DRAG_LIFTS.has(l.type) ? 1 : 0,
				major: l.length > MAJOR_LIFT_MIN_LENGTH_METERS ? 1 : 0
			})
		)
	);

	const stationNodes = new Map<number, number>();
	lifts.forEach((l, i) => {
		if (l.length < STATION_DISPLAY_MIN_LIFT_LENGTH_METERS) return;
		for (const n of l.stations) if (!stationNodes.has(n)) stationNodes.set(n, i);
	});
	const stations = fc(
		[...stationNodes].map(([n, lift]): Feature<Point> => ({
			type: 'Feature',
			properties: { lift, kind: 'lift' },
			geometry: { type: 'Point', coordinates: [nodes[n][0], nodes[n][1]] }
		}))
	);

	const labels = fc(
		pistes.flatMap((p, i): Feature<Point>[] =>
			p.ref
				? [
						{
							type: 'Feature',
							properties: { ref: p.ref, d: p.difficulty, o: i, length: p.length, kind: 'piste' },
							geometry: { type: 'Point', coordinates: p.label }
						}
					]
				: []
		)
	);

	const areaPolys = fc(
		areas.map((a): Feature<Polygon> => ({
			type: 'Feature',
			properties: { d: a.difficulty, o: a.piste, kind: 'piste' },
			geometry: { type: 'Polygon', coordinates: a.rings }
		}))
	);

	const poiPoints = fc(
		pois.map((p, i): Feature<Point> => ({
			type: 'Feature',
			properties: { name: p.name, type: p.type, poi: i, kind: 'poi' },
			geometry: { type: 'Point', coordinates: [p.lon, p.lat] }
		}))
	);

	return { segments, lifts: liftLines, stations, labels, areas: areaPolys, pois: poiPoints };
}

export function circle(center: LngLat, radius: number, steps = 48): Feature<Polygon> {
	const ring: LngLat[] = [];
	const dLat = radius / APPROX_METERS_PER_LATITUDE_DEGREE;
	const dLon = dLat / Math.cos((center[1] * Math.PI) / 180);
	for (let i = 0; i <= steps; i++) {
		const a = (i / steps) * 2 * Math.PI;
		ring.push([center[0] + dLon * Math.cos(a), center[1] + dLat * Math.sin(a)]);
	}
	return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } };
}

function cone(center: LngLat, bearing: number, fov: number, radius: number): Feature<Polygon> {
	const dLat = radius / APPROX_METERS_PER_LATITUDE_DEGREE;
	const dLon = dLat / Math.cos((center[1] * Math.PI) / 180);
	const steps = Math.max(4, Math.ceil(fov / 6));
	const ring: LngLat[] = [center];
	for (let i = 0; i <= steps; i++) {
		const a = ((bearing - fov / 2 + (fov * i) / steps) * Math.PI) / 180;
		ring.push([center[0] + dLon * Math.sin(a), center[1] + dLat * Math.cos(a)]);
	}
	ring.push(center);
	return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } };
}

export function webcamSources(cams: Webcam[]) {
	const points = fc(
		cams.map((w): Feature<Point> => ({
			type: 'Feature',
			properties: { osm: w.osm, kind: 'webcam' },
			geometry: { type: 'Point', coordinates: [w.lon, w.lat] }
		}))
	);
	const cones = fc(
		cams.flatMap((w): Feature<Polygon>[] => {
			const fov = w.fov ?? DEFAULT_CAMERA_FOV_DEGREES;
			const isOmnidirectional = fov >= OMNIDIRECTIONAL_FOV_THRESHOLD_DEGREES;
			if (w.direction === null || isOmnidirectional) return [];
			return [cone([w.lon, w.lat], w.direction, fov, WEBCAM_VIEW_CONE_RADIUS_METERS)];
		})
	);
	return { points, cones };
}

export function neighbourFeatures(data: ResortData): Feature<LineString>[] {
	const { nodes, edges, lifts, id } = data;
	const out: Feature<LineString>[] = [];
	for (const e of edges) {
		if (e.k !== 'p') continue;
		const a = nodes[e.a];
		const b = nodes[e.b];
		const coords: LngLat[] = [[a[0], a[1]]];
		if (e.g) for (let k = 0; k < e.g.length; k += 2) coords.push([e.g[k], e.g[k + 1]]);
		coords.push([b[0], b[1]]);
		out.push(line(coords, { resort: id, kind: 'piste', d: e.d }));
	}
	for (const l of lifts) out.push(line(l.coords, { resort: id, kind: 'lift' }));
	return out;
}
