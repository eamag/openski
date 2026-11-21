import { haversine, type LngLat } from '../geo.ts';
import type { Resort } from './model.ts';

export interface ProfilePoint {
	d: number;
	ele: number;
	at: LngLat;
}

export interface ProfileStretch {
	from: number;
	to: number;
	pct: number;
}

export interface Profile {
	points: ProfilePoint[];
	stretches: ProfileStretch[];
	length: number;
	top: number;
	bottom: number;
	climb: number;
	avgPct: number;
	steepest: ProfileStretch;
	flat: number;
}

const MIN_STRETCH_LENGTH_METERS = 40;
const MAX_PIECE_GAP_METERS = 400;
const MAX_PARALLEL_OVERLAP_METERS = 30;

export const FLAT_PCT = 5;

export function steepnessBand(
	pct: number
): 'up' | 'flat' | 'easy' | 'intermediate' | 'advanced' | 'expert' {
	if (pct < -2) return 'up';
	if (pct < FLAT_PCT) return 'flat';
	if (pct < 25) return 'easy';
	if (pct < 40) return 'intermediate';
	if (pct < 80) return 'advanced';
	return 'expert';
}

export const degrees = (pct: number) => (Math.atan(pct / 100) * 180) / Math.PI;

interface Path {
	edges: number[];
	length: number;
	top: number;
	bottom: number;
	start: number;
	end: number;
}

export function pisteProfile(resort: Resort, index: number): Profile | null {
	const { nodes, edges } = resort.data;
	const own = resort.pisteEdges[index];
	if (!own?.length) return null;

	const left = new Set(own);
	const pieces: Path[] = [];
	while (left.size) {
		const out = new Map<number, number[]>();
		const into = new Set<number>();
		for (const i of left) {
			const e = edges[i];
			out.set(e.a, [...(out.get(e.a) ?? []), i]);
			into.add(e.b);
		}
		const best = new Map<number, { len: number; next: number }>();
		const visiting = new Set<number>();
		const walk = (n: number): number => {
			const known = best.get(n);
			if (known) return known.len;
			if (visiting.has(n)) return 0;
			visiting.add(n);
			let len = 0;
			let next = -1;
			for (const i of out.get(n) ?? []) {
				const l = edges[i].len + walk(edges[i].b);
				if (l > len) [len, next] = [l, i];
			}
			visiting.delete(n);
			best.set(n, { len, next });
			return len;
		};
		let head = -1;
		let headLen = -1;
		for (const n of out.keys()) {
			const l = walk(n) + (into.has(n) ? 0 : 1e-6);
			if (l > headLen) [head, headLen] = [n, l];
		}
		const path: number[] = [];
		for (let n = head, step = best.get(n); step && step.next >= 0 && path.length < left.size;) {
			path.push(step.next);
			n = edges[step.next].b;
			step = best.get(n);
		}
		if (!path.length) break;
		for (const i of path) left.delete(i);
		const start = edges[path[0]].a;
		const end = edges[path[path.length - 1]].b;
		const length = path.reduce((s, i) => s + edges[i].len, 0);
		pieces.push({
			edges: path,
			length,
			top: nodes[start][2],
			bottom: nodes[end][2],
			start,
			end
		});
	}
	if (!pieces.length) return null;

	pieces.sort((a, b) => b.length - a.length);
	const chain = [pieces[0]];
	const used = new Set([0]);
	const near = (a: number, b: number) =>
		haversine(nodes[a] as unknown as LngLat, nodes[b] as unknown as LngLat) < MAX_PIECE_GAP_METERS;
	for (let grew = true; grew;) {
		grew = false;
		const first = chain[0];
		const last = chain[chain.length - 1];
		const above = pieces.findIndex(
			(p, k) =>
				!used.has(k) &&
				p.bottom >= first.top - MAX_PARALLEL_OVERLAP_METERS &&
				near(p.end, first.start)
		);
		if (above >= 0) {
			chain.unshift(pieces[above]);
			used.add(above);
			grew = true;
		}
		const below = pieces.findIndex(
			(p, k) =>
				!used.has(k) &&
				p.top <= last.bottom + MAX_PARALLEL_OVERLAP_METERS &&
				near(last.end, p.start)
		);
		if (below >= 0) {
			chain.push(pieces[below]);
			used.add(below);
			grew = true;
		}
	}

	const points: ProfilePoint[] = [];
	const corners: number[] = [];
	let d = 0;
	for (const piece of chain) {
		for (const i of piece.edges) {
			const coords = resort.edgeCoords(i);
			const e = edges[i];
			const za = nodes[e.a][2];
			const zb = nodes[e.b][2];
			const steps = [0];
			for (let k = 1; k < coords.length; k++)
				steps.push(steps[k - 1] + haversine(coords[k - 1], coords[k]));
			const total = steps[steps.length - 1] || 1;
			coords.forEach((at, k) => {
				if (k === 0 && points.length) {
					const prev = points[points.length - 1];
					const jump = haversine(prev.at, at);
					const isSameNode = jump < 1;
					if (isSameNode) return;
					d += jump;
				}
				if (k === 0) corners.push(points.length);
				points.push({ d: d + steps[k], ele: za + ((zb - za) * steps[k]) / total, at });
			});
			d += total;
			corners.push(points.length - 1);
		}
	}
	if (points.length < 2) return null;

	const marks = [...new Set(corners)].sort((a, b) => a - b);

	const heights = marks.map((m) => points[m].ele);
	const medianOfThreeFilter = (prevEle: number, currEle: number, nextEle: number) =>
		Math.max(Math.min(prevEle, currEle), Math.min(Math.max(prevEle, currEle), nextEle));
	for (let k = 1; k < marks.length - 1; k++)
		points[marks[k]].ele = medianOfThreeFilter(heights[k - 1], heights[k], heights[k + 1]);
	for (let k = 0; k < marks.length - 1; k++) {
		const a = points[marks[k]];
		const b = points[marks[k + 1]];
		for (let i = marks[k] + 1; i < marks[k + 1]; i++) {
			const t = b.d > a.d ? (points[i].d - a.d) / (b.d - a.d) : 0;
			points[i].ele = a.ele + (b.ele - a.ele) * t;
		}
	}
	const stretches: ProfileStretch[] = [];
	let from = marks[0];
	for (let k = 1; k < marks.length; k++) {
		const to = marks[k];
		const len = points[to].d - points[from].d;
		if (len < MIN_STRETCH_LENGTH_METERS && k < marks.length - 1) continue;
		if (len > 0)
			stretches.push({
				from: points[from].d,
				to: points[to].d,
				pct: ((points[from].ele - points[to].ele) / len) * 100
			});
		from = to;
	}
	if (!stretches.length) return null;

	const length = points[points.length - 1].d;
	const top = points[0].ele;
	const bottom = points[points.length - 1].ele;
	let climb = 0;
	let flat = 0;
	for (const s of stretches) {
		const len = s.to - s.from;
		if (s.pct < 0) climb += (-s.pct * len) / 100;
		if (s.pct < FLAT_PCT) flat += len;
	}
	const steepest = stretches.reduce((a, b) => (b.pct > a.pct ? b : a));
	return {
		points,
		stretches,
		length,
		top,
		bottom,
		climb,
		avgPct: ((top - bottom) / length) * 100,
		steepest,
		flat
	};
}

export function pointAt(profile: Profile, distanceFromTopMeters: number): ProfilePoint {
	const pts = profile.points;
	let lo = 0;
	let hi = pts.length - 1;
	while (hi - lo > 1) {
		const mid = (lo + hi) >> 1;
		if (pts[mid].d <= distanceFromTopMeters) lo = mid;
		else hi = mid;
	}
	const a = pts[lo];
	const b = pts[hi];
	const t = b.d > a.d ? Math.min(1, Math.max(0, (distanceFromTopMeters - a.d) / (b.d - a.d))) : 0;
	return {
		d: distanceFromTopMeters,
		ele: a.ele + (b.ele - a.ele) * t,
		at: [a.at[0] + (b.at[0] - a.at[0]) * t, a.at[1] + (b.at[1] - a.at[1]) * t]
	};
}

export function stretchAt(profile: Profile, distanceFromTopMeters: number): ProfileStretch {
	return (
		profile.stretches.find((s) => distanceFromTopMeters <= s.to) ??
		profile.stretches[profile.stretches.length - 1]
	);
}
