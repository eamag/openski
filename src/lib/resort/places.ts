import type { LngLat } from '../geo.ts';
import { formatKm, formatMeters, t } from '../i18n/index.ts';
import type { Resort } from './model.ts';

export type Place =
	| { kind: 'me' }
	| { kind: 'station'; lift: number; station: number }
	| { kind: 'piste'; index: number }
	| { kind: 'poi'; index: number }
	| { kind: 'point'; at: LngLat };

/** The kind of place in the reader's language; OSM values we have no word for are shown as tagged. */
export function poiTypeLabel(type: string): string {
	return type in t.place.poiType
		? t.place.poiType[type as keyof typeof t.place.poiType]
		: type[0].toUpperCase() + type.slice(1).replace(/_/g, ' ');
}

export function placeKey(p: Place | null): string {
	if (!p) return '';
	switch (p.kind) {
		case 'me':
			return 'me';
		case 'station':
			return `s${p.lift}.${p.station}`;
		case 'piste':
			return `p${p.index}`;
		case 'poi':
			return `i${p.index}`;
		case 'point':
			return `x${p.at[0].toFixed(5)},${p.at[1].toFixed(5)}`;
	}
}

export function stationLabel(resort: Resort, lift: number, station: number): string {
	const l = resort.data.lifts[lift];
	const last = l.stations.length - 1;
	const which =
		station === 0
			? t.map.station.bottom
			: station === last
				? t.map.station.top
				: t.map.station.middle;
	return t.map.station.label(l.name, which);
}

export function placeLabel(resort: Resort, p: Place): string {
	switch (p.kind) {
		case 'me':
			return t.map.myLocation;
		case 'station':
			return stationLabel(resort, p.lift, p.station);
		case 'piste':
			return resort.pisteName(resort.data.pistes[p.index]);
		case 'poi':
			return resort.data.pois[p.index].name;
		case 'point': {
			const hit = resort.nearestEdge(p.at[0], p.at[1], 150, (e) => e.k !== 'c');
			if (!hit) return t.map.droppedPin;
			const e = resort.data.edges[hit.edge];
			return e.k === 'p'
				? t.map.onPiste(resort.pisteName(resort.data.pistes[e.o]))
				: t.map.nearLift(resort.data.lifts[e.o].name);
		}
	}
}

function pisteTops(resort: Resort, pisteIndex: number): number[] {
	const edges = resort.pisteEdges[pisteIndex].map((edgeIndex) => resort.data.edges[edgeIndex]);
	const fedByOtherEdge = new Set(edges.map((edge) => edge.b));
	const entryNodes = [...new Set(edges.map((edge) => edge.a))].filter(
		(node) => !fedByOtherEdge.has(node)
	);
	if (entryNodes.length) return entryNodes;
	const isLoopOrTraverse = entryNodes.length === 0;
	if (isLoopOrTraverse) {
		const allNodes = [...new Set(edges.flatMap((edge) => [edge.a, edge.b]))];
		const highestNodeFirst = allNodes.sort(
			(nodeA, nodeB) => resort.data.nodes[nodeB][2] - resort.data.nodes[nodeA][2]
		);
		return highestNodeFirst.slice(0, 1);
	}
	return [];
}

function nodesNear(resort: Resort, at: LngLat, role: 'from' | 'to', maxDist: number): number[] {
	const hit = resort.nearestEdge(at[0], at[1], maxDist, (edge) => edge.k !== 'c');
	if (!hit) return [];
	const edge = resort.data.edges[hit.edge];
	if (edge.k === 'p') {
		if (edge.bi) return [edge.a, edge.b];
		const downhillEnd = edge.b;
		const uphillStart = edge.a;
		return role === 'from' ? [downhillEnd] : [uphillStart];
	}
	const { nodes } = resort.data;
	const px = resort.proj.x(at[0]);
	const py = resort.proj.y(at[1]);
	const distToNode = (nodeIndex: number) =>
		Math.hypot(resort.proj.x(nodes[nodeIndex][0]) - px, resort.proj.y(nodes[nodeIndex][1]) - py);
	const nearestStationNode = distToNode(edge.a) <= distToNode(edge.b) ? edge.a : edge.b;
	return [nearestStationNode];
}

export function placeNodes(
	resort: Resort,
	p: Place,
	role: 'from' | 'to',
	me?: LngLat | null
): number[] {
	switch (p.kind) {
		case 'me':
			return me ? nodesNear(resort, me, role, 400) : [];
		case 'station':
			return [resort.data.lifts[p.lift].stations[p.station]];
		case 'piste':
			return pisteTops(resort, p.index);
		case 'poi':
			return [resort.data.pois[p.index].node];
		case 'point':
			return nodesNear(resort, p.at, role, 250);
	}
}

export interface SearchResult {
	place: Place;
	label: string;
	detail: string;
	kind: 'piste' | 'lift' | 'poi';
	index: number;
}

const NO_MATCH_RANK = 9;
const MIN_LIFT_SEARCH_LENGTH_METERS = 150;

export function search(resort: Resort, query: string, limit = 12): SearchResult[] {
	const q = query.trim().toLowerCase();
	const { pistes, lifts, pois, nodes } = resort.data;
	const out: (SearchResult & { rank: number })[] = [];
	const rank = (text: string) => {
		const t = text.toLowerCase();
		if (!q) return 2;
		if (t === q) return 0;
		if (t.startsWith(q)) return 1;
		return t.includes(q) ? 2 : -1;
	};

	if (q) {
		pistes.forEach((p, i) => {
			if (!p.counted) return;
			const r = Math.min(
				...[p.ref, p.title ?? '']
					.filter(Boolean)
					.map(rank)
					.filter((x) => x >= 0),
				NO_MATCH_RANK
			);
			if (r === NO_MATCH_RANK) return;
			out.push({
				place: { kind: 'piste', index: i },
				label: resort.pisteName(p),
				detail: t.map.pisteDetail(formatKm(p.length), formatMeters(p.top), formatMeters(p.bottom)),
				kind: 'piste',
				index: i,
				rank: r
			});
		});
		pois.forEach((p, i) => {
			const r = rank(p.name);
			if (r < 0 || p.type === 'toilets') return;
			out.push({
				place: { kind: 'poi', index: i },
				label: p.name,
				detail: `${poiTypeLabel(p.type)} · ${formatMeters(p.ele)}`,
				kind: 'poi',
				index: i,
				rank: r + 0.5
			});
		});
	}
	lifts.forEach((lift, liftIndex) => {
		const r = rank(lift.name);
		if (r < 0 || lift.length < MIN_LIFT_SEARCH_LENGTH_METERS) return;
		const last = lift.stations.length - 1;
		for (const stationIndex of [0, last]) {
			const rankWithoutQuery = -lift.length;
			const rankWithQuery = r + 0.2 + (stationIndex ? 0.01 : 0);
			out.push({
				place: { kind: 'station', lift: liftIndex, station: stationIndex },
				label: stationLabel(resort, liftIndex, stationIndex),
				detail: formatMeters(nodes[lift.stations[stationIndex]][2]),
				kind: 'lift',
				index: liftIndex,
				rank: q ? rankWithQuery : rankWithoutQuery
			});
		}
	});
	return out.sort((a, b) => a.rank - b.rank).slice(0, limit);
}
