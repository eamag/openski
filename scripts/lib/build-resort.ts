import {
	haversine,
	LocalProjection,
	projectOnSegment,
	segmentIntersection
} from '../../src/lib/geo.ts';
import type {
	Difficulty,
	EdgeData,
	Lift,
	LiftType,
	Piste,
	PisteArea,
	Poi,
	PoiType,
	ResortData
} from '../../src/lib/resort/types.ts';
import {
	DIFFICULTY_RANK,
	EDGE_LIT,
	EDGE_TUNNEL,
	EDGE_UNGROOMED
} from '../../src/lib/resort/types.ts';

const PISTE_SEGMENT_TARGET_METERS = 100;
const SEGMENT_DENSIFICATION_THRESHOLD_METERS = 110;
const VERTEX_REUSE_SNAP_METERS = 8;
const LOOSE_END_SNAP_DISTANCE_METERS = 35;
const STATION_PISTE_LINK_METERS = 70;
const STATION_PISTE_FALLBACK_LINK_METERS = 250;
const STATION_PISTE_END_LINK_METERS = 150;
const WALKABLE_STATION_TRANSFER_METERS = 120;
const CONNECTOR_MAX_CLIMB_METERS = 40;
const MAX_POI_DISTANCE_FROM_PISTE_METERS = 120;

const LIFT_TYPES = new Set<string>([
	'cable_car',
	'gondola',
	'mixed_lift',
	'chair_lift',
	't-bar',
	'j-bar',
	'platter',
	'drag_lift',
	'rope_tow',
	'magic_carpet'
]);
const LIFT_SPEED: Record<LiftType, number> = {
	cable_car: 8,
	gondola: 5.5,
	mixed_lift: 5,
	chair_lift: 4.5,
	't-bar': 3,
	'j-bar': 2.5,
	platter: 2.5,
	drag_lift: 2.5,
	rope_tow: 1.5,
	magic_carpet: 0.7
};
const LIFT_FALLBACK_NAME: Record<LiftType, string> = {
	cable_car: 'Cable car',
	gondola: 'Gondola',
	mixed_lift: 'Lift',
	chair_lift: 'Chairlift',
	't-bar': 'T-bar',
	'j-bar': 'J-bar',
	platter: 'Platter lift',
	drag_lift: 'Drag lift',
	rope_tow: 'Rope tow',
	magic_carpet: 'Magic carpet'
};
const DIFFICULTIES = new Set(Object.keys(DIFFICULTY_RANK));

export type Tags = Record<string, string>;

export interface OsmNode {
	type: 'node';
	id: number;
	lat: number;
	lon: number;
	tags?: Tags;
}
export interface OsmWay {
	type: 'way';
	id: number;
	nodes: number[];
	tags?: Tags;
}
export interface OsmRelation {
	type: 'relation';
	id: number;
	members: { type: 'node' | 'way' | 'relation'; ref: number; role: string }[];
	tags?: Tags;
}

export type OsmElement = OsmNode | OsmWay | OsmRelation;

export interface BuildResortOptions {
	elements: OsmElement[];
	memberWays: Set<number>;
	elevationAt: (lon: number, lat: number) => number;
	meta: {
		id: string;
		name: string;
		timezone: string;
	};
	warnings?: string[];
}

export function buildResort(options: BuildResortOptions): ResortData {
	const { elements, memberWays, elevationAt: getElevation, meta } = options;

	const osmNodes = new Map<number, OsmNode>();
	const osmWays = new Map<number, OsmWay>();
	const osmRels = new Map<number, OsmRelation>();

	for (const el of elements) {
		const map = (el.type === 'node' ? osmNodes : el.type === 'way' ? osmWays : osmRels) as Map<
			number,
			typeof el
		>;
		const prev = map.get(el.id);
		if (!prev || (el.tags && !prev.tags)) map.set(el.id, el);
	}

	let west = Infinity,
		south = Infinity,
		east = -Infinity,
		north = -Infinity;

	for (const id of memberWays) {
		for (const n of osmWays.get(id)?.nodes ?? []) {
			const node = osmNodes.get(n);
			if (!node) continue;
			west = Math.min(west, node.lon);
			east = Math.max(east, node.lon);
			south = Math.min(south, node.lat);
			north = Math.max(north, node.lat);
		}
	}

	if (!Number.isFinite(west)) {
		west = 0;
		south = 0;
		east = 0;
		north = 0;
	}

	const inResort = (way: OsmWay) => memberWays.has(way.id);

	const proj = new LocalProjection((west + east) / 2, (south + north) / 2);

	interface Vertex {
		x: number;
		y: number;
		osm?: number;
	}
	const verts: Vertex[] = [];
	const osmVertex = new Map<number, number>();
	const vertexOfOsm = (id: number): number => {
		let v = osmVertex.get(id);
		if (v === undefined) {
			const n = osmNodes.get(id);
			if (!n) return -1;
			v = verts.push({ x: proj.x(n.lon), y: proj.y(n.lat), osm: id }) - 1;
			osmVertex.set(id, v);
		}
		return v;
	};
	const newVertex = (x: number, y: number) => verts.push({ x, y }) - 1;
	const dist = (a: number, b: number) =>
		Math.hypot(verts[a].x - verts[b].x, verts[a].y - verts[b].y);
	const eleCache = new Map<number, number>();
	const ele = (v: number): number => {
		let e = eleCache.get(v);
		if (e === undefined) {
			e = getElevation(proj.lon(verts[v].x), proj.lat(verts[v].y));
			if (!Number.isFinite(e)) {
				const msg = `No elevation for vertex ${v}: DEM does not cover it; fallback to 0m`;
				console.warn(msg);
				if (options.warnings) options.warnings.push(msg);
				e = 0;
			}
			eleCache.set(v, e);
		}
		return e;
	};
	const lonLat = (v: number): [number, number] => [
		+proj.lon(verts[v].x).toFixed(6),
		+proj.lat(verts[v].y).toFixed(6)
	];

	interface Line {
		way: OsmWay;
		tags: Tags;
		v: number[];
		grade: boolean;
	}
	const pisteLines: Line[] = [];
	const liftLines: Line[] = [];
	const areaWays: { tags: Tags; rings: number[][] }[] = [];

	for (const way of osmWays.values()) {
		const tags = way.tags;
		if (!tags || !inResort(way)) continue;
		const pisteType = tags['piste:type'];
		if (pisteType === 'downhill' || pisteType === 'connection') {
			if (tags.access === 'no') continue;
			const closed = way.nodes[0] === way.nodes[way.nodes.length - 1];
			if (tags.area === 'yes' || (closed && tags.area !== 'no')) {
				areaWays.push({ tags, rings: [way.nodes] });
				continue;
			}
			if (!tags['piste:difficulty'] && pisteType === 'downhill') {
				const msg = `piste way ${way.id} (${tags.name ?? 'unnamed'}): no difficulty, defaulting to unknown`;
				console.warn(msg);
				if (options.warnings) options.warnings.push(msg);
				tags['piste:difficulty'] = 'unknown';
			}
			const v = way.nodes.map(vertexOfOsm).filter((idx) => idx !== -1);
			if (v.length < 2) continue;
			pisteLines.push({
				way,
				tags,
				v,
				grade: !(tags.tunnel === 'yes' || tags.bridge === 'yes' || tags.covered === 'yes')
			});
		} else if (tags.aerialway && LIFT_TYPES.has(tags.aerialway)) {
			const v = way.nodes.map(vertexOfOsm).filter((idx) => idx !== -1);
			if (v.length < 2) continue;
			liftLines.push({ way, tags, v, grade: false });
		}
	}
	const routeTags = new Map<number, Tags>();
	const wayMetres = (way: OsmWay) => {
		let m = 0;
		for (let i = 1; i < way.nodes.length; i++) {
			const a = osmNodes.get(way.nodes[i - 1]);
			const b = osmNodes.get(way.nodes[i]);
			if (a && b) m += haversine([a.lon, a.lat], [b.lon, b.lat]);
		}
		return m;
	};
	for (const rel of osmRels.values()) {
		const t = rel.tags;
		if (!t || t['piste:type'] !== 'downhill' || t.type === 'multipolygon' || t.type === 'site')
			continue;
		if (t.access === 'no' || t.disused === 'yes' || t.abandoned === 'yes') continue;
		const members = rel.members.flatMap((m) =>
			m.type === 'way' ? (osmWays.get(m.ref) ?? []) : []
		);
		if (/ronda|runde|tour|giro|guerra|challenge|safari|circuit|super ?8/i.test(t.name ?? ''))
			continue;
		if (members.some((w) => w.tags?.aerialway)) continue;
		if (members.reduce((m, w) => m + wayMetres(w), 0) > 12_000) continue;
		for (const m of rel.members) {
			if (m.type !== 'way' || routeTags.has(m.ref)) continue;
			routeTags.set(m.ref, t);
		}
	}
	const pisteWayIds = new Set(pisteLines.map((l) => l.way.id));
	const areaIds = new Set<number>();
	for (const way of osmWays.values()) {
		const t = way.tags?.['piste:type'];
		if (
			(t === 'downhill' || t === 'connection') &&
			(way.tags?.area === 'yes' || way.nodes[0] === way.nodes.at(-1))
		)
			areaIds.add(way.id);
	}
	for (const line of pisteLines) {
		const route = routeTags.get(line.way.id);
		if (!route || line.tags.name || line.tags.ref) continue;
		line.tags = {
			...line.tags,
			...(route.name ? { name: route.name } : {}),
			...(route.ref ? { ref: route.ref } : {}),
			...(line.tags['piste:difficulty'] === 'unknown' && route['piste:difficulty']
				? { 'piste:difficulty': route['piste:difficulty'] }
				: {})
		};
	}
	for (const [wayId, route] of routeTags) {
		const way = osmWays.get(wayId);
		if (!way || pisteWayIds.has(wayId) || areaIds.has(wayId) || !inResort(way)) continue;
		if (way.tags?.aerialway || way.tags?.['piste:type']) continue;
		if (way.nodes[0] === way.nodes.at(-1)) continue;
		const v = way.nodes.map(vertexOfOsm).filter((idx) => idx !== -1);
		if (v.length < 2) continue;
		const tags: Tags = {
			'piste:type': 'downhill',
			'piste:difficulty': route['piste:difficulty'] ?? 'unknown',
			...(route.name ? { name: route.name } : {}),
			...(route.ref ? { ref: route.ref } : {}),
			...(route['piste:grooming'] ? { 'piste:grooming': route['piste:grooming'] } : {}),
			...(route.lit ? { lit: route.lit } : {})
		};
		pisteLines.push({ way, tags, v, grade: true });
		pisteWayIds.add(wayId);
	}

	for (const rel of osmRels.values()) {
		if (rel.tags?.type !== 'multipolygon' || rel.tags['piste:type'] !== 'downhill') continue;
		const rings = rel.members
			.filter((m) => m.type === 'way' && m.role !== 'inner')
			.map((m) => osmWays.get(m.ref)?.nodes)
			.filter((r): r is number[] => !!r && r[0] === r[r.length - 1]);
		if (rings.length) areaWays.push({ tags: rel.tags, rings });
	}

	for (const line of pisteLines) {
		if (ele(line.v[0]) < ele(line.v[line.v.length - 1]) - 3) line.v.reverse();
	}
	for (const line of liftLines) {
		if (ele(line.v[0]) > ele(line.v[line.v.length - 1]) + 3) line.v.reverse();
	}

	function nearestOnLine(line: Line, x: number, y: number) {
		let best = { d2: Infinity, i: 0, t: 0, x: 0, y: 0 };
		for (let i = 0; i < line.v.length - 1; i++) {
			const a = verts[line.v[i]];
			const b = verts[line.v[i + 1]];
			const p = projectOnSegment(x, y, a.x, a.y, b.x, b.y);
			if (p.d2 < best.d2) best = { d2: p.d2, i, t: p.t, x: p.x, y: p.y };
		}
		return best;
	}

	function attach(line: Line, x: number, y: number): number {
		const n = nearestOnLine(line, x, y);
		const a = line.v[n.i];
		const b = line.v[n.i + 1];
		if (Math.hypot(verts[a].x - n.x, verts[a].y - n.y) < VERTEX_REUSE_SNAP_METERS) return a;
		if (Math.hypot(verts[b].x - n.x, verts[b].y - n.y) < VERTEX_REUSE_SNAP_METERS) return b;
		const v = newVertex(n.x, n.y);
		line.v.splice(n.i + 1, 0, v);
		return v;
	}

	{
		const inserts = new Map<Line, { i: number; t: number; v: number }[]>();
		let crossings = 0;
		for (let p = 0; p < pisteLines.length; p++) {
			const A = pisteLines[p];
			if (!A.grade) continue;
			for (let q = p + 1; q < pisteLines.length; q++) {
				const B = pisteLines[q];
				if (!B.grade || A.tags.layer !== B.tags.layer) continue;
				for (let i = 0; i < A.v.length - 1; i++) {
					const a1 = verts[A.v[i]];
					const a2 = verts[A.v[i + 1]];
					for (let j = 0; j < B.v.length - 1; j++) {
						if (
							A.v[i] === B.v[j] ||
							A.v[i] === B.v[j + 1] ||
							A.v[i + 1] === B.v[j] ||
							A.v[i + 1] === B.v[j + 1]
						)
							continue;
						const b1 = verts[B.v[j]];
						const b2 = verts[B.v[j + 1]];
						const hit = segmentIntersection(a1.x, a1.y, a2.x, a2.y, b1.x, b1.y, b2.x, b2.y);
						if (!hit) continue;
						const v = newVertex(hit.x, hit.y);
						if (!inserts.has(A)) inserts.set(A, []);
						if (!inserts.has(B)) inserts.set(B, []);
						inserts.get(A)!.push({ i, t: hit.t, v });
						inserts.get(B)!.push({ i: j, t: hit.u, v });
						crossings++;
					}
				}
			}
		}
		for (const [line, list] of inserts) {
			list.sort((a, b) => b.i - a.i || b.t - a.t);
			for (const ins of list) line.v.splice(ins.i + 1, 0, ins.v);
		}
		console.log(`crossings joined: ${crossings}`);
	}

	{
		const use = new Map<number, number>();
		for (const line of pisteLines)
			for (const v of new Set(line.v)) use.set(v, (use.get(v) ?? 0) + 1);
		let joined = 0;
		for (const line of pisteLines) {
			for (const endIdx of [0, line.v.length - 1]) {
				const end = line.v[endIdx];
				if ((use.get(end) ?? 0) > 1) continue;
				let best: { line: Line; d2: number } | null = null;
				for (const other of pisteLines) {
					if (other === line) continue;
					const n = nearestOnLine(other, verts[end].x, verts[end].y);
					if (n.d2 < LOOSE_END_SNAP_DISTANCE_METERS ** 2 && (!best || n.d2 < best.d2))
						best = { line: other, d2: n.d2 };
				}
				if (!best) continue;
				const target = attach(best.line, verts[end].x, verts[end].y);
				if (endIdx === 0) line.v.unshift(target);
				else line.v.push(target);
				joined++;
			}
		}
		console.log(`loose ends joined: ${joined}`);
	}

	interface Station {
		v: number;
		name?: string;
	}
	const liftStations: Station[][] = liftLines.map((line) => {
		const out: Station[] = [];
		line.v.forEach((v, i) => {
			const node = verts[v].osm !== undefined ? osmNodes.get(verts[v].osm!) : undefined;
			const isEnd = i === 0 || i === line.v.length - 1;
			if (isEnd || node?.tags?.aerialway === 'station') out.push({ v, name: node?.tags?.name });
		});
		return out;
	});

	const connectors = new Map<string, [number, number]>();
	const addConnector = (a: number, b: number) => {
		if (a === b) return;
		if (Math.abs(ele(a) - ele(b)) > CONNECTOR_MAX_CLIMB_METERS) return;
		connectors.set(a < b ? `${a}-${b}` : `${b}-${a}`, [a, b]);
	};
	{
		const stationVerts = [...new Set(liftStations.flat().map((s) => s.v))];
		for (const s of stationVerts) {
			const { x, y } = verts[s];
			const near = pisteLines
				.map((line) => ({ line, d: Math.sqrt(nearestOnLine(line, x, y).d2) }))
				.sort((a, b) => a.d - b.d);
			let picked = near.filter((n) => n.d <= STATION_PISTE_LINK_METERS);
			if (!picked.length && near[0]?.d <= STATION_PISTE_FALLBACK_LINK_METERS) picked = [near[0]];
			for (const n of picked) addConnector(s, attach(n.line, x, y));
			for (const line of pisteLines) {
				for (const end of [line.v[0], line.v[line.v.length - 1]]) {
					if (dist(s, end) <= STATION_PISTE_END_LINK_METERS) addConnector(s, end);
				}
			}
			for (const other of stationVerts) {
				if (other > s && dist(s, other) <= WALKABLE_STATION_TRANSFER_METERS) addConnector(s, other);
			}
		}
		console.log(`station links: ${connectors.size}`);
	}

	for (const line of pisteLines) {
		const out: number[] = [line.v[0]];
		for (let i = 1; i < line.v.length; i++) {
			const a = verts[line.v[i - 1]];
			const b = verts[line.v[i]];
			const d = Math.hypot(b.x - a.x, b.y - a.y);
			if (d > SEGMENT_DENSIFICATION_THRESHOLD_METERS) {
				const n = Math.ceil(d / PISTE_SEGMENT_TARGET_METERS);
				for (let k = 1; k < n; k++)
					out.push(newVertex(a.x + ((b.x - a.x) * k) / n, a.y + ((b.y - a.y) * k) / n));
			}
			out.push(line.v[i]);
		}
		line.v = out;
	}

	const nodeOfVertex = new Map<number, number>();
	const nodes: ResortData['nodes'] = [];
	const nodeOf = (v: number): number => {
		let n = nodeOfVertex.get(v);
		if (n === undefined) {
			n = nodes.push([...lonLat(v), +ele(v).toFixed(1)]) - 1;
			nodeOfVertex.set(v, n);
		}
		return n;
	};
	const edges: EdgeData[] = [];

	const junction = new Set<number>();
	{
		const use = new Map<number, number>();
		for (const line of pisteLines) {
			junction.add(line.v[0]);
			junction.add(line.v[line.v.length - 1]);
			for (const v of new Set(line.v)) use.set(v, (use.get(v) ?? 0) + 1);
		}
		for (const [v, n] of use) if (n > 1) junction.add(v);
		for (const [a, b] of connectors.values()) {
			junction.add(a);
			junction.add(b);
		}
	}

	function pisteNames(tags: Tags): { refs: string[]; title?: string } {
		const name = tags.name ?? tags['piste:name'];
		const ref = tags.ref ?? tags['piste:ref'];
		const isNum = (s: string) => /^\d+[a-z]?$/i.test(s);
		const split = (s: string) => s.split(/\s*[/;,]\s*/).filter(Boolean);
		if (name && split(name).every(isNum)) return { refs: split(name) };
		if (ref && split(ref).every(isNum)) return { refs: split(ref), title: name };
		return { refs: [], title: name };
	}

	interface PisteAcc {
		key: string;
		ref: string;
		titles: Map<string, number>;
		byDifficulty: Map<Difficulty, number>;
		length: number;
		top: number;
		bottom: number;
		labelLine?: { v: number[]; length: number };
		wayIds: number[];
		osmNodes: Set<number>;
	}
	const pisteAcc: PisteAcc[] = [];
	const pisteIndex = new Map<string, number>();
	const pisteFor = (key: string, ref: string): number => {
		let i = pisteIndex.get(key);
		if (i === undefined) {
			i =
				pisteAcc.push({
					key,
					ref,
					titles: new Map(),
					byDifficulty: new Map(),
					length: 0,
					top: -Infinity,
					bottom: Infinity,
					wayIds: [],
					osmNodes: new Set()
				}) - 1;
			pisteIndex.set(key, i);
		}
		return i;
	};

	for (const line of pisteLines) {
		const tags = line.tags;
		const difficulty = (
			DIFFICULTIES.has(tags['piste:difficulty']) ? tags['piste:difficulty'] : 'unknown'
		) as Difficulty;
		const { refs, title } = pisteNames(tags);
		const owners = refs.length
			? refs.map((r) => pisteFor(`r:${r.toLowerCase()}`, r.toLowerCase()))
			: [pisteFor(title ? `t:${title}` : `u:${line.way.id}`, '')];

		const lineLength = line.v.reduce((s, v, i) => (i ? s + dist(line.v[i - 1], v) : 0), 0);
		const drop = ele(line.v[0]) - ele(line.v[line.v.length - 1]);
		const oneway = tags.oneway ?? tags['piste:oneway'];
		const bi = oneway === 'no' || (oneway !== 'yes' && Math.abs(drop) < 8);
		let flags = 0;
		if (tags.tunnel === 'yes' || tags.covered === 'yes') flags |= EDGE_TUNNEL;
		if (tags.lit === 'yes') flags |= EDGE_LIT;
		if (tags['piste:grooming'] === 'backcountry' || tags['piste:grooming'] === 'mogul')
			flags |= EDGE_UNGROOMED;

		for (const o of owners) {
			const acc = pisteAcc[o];
			acc.length += lineLength;
			acc.byDifficulty.set(difficulty, (acc.byDifficulty.get(difficulty) ?? 0) + lineLength);
			if (title) acc.titles.set(title, (acc.titles.get(title) ?? 0) + lineLength);
			acc.wayIds.push(line.way.id);
			for (const n of line.way.nodes) acc.osmNodes.add(n);
			for (const v of line.v) {
				acc.top = Math.max(acc.top, ele(v));
				acc.bottom = Math.min(acc.bottom, ele(v));
			}
			if (!acc.labelLine || lineLength > acc.labelLine.length)
				acc.labelLine = { v: line.v, length: lineLength };
		}

		let start = 0;
		for (let i = 1; i < line.v.length; i++) {
			if (!junction.has(line.v[i]) && i !== line.v.length - 1) continue;
			const section = line.v.slice(start, i + 1);
			start = i;
			const cum = [0];
			for (let k = 1; k < section.length; k++)
				cum.push(cum[k - 1] + dist(section[k - 1], section[k]));
			const total = cum[cum.length - 1];
			if (total < 0.5) continue;
			const pieces = Math.max(1, Math.round(total / PISTE_SEGMENT_TARGET_METERS));
			const cuts = [0];
			for (let p = 1; p < pieces; p++) {
				const target = (total * p) / pieces;
				let best = cuts[cuts.length - 1] + 1;
				for (let k = best; k < section.length - 1; k++) {
					if (Math.abs(cum[k] - target) < Math.abs(cum[best] - target)) best = k;
				}
				if (best < section.length - 1 && best > cuts[cuts.length - 1]) cuts.push(best);
			}
			cuts.push(section.length - 1);
			for (let c = 1; c < cuts.length; c++) {
				const from = cuts[c - 1];
				const to = cuts[c];
				const g: number[] = [];
				for (let k = from + 1; k < to; k++) g.push(...lonLat(section[k]));
				const edge: EdgeData = {
					a: nodeOf(section[from]),
					b: nodeOf(section[to]),
					k: 'p',
					o: owners[0],
					d: difficulty,
					len: +(cum[to] - cum[from]).toFixed(1)
				};
				if (owners.length > 1) edge.o2 = owners.slice(1);
				if (bi) edge.bi = 1;
				if (g.length) edge.g = g;
				if (flags) edge.f = flags;
				edges.push(edge);
			}
		}
	}

	const parseDuration = (s: string | undefined): number | undefined => {
		if (!s) return undefined;
		if (s.includes(':')) {
			const parts = s.split(':').map(Number);
			if (parts.some(Number.isNaN)) return undefined;
			return parts.length === 3
				? parts[0] * 3600 + parts[1] * 60 + parts[2]
				: parts[0] * 60 + parts[1];
		}
		const minutes = Number(s);
		return Number.isFinite(minutes) && minutes > 0 ? minutes * 60 : undefined;
	};

	const lifts: Lift[] = [];
	liftLines.forEach((line, li) => {
		const tags = line.tags;
		const type = tags.aerialway as LiftType;
		const stations = liftStations[li];
		const length = line.v.reduce((s, v, i) => (i ? s + dist(line.v[i - 1], v) : 0), 0);
		const fixedGrip = tags['aerialway:detachable'] === 'no';
		const speed = type === 'chair_lift' && fixedGrip ? 2.3 : LIFT_SPEED[type];
		const duration = Math.round(parseDuration(tags['aerialway:duration']) ?? length / speed);
		const oneway = tags.oneway;
		const cabin = type === 'gondola' || type === 'cable_car' || type === 'mixed_lift';
		const bi = cabin ? oneway !== 'yes' : oneway === 'no';
		const capacity = Number(tags['aerialway:capacity']);
		const occupancy = Number(tags['aerialway:occupancy']);
		const lift: Lift = {
			id: `l${line.way.id}`,
			name: tags.name ?? LIFT_FALLBACK_NAME[type],
			type,
			duration,
			length: Math.round(length),
			bottom: Math.round(ele(line.v[0])),
			top: Math.round(ele(line.v[line.v.length - 1])),
			stations: stations.map((s) => nodeOf(s.v)),
			coords: line.v.map(lonLat)
		};
		if (tags.ref) lift.ref = tags.ref;
		if (capacity > 0) lift.capacity = capacity;
		if (occupancy > 0) lift.occupancy = occupancy;
		if (tags['aerialway:bubble'] === 'yes') lift.bubble = true;
		if (tags['aerialway:heating'] === 'yes') lift.heated = true;
		const index = lifts.push(lift) - 1;
		for (let s = 1; s < stations.length; s++) {
			const from = line.v.indexOf(stations[s - 1].v);
			const to = line.v.indexOf(stations[s].v);
			let len = 0;
			const g: number[] = [];
			for (let k = from + 1; k <= to; k++) {
				len += dist(line.v[k - 1], line.v[k]);
				if (k < to) g.push(...lonLat(line.v[k]));
			}
			const edge: EdgeData = {
				a: nodeOf(stations[s - 1].v),
				b: nodeOf(stations[s].v),
				k: 'l',
				o: index,
				len: +len.toFixed(1)
			};
			if (bi) edge.bi = 1;
			if (g.length) edge.g = g;
			edges.push(edge);
		}
	});

	for (const [a, b] of connectors.values()) {
		const [hi, lo] = ele(a) >= ele(b) ? [a, b] : [b, a];
		edges.push({ a: nodeOf(hi), b: nodeOf(lo), k: 'c', o: -1, bi: 1, len: +dist(a, b).toFixed(1) });
	}

	{
		const sanitize = (s: string) => s.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
		const old = [...pisteAcc];
		const nOld = old.length;
		const groups = new Map<string, number[]>();
		for (let i = 0; i < nOld; i++) {
			const sk = sanitize(old[i].key);
			if (!groups.has(sk)) groups.set(sk, []);
			groups.get(sk)!.push(i);
		}
		const finalClusters: number[][] = [];
		const oldToCluster = new Int32Array(nOld).fill(-1);
		for (const [, idxs] of groups) {
			if (idxs.length === 1) {
				finalClusters.push([idxs[0]]);
				oldToCluster[idxs[0]] = finalClusters.length - 1;
				continue;
			}
			const parent = idxs.map((_, i) => i);
			const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
			const union = (a: number, b: number) => {
				const ra = find(a);
				const rb = find(b);
				if (ra !== rb) parent[ra] = rb;
			};
			for (let a = 0; a < idxs.length; a++) {
				for (let b = a + 1; b < idxs.length; b++) {
					const accA = old[idxs[a]];
					const accB = old[idxs[b]];
					let touch = false;
					for (const node of accA.osmNodes) {
						if (accB.osmNodes.has(node)) {
							touch = true;
							break;
						}
					}
					if (touch) union(a, b);
				}
			}
			const clusterMap = new Map<number, number[]>();
			for (let a = 0; a < idxs.length; a++) {
				const r = find(a);
				if (!clusterMap.has(r)) clusterMap.set(r, []);
				clusterMap.get(r)!.push(idxs[a]);
			}
			for (const cl of clusterMap.values()) {
				finalClusters.push(cl);
				for (const oi of cl) oldToCluster[oi] = finalClusters.length - 1;
			}
		}
		const mergedAccs: PisteAcc[] = [];
		const clusterToNew = new Int32Array(finalClusters.length).fill(-1);
		for (let ci = 0; ci < finalClusters.length; ci++) {
			const cl = finalClusters[ci];
			if (cl.length === 1) {
				mergedAccs.push(old[cl[0]]);
				clusterToNew[ci] = mergedAccs.length - 1;
				continue;
			}
			const m: PisteAcc = {
				key: old[cl[0]].key,
				ref: old[cl[0]].ref,
				titles: new Map(old[cl[0]].titles),
				byDifficulty: new Map(old[cl[0]].byDifficulty),
				length: old[cl[0]].length,
				top: old[cl[0]].top,
				bottom: old[cl[0]].bottom,
				labelLine: old[cl[0]].labelLine,
				wayIds: [...old[cl[0]].wayIds],
				osmNodes: new Set(old[cl[0]].osmNodes)
			};
			for (let k = 1; k < cl.length; k++) {
				const a = old[cl[k]];
				m.length += a.length;
				for (const [d, len] of a.byDifficulty)
					m.byDifficulty.set(d, (m.byDifficulty.get(d) ?? 0) + len);
				for (const [t, len] of a.titles) m.titles.set(t, (m.titles.get(t) ?? 0) + len);
				m.top = Math.max(m.top, a.top);
				m.bottom = Math.min(m.bottom, a.bottom);
				if (!m.labelLine || (a.labelLine && a.labelLine.length > m.labelLine.length))
					m.labelLine = a.labelLine;
				m.wayIds.push(...a.wayIds);
				for (const n of a.osmNodes) m.osmNodes.add(n);
			}
			mergedAccs.push(m);
			clusterToNew[ci] = mergedAccs.length - 1;
		}
		const skToClusters = new Map<string, number[]>();
		for (let ci = 0; ci < finalClusters.length; ci++) {
			const sk = sanitize(old[finalClusters[ci][0]].key);
			if (!skToClusters.has(sk)) skToClusters.set(sk, []);
			skToClusters.get(sk)!.push(ci);
		}
		for (const [, cis] of skToClusters) {
			if (cis.length <= 1) continue;
			const sorted = cis
				.map((ci) => ({
					ci,
					lowest: Math.min(...finalClusters[ci].flatMap((oi) => old[oi].wayIds))
				}))
				.sort((a, b) => a.lowest - b.lowest);
			for (let i = 1; i < sorted.length; i++) {
				const ci = sorted[i].ci;
				const newIdx = clusterToNew[ci];
				const lowest = sorted[i].lowest;
				mergedAccs[newIdx].key = `${mergedAccs[newIdx].key}-${lowest}`;
			}
		}
		const pisteRemap = new Array<number>(nOld);
		for (let oi = 0; oi < nOld; oi++) {
			const ci = oldToCluster[oi];
			pisteRemap[oi] = clusterToNew[ci];
		}
		pisteAcc.length = 0;
		pisteAcc.push(...mergedAccs);
		pisteIndex.clear();
		for (let i = 0; i < pisteAcc.length; i++) pisteIndex.set(pisteAcc[i].key, i);
		for (const e of edges) {
			if (e.k !== 'p') continue;
			e.o = pisteRemap[e.o];
			if (e.o2) e.o2 = e.o2.map((x) => pisteRemap[x]);
		}
	}

	const pistes: Piste[] = pisteAcc.map((acc) => {
		const difficulty = [...acc.byDifficulty].sort((a, b) => b[1] - a[1])[0][0];
		const title = [...acc.titles].sort((a, b) => b[1] - a[1])[0];
		const line = acc.labelLine;
		let label = line && line.v.length > 0 ? line.v[0] : 0;
		if (line && line.v.length > 0) {
			let walked = 0;
			for (let i = 1; i < line.v.length; i++) {
				walked += dist(line.v[i - 1], line.v[i]);
				if (walked >= line.length / 2) {
					label = line.v[i];
					break;
				}
			}
		}
		const piste: Piste = {
			id: acc.key.replace(/[^a-z0-9]+/gi, '-').toLowerCase(),
			ref: acc.ref,
			difficulty,
			length: Math.round(acc.length),
			top: Math.round(acc.top),
			bottom: Math.round(acc.bottom),
			label: lonLat(label),
			counted: acc.ref !== '' || (!!title && acc.length > 300),
			ways: [...new Set(acc.wayIds)].sort((a, b) => a - b)
		};
		if (title && title[1] > acc.length * 0.5) piste.title = title[0];
		return piste;
	});

	const areas: PisteArea[] = areaWays.map(({ tags, rings }) => {
		const { refs, title } = pisteNames(tags);
		const key = refs.length ? `r:${refs[0].toLowerCase()}` : title ? `t:${title}` : '';
		let pisteIdx = pisteIndex.get(key);
		if (pisteIdx === undefined) {
			const sk = key.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
			for (let i = 0; i < pisteAcc.length; i++) {
				if (pisteAcc[i].key.replace(/[^a-z0-9]+/gi, '-').toLowerCase() === sk) {
					pisteIdx = i;
					break;
				}
			}
		}
		return {
			piste: pisteIdx ?? -1,
			difficulty: (DIFFICULTIES.has(tags['piste:difficulty'])
				? tags['piste:difficulty']
				: 'unknown') as Difficulty,
			rings: rings
				.map((ring) =>
					ring
						.map((n) => osmNodes.get(n))
						.filter((n): n is OsmNode => !!n)
						.map((node) => [+node.lon.toFixed(6), +node.lat.toFixed(6)] as [number, number])
				)
				.filter((ring) => ring.length >= 3)
		};
	});

	const POI_TYPES: Record<string, PoiType> = {
		restaurant: 'restaurant',
		cafe: 'cafe',
		bar: 'bar',
		toilets: 'toilets',
		first_aid: 'first_aid',
		alpine_hut: 'hut',
		viewpoint: 'viewpoint'
	};
	const pisteNodeIdx = [...new Set(edges.filter((e) => e.k === 'p').flatMap((e) => [e.a, e.b]))];
	const pois: Poi[] = [];
	const seenPoi = new Set<string>();
	for (const el of elements) {
		if (el.type === 'relation' || !el.tags) continue;
		const type = POI_TYPES[el.tags.amenity] ?? POI_TYPES[el.tags.tourism];
		if (!type || el.tags.aerialway || el.tags['piste:type']) continue;
		const name = el.tags.name;
		if (!name && type !== 'toilets') continue;
		let lon: number, lat: number;
		if (el.type === 'node') {
			lon = el.lon;
			lat = el.lat;
		} else {
			const pts = el.nodes.map((n) => osmNodes.get(n)).filter((n): n is OsmNode => !!n);
			if (pts.length === 0) continue;
			lon = pts.reduce((s, p) => s + p.lon, 0) / pts.length;
			lat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
		}
		const x = proj.x(lon);
		const y = proj.y(lat);
		let best = -1;
		let bestD = Infinity;
		for (const n of pisteNodeIdx) {
			const d = Math.hypot(proj.x(nodes[n][0]) - x, proj.y(nodes[n][1]) - y);
			if (d < bestD) {
				bestD = d;
				best = n;
			}
		}
		if (bestD > MAX_POI_DISTANCE_FROM_PISTE_METERS) continue;
		const key = `${type}:${name ?? `${lon.toFixed(4)},${lat.toFixed(4)}`}`;
		if (seenPoi.has(key)) continue;
		seenPoi.add(key);
		pois.push({
			name: name ?? 'WC',
			type,
			lon: +lon.toFixed(6),
			lat: +lat.toFixed(6),
			ele: Math.round(getElevation(lon, lat)),
			node: best
		});
	}

	{
		const out: number[][] = nodes.map(() => []);
		const back: number[][] = nodes.map(() => []);
		edges.forEach((e, i) => {
			out[e.a].push(i);
			back[e.b].push(i);
			if (e.bi) {
				out[e.b].push(i);
				back[e.a].push(i);
			}
		});
		const flood = (starts: number[], adj: number[][]) => {
			const seen = new Set(starts);
			const stack = [...starts];
			while (stack.length) {
				const n = stack.pop()!;
				for (const ei of adj[n]) {
					const e = edges[ei];
					const m = e.a === n ? e.b : e.a;
					if (!seen.has(m)) {
						seen.add(m);
						stack.push(m);
					}
				}
			}
			return seen;
		};
		const liftNodes = [...new Set(lifts.flatMap((l) => l.stations))];
		const fromLift = flood(liftNodes, out);
		const toLift = flood(liftNodes, back);
		const unreachable = new Map<string, number>();
		const deadEnd = new Map<string, number>();
		for (const e of edges) {
			if (e.k !== 'p') continue;
			const name = pistes[e.o].ref || pistes[e.o].title || pistes[e.o].id;
			if (!fromLift.has(e.a)) unreachable.set(name, (unreachable.get(name) ?? 0) + e.len);
			if (!toLift.has(e.b)) deadEnd.set(name, (deadEnd.get(name) ?? 0) + e.len);
		}
		const fmt = (m: Map<string, number>) =>
			[...m].map(([k, v]) => `${k} (${Math.round(v)} m)`).join(', ') || 'none';
		console.log(`not reachable from any lift: ${fmt(unreachable)}`);
		console.log(`cannot get back to a lift:   ${fmt(deadEnd)}`);
		const isolated = lifts.filter(
			(l) =>
				!edges.some((e) => e.k !== 'l' && l.stations.includes(e.a === undefined ? -1 : e.a)) &&
				!edges.some((e) => e.k !== 'l' && l.stations.includes(e.b))
		);
		console.log(
			`lifts with no link to a piste: ${isolated.map((l) => l.name).join(', ') || 'none'}`
		);
	}

	const round = (n: number, d: number) => +n.toFixed(d);
	const resort: ResortData = {
		id: meta.id,
		name: meta.name,
		version: new Date().toISOString(),
		timezone: meta.timezone,
		bbox: [round(west, 5), round(south, 5), round(east, 5), round(north, 5)],
		center: [round((west + east) / 2, 5), round((south + north) / 2, 5)],
		nodes,
		edges,
		pistes,
		lifts,
		areas,
		pois,
		attribution: '© OpenStreetMap contributors'
	};

	return resort;
}
