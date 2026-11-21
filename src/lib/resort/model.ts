import { LocalProjection, projectOnSegment, type LngLat } from '../geo.ts';
import { t } from '../i18n/index.ts';
import type { EdgeData, Lift, Piste, ResortData } from './types.ts';

export type Arc = number;
export const arcEdge = (arc: Arc) => arc >> 1;
export const arcReversed = (arc: Arc) => (arc & 1) === 1;

export interface EdgeHit {
	edge: number;
	dist: number;
	bearing: number;
	point: LngLat;
}

const SPATIAL_CELL_SIZE_METERS = 80;

export class Resort {
	readonly proj: LocalProjection;
	readonly out: Arc[][];
	readonly xy: Float64Array[];
	readonly pisteEdges: number[][];
	readonly liftEdges: number[][];
	readonly countedLength: number;
	private readonly grid = new Map<number, number[]>();

	constructor(readonly data: ResortData) {
		this.proj = new LocalProjection(data.center[0], data.center[1]);
		const { nodes, edges } = data;
		this.out = nodes.map(() => []);
		this.pisteEdges = data.pistes.map(() => []);
		this.liftEdges = data.lifts.map(() => []);
		this.xy = new Array(edges.length);
		let counted = 0;

		edges.forEach((edge, edgeIndex) => {
			this.out[edge.a].push(edgeIndex * 2);
			if (edge.bi) this.out[edge.b].push(edgeIndex * 2 + 1);
			if (edge.k === 'p') {
				this.pisteEdges[edge.o].push(edgeIndex);
				for (const extraPiste of edge.o2 ?? []) this.pisteEdges[extraPiste].push(edgeIndex);
				if (data.pistes[edge.o].counted) counted += edge.len;
			} else if (edge.k === 'l') this.liftEdges[edge.o].push(edgeIndex);

			const coords = this.edgeCoords(edgeIndex);
			const xy = new Float64Array(coords.length * 2);
			coords.forEach(([lon, lat], k) => {
				xy[k * 2] = this.proj.x(lon);
				xy[k * 2 + 1] = this.proj.y(lat);
			});
			this.xy[edgeIndex] = xy;
			for (let k = 0; k < xy.length - 2; k += 2) {
				const minCellX = Math.floor(Math.min(xy[k], xy[k + 2]) / SPATIAL_CELL_SIZE_METERS);
				const maxCellX = Math.floor(Math.max(xy[k], xy[k + 2]) / SPATIAL_CELL_SIZE_METERS);
				const minCellY = Math.floor(Math.min(xy[k + 1], xy[k + 3]) / SPATIAL_CELL_SIZE_METERS);
				const maxCellY = Math.floor(Math.max(xy[k + 1], xy[k + 3]) / SPATIAL_CELL_SIZE_METERS);
				for (let cx = minCellX; cx <= maxCellX; cx++) {
					for (let cy = minCellY; cy <= maxCellY; cy++) {
						const key = cellKey(cx, cy);
						const list = this.grid.get(key);
						if (!list) this.grid.set(key, [edgeIndex]);
						else if (list[list.length - 1] !== edgeIndex) list.push(edgeIndex);
					}
				}
			}
		});
		this.countedLength = counted;
	}

	get id() {
		return this.data.id;
	}

	edgeCoords(edgeIndex: number): LngLat[] {
		const edge = this.data.edges[edgeIndex];
		const startNode = this.data.nodes[edge.a];
		const endNode = this.data.nodes[edge.b];
		const coords: LngLat[] = [[startNode[0], startNode[1]]];
		if (edge.g) {
			for (let k = 0; k < edge.g.length; k += 2) {
				coords.push([edge.g[k], edge.g[k + 1]]);
			}
		}
		coords.push([endNode[0], endNode[1]]);
		return coords;
	}

	arcCoords(arc: Arc): LngLat[] {
		const coords = this.edgeCoords(arcEdge(arc));
		return arcReversed(arc) ? coords.reverse() : coords;
	}

	arcFrom(arc: Arc): number {
		const edge = this.data.edges[arcEdge(arc)];
		return arcReversed(arc) ? edge.b : edge.a;
	}

	arcTo(arc: Arc): number {
		const edge = this.data.edges[arcEdge(arc)];
		return arcReversed(arc) ? edge.a : edge.b;
	}

	drop(edge: EdgeData): number {
		return this.data.nodes[edge.a][2] - this.data.nodes[edge.b][2];
	}

	pisteName(p: Piste): string {
		if (p.ref && p.title) return `${p.ref} · ${p.title}`;
		return p.ref ? t.map.pisteRef(p.ref) : (p.title ?? t.map.pisteLink);
	}

	liftName(l: Lift): string {
		return l.name;
	}

	nearestEdges(
		lon: number,
		lat: number,
		maxDist: number,
		accept?: (edge: EdgeData, index: number) => boolean
	): EdgeHit[] {
		const px = this.proj.x(lon);
		const py = this.proj.y(lat);
		const searchRadiusCells = Math.ceil(maxDist / SPATIAL_CELL_SIZE_METERS);
		const centerCellX = Math.floor(px / SPATIAL_CELL_SIZE_METERS);
		const centerCellY = Math.floor(py / SPATIAL_CELL_SIZE_METERS);
		const seen = new Set<number>();
		const hits: EdgeHit[] = [];
		for (let dx = -searchRadiusCells; dx <= searchRadiusCells; dx++) {
			for (let dy = -searchRadiusCells; dy <= searchRadiusCells; dy++) {
				for (const edgeIndex of this.grid.get(cellKey(centerCellX + dx, centerCellY + dy)) ?? []) {
					if (seen.has(edgeIndex)) continue;
					seen.add(edgeIndex);
					if (accept && !accept(this.data.edges[edgeIndex], edgeIndex)) continue;
					const xy = this.xy[edgeIndex];
					let bestDistSquared = Infinity;
					let bx = 0;
					let by = 0;
					let seg = 0;
					for (let k = 0; k < xy.length - 2; k += 2) {
						const p = projectOnSegment(px, py, xy[k], xy[k + 1], xy[k + 2], xy[k + 3]);
						if (p.d2 < bestDistSquared) {
							bestDistSquared = p.d2;
							bx = p.x;
							by = p.y;
							seg = k;
						}
					}
					const dist = Math.sqrt(bestDistSquared);
					if (dist > maxDist) continue;
					const bearing =
						(Math.atan2(xy[seg + 2] - xy[seg], xy[seg + 3] - xy[seg + 1]) * 180) / Math.PI;
					hits.push({
						edge: edgeIndex,
						dist,
						bearing: (bearing + 360) % 360,
						point: [this.proj.lon(bx), this.proj.lat(by)]
					});
				}
			}
		}
		return hits.sort((a, b) => a.dist - b.dist);
	}

	nearestEdge(
		lon: number,
		lat: number,
		maxDist: number,
		accept?: (edge: EdgeData, index: number) => boolean
	): EdgeHit | undefined {
		return this.nearestEdges(lon, lat, maxDist, accept)[0];
	}

	contains(lon: number, lat: number, margin = 1500): boolean {
		const [w, s, e, n] = this.data.bbox;
		const mx = margin / this.proj.kx;
		const my = margin / this.proj.ky;
		return lon >= w - mx && lon <= e + mx && lat >= s - my && lat <= n + my;
	}
}

function cellKey(cellX: number, cellY: number): number {
	return (cellX + 4096) * 8192 + (cellY + 4096);
}
