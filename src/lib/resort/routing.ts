import type { LngLat } from '../geo.ts';
import { t } from '#lib/i18n/index.ts';
import { arcEdge, arcReversed, type Arc, type Resort } from './model.ts';
import {
	DIFFICULTY_RANK,
	DRAG_LIFTS,
	type Difficulty,
	type EdgeData,
	type LiftType
} from './types.ts';

export interface RoutePrefs {
	maxDifficulty: 'easy' | 'intermediate' | 'advanced';
	avoidDragLifts: boolean;
	avoidFlats: boolean;
	preferGoodSnow: boolean;
}

export const DEFAULT_PREFS: RoutePrefs = {
	maxDifficulty: 'advanced',
	avoidDragLifts: true,
	avoidFlats: true,
	preferGoodSnow: false
};

export interface RouteStep {
	kind: 'piste' | 'lift' | 'walk';
	owner: number;
	name: string;
	difficulty?: Difficulty;
	liftType?: LiftType;
	downhillRide?: boolean;
	length: number;
	time: number;
	wait: number;
	up: number;
	down: number;
	flat: number;
	closed?: boolean;
	unreported?: boolean;
	arcs: Arc[];
	coords: LngLat[];
}

export interface Route {
	steps: RouteStep[];
	time: number;
	length: number;
	up: number;
	down: number;
	coords: LngLat[];
	usesClosed?: boolean;
}

export interface RouteContext {
	liftWait?: (lift: number) => number | undefined;
	edgeFactor?: (edge: number) => number;
	liftOpen?: (lift: number) => boolean | null | undefined;
	pisteOpen?: (piste: number) => boolean | null | undefined;
	allowClosed?: boolean;
}

function edgeStatus(e: EdgeData, ctx: RouteContext): boolean | undefined {
	if (e.k === 'l') return ctx.liftOpen?.(e.o) ?? undefined;
	if (e.k !== 'p') return true;
	let closed = false;
	for (const owner of [e.o, ...(e.o2 ?? [])]) {
		const open = ctx.pisteOpen?.(owner);
		if (open === true) return true;
		if (open === false) closed = true;
	}
	return closed ? false : undefined;
}

const PISTE_SPEED: Record<Difficulty, number> = {
	novice: 4.5,
	easy: 7,
	intermediate: 8,
	advanced: 6.5,
	expert: 5.5,
	freeride: 4.5,
	unknown: 6.5
};
const DEFAULT_WAIT: Record<LiftType, number> = {
	cable_car: 300,
	gondola: 150,
	mixed_lift: 150,
	chair_lift: 120,
	't-bar': 90,
	'j-bar': 90,
	platter: 60,
	drag_lift: 60,
	rope_tow: 30,
	magic_carpet: 30
};
export const FLAT_GRADIENT = 0.05;
const MAX_RANK: Record<RoutePrefs['maxDifficulty'], number> = {
	easy: 1,
	intermediate: 2,
	advanced: 3
};

interface Limits {
	maxRank: number;
	allowDrag: boolean;
}

export function findRoute(
	resort: Resort,
	from: number[],
	to: number[],
	prefs: RoutePrefs,
	ctx: RouteContext = {}
): Route | null {
	const limits = { maxRank: MAX_RANK[prefs.maxDifficulty], allowDrag: !prefs.avoidDragLifts };
	const arcs = search(resort, from, to, prefs, limits, ctx);
	if (!arcs) return null;
	const route = describe(resort, arcs, ctx);
	if (route.steps.some((s) => s.closed)) route.usesClosed = true;
	return route;
}

function arcCost(
	resort: Resort,
	arc: Arc,
	prevLift: number,
	prefs: RoutePrefs,
	limits: Limits,
	ctx: RouteContext
): number {
	const { edges, nodes, lifts } = resort.data;
	const e = edges[arcEdge(arc)];
	const reversed = arcReversed(arc);
	const drop = (nodes[e.a][2] - nodes[e.b][2]) * (reversed ? -1 : 1);

	if (!ctx.allowClosed && edgeStatus(e, ctx) === false) return Infinity;

	if (e.k === 'l') {
		const lift = lifts[e.o];
		if (!limits.allowDrag && DRAG_LIFTS.has(lift.type)) return Infinity;
		const ride = lift.duration * (e.len / lift.length);
		if (prevLift === e.o) return ride;
		return ride + (ctx.liftWait?.(e.o) ?? DEFAULT_WAIT[lift.type]);
	}

	if (e.k === 'c') {
		return e.len / (drop >= 0 ? 2 : 1.1) + Math.max(0, -drop) * 5;
	}

	const d = e.d ?? 'easy';
	if (DIFFICULTY_RANK[d] > limits.maxRank) return Infinity;
	const gradient = drop / e.len;
	let time: number;
	if (gradient < -0.01) {
		time = e.len / 1.1 + -drop * 5;
		if (prefs.avoidFlats) time *= 1.5;
	} else if (gradient < FLAT_GRADIENT) {
		time = e.len / (prefs.avoidFlats ? 2.2 : 4);
	} else {
		time = e.len / PISTE_SPEED[d];
	}
	return time * (ctx.edgeFactor?.(arcEdge(arc)) ?? 1);
}

function search(
	resort: Resort,
	from: number[],
	to: number[],
	prefs: RoutePrefs,
	limits: Limits,
	ctx: RouteContext
): Arc[] | null {
	const { edges, nodes, lifts } = resort.data;
	const N = nodes.length;
	const S = N * (lifts.length + 1);
	const best = new Float64Array(S).fill(Infinity);
	const prevState = new Int32Array(S).fill(-1);
	const prevArc = new Int32Array(S).fill(-1);
	const targets = new Set(to);
	const heap = new MinHeap();
	for (const n of from) {
		best[n] = 0;
		heap.push(n, 0);
	}

	let end = -1;
	while (heap.size) {
		const [state, cost] = heap.pop();
		if (cost > best[state]) continue;
		const node = state % N;
		if (targets.has(node)) {
			end = state;
			break;
		}
		const onLift = Math.floor(state / N) - 1;
		for (const arc of resort.out[node]) {
			const e = edges[arcEdge(arc)];
			const c = arcCost(resort, arc, onLift, prefs, limits, ctx);
			if (c === Infinity) continue;
			const next = resort.arcTo(arc) + (e.k === 'l' ? N * (e.o + 1) : 0);
			const total = cost + c;
			if (total < best[next]) {
				best[next] = total;
				prevState[next] = state;
				prevArc[next] = arc;
				heap.push(next, total);
			}
		}
	}
	if (end < 0) return null;
	const arcs: Arc[] = [];
	for (let s = end; prevArc[s] >= 0; s = prevState[s]) arcs.push(prevArc[s]);
	return arcs.reverse();
}

export function describe(resort: Resort, arcs: Arc[], ctx: RouteContext = {}): Route {
	const { edges, nodes, lifts, pistes } = resort.data;
	const neutralPrefs: RoutePrefs = {
		maxDifficulty: 'advanced',
		avoidDragLifts: false,
		avoidFlats: false,
		preferGoodSnow: false
	};
	const open: Limits = { maxRank: 4, allowDrag: true };
	const steps: RouteStep[] = [];
	let owners: number[] = [];

	for (const arc of arcs) {
		const e = edges[arcEdge(arc)];
		const reversed = arcReversed(arc);
		const drop = (nodes[e.a][2] - nodes[e.b][2]) * (reversed ? -1 : 1);
		const kind = e.k === 'p' ? 'piste' : e.k === 'l' ? 'lift' : 'walk';
		const last = steps[steps.length - 1];
		const edgeOwners = e.k === 'p' ? [e.o, ...(e.o2 ?? [])] : [e.o];
		const shared = owners.filter((o) => edgeOwners.includes(o));
		const sameStep = last && last.kind === kind && (kind === 'walk' || shared.length > 0);

		let step: RouteStep;
		if (sameStep) {
			step = last;
			if (kind === 'piste') owners = shared;
		} else {
			owners = edgeOwners;
			step = {
				kind,
				owner: e.o,
				name: '',
				length: 0,
				time: 0,
				wait: 0,
				up: 0,
				down: 0,
				flat: 0,
				arcs: [],
				coords: []
			};
			if (kind === 'lift') {
				step.liftType = lifts[e.o].type;
				step.downhillRide = reversed;
				step.wait = ctx.liftWait?.(e.o) ?? DEFAULT_WAIT[lifts[e.o].type];
			}
			steps.push(step);
		}

		const prevLift = sameStep && kind === 'lift' ? e.o : -1;
		step.time += arcCost(resort, arc, prevLift, neutralPrefs, open, { liftWait: ctx.liftWait });
		step.length += e.len;
		if (drop > 0) step.down += drop;
		else step.up -= drop;
		if (kind === 'piste') {
			if (drop / e.len < FLAT_GRADIENT) step.flat += e.len;
			const d = e.d ?? 'easy';
			if (!step.difficulty || DIFFICULTY_RANK[d] > DIFFICULTY_RANK[step.difficulty])
				step.difficulty = d;
			step.owner = owners[0];
		}
		step.arcs.push(arc);
		const coords = resort.arcCoords(arc);
		step.coords.push(...(step.coords.length ? coords.slice(1) : coords));
	}

	for (const step of steps) {
		step.name =
			step.kind === 'piste'
				? resort.pisteName(pistes[step.owner])
				: step.kind === 'lift'
					? lifts[step.owner].name
					: t.route.walk;
		if (step.kind === 'lift') {
			const open = ctx.liftOpen?.(step.owner);
			step.closed = open === false;
			step.unreported = !!ctx.liftOpen && open == null;
		} else if (step.kind === 'piste') {
			const owners = new Set<number>();
			for (const arc of step.arcs) {
				const e = edges[arcEdge(arc)];
				owners.add(e.o);
				for (const o of e.o2 ?? []) owners.add(o);
			}
			step.closed = [...owners].every((o) => ctx.pisteOpen?.(o) === false);
			step.unreported =
				!!ctx.pisteOpen &&
				[...owners].every((o) => ctx.pisteOpen!(o) == null) &&
				[...owners].some((o) => !!pistes[o].ref);
		}
	}

	const route: Route = { steps, time: 0, length: 0, up: 0, down: 0, coords: [] };
	for (const s of steps) {
		route.time += s.time;
		route.length += s.length;
		route.up += s.up;
		route.down += s.down;
		route.coords.push(...(route.coords.length ? s.coords.slice(1) : s.coords));
	}
	return route;
}

class MinHeap {
	private keys: number[] = [];
	private vals: number[] = [];
	get size() {
		return this.keys.length;
	}
	push(key: number, val: number) {
		const { keys, vals } = this;
		let i = keys.push(key) - 1;
		vals.push(val);
		while (i > 0) {
			const p = (i - 1) >> 1;
			if (vals[p] <= val) break;
			keys[i] = keys[p];
			vals[i] = vals[p];
			i = p;
		}
		keys[i] = key;
		vals[i] = val;
	}
	pop(): [number, number] {
		const { keys, vals } = this;
		const top: [number, number] = [keys[0], vals[0]];
		const key = keys.pop()!;
		const val = vals.pop()!;
		const n = keys.length;
		if (n) {
			let i = 0;
			for (;;) {
				let c = i * 2 + 1;
				if (c >= n) break;
				if (c + 1 < n && vals[c + 1] < vals[c]) c++;
				if (vals[c] >= val) break;
				keys[i] = keys[c];
				vals[i] = vals[c];
				i = c;
			}
			keys[i] = key;
			vals[i] = val;
		}
		return top;
	}
}
