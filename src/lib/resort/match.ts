import { angleDiff, bearing, haversine } from '../geo.ts';
import type { Resort } from './model.ts';

export interface TrackPoint {
	t: number;
	lat: number;
	lon: number;
	ele?: number;
	acc?: number;
	spd?: number;
	hr?: number;
}

export interface TrackStats {
	distance: number;
	descent: number;
	maxSpeed: number;
	movingTime: number;
	duration: number;
	runs: number;
	liftRides: number;
	maxEle: number;
	avgHr?: number;
	maxHr?: number;
}

export interface MatchResult {
	edges: number[];
	lifts: number[];
	stats: TrackStats;
}

export type Activity = 'idle' | 'ride' | 'lift';

const PISTE_MATCH_RADIUS_METERS = 45;
const LIFT_MATCH_RADIUS_METERS = 28;
const MIN_SAMPLES_TO_CONFIRM_LIFT = 4;
const MAX_GPS_ACCURACY_METERS = 60;
const MAX_VALID_SPEED_METERS_PER_SEC = 45;
const ELEVATION_HYSTERESIS_STEP_METERS = 4;
const MAX_CONTINUOUS_GPS_GAP_SECONDS = 30;
const MIN_SPEED_TO_START_RUN_METERS_PER_SEC = 2;
const MAX_LIFT_MISSES_BEFORE_IDLE = 3;
const MAX_LIFT_HEADING_DEVIATION_DEG = 25;
const MIN_BIDIRECTIONAL_LIFT_HEADING_DEG = 155;
const MAX_PISTE_HEADING_DEVIATION_DEG = 100;
const LIFT_SPEED_TOLERANCE_FACTOR = 1.4;
const LIFT_SPEED_MARGIN_METERS_PER_SEC = 0.5;

export class TrackMatcher {
	readonly edges = new Map<number, number>();
	readonly lifts = new Map<number, number>();
	readonly stats: TrackStats = {
		distance: 0,
		descent: 0,
		maxSpeed: 0,
		movingTime: 0,
		duration: 0,
		runs: 0,
		liftRides: 0,
		maxEle: 0
	};
	activity: Activity = 'idle';
	currentEdge = -1;
	currentLift = -1;
	speed = 0;

	private prev: TrackPoint | null = null;
	private first = 0;
	private heading: number | null = null;
	private recent: number[] = [];
	private liftCandidate = -1;
	private liftStreak = 0;
	private liftMisses = 0;
	private refEle: number | null = null;
	private hrSum = 0;
	private hrCount = 0;

	constructor(private readonly resort: Resort) {}

	push(point: TrackPoint): void {
		if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon)) return;
		if (point.acc !== undefined && point.acc > MAX_GPS_ACCURACY_METERS) return;
		const prev = this.prev;
		if (!prev) {
			this.prev = point;
			this.first = point.t;
			if (point.ele !== undefined) this.stats.maxEle = point.ele;
			return;
		}
		const dtSeconds = (point.t - prev.t) / 1000;
		if (dtSeconds <= 0) return;
		const distanceMeters = haversine([prev.lon, prev.lat], [point.lon, point.lat]);
		const rawSpeed = distanceMeters / dtSeconds;
		if (rawSpeed > MAX_VALID_SPEED_METERS_PER_SEC) return;
		const isLongGpsGap = dtSeconds > MAX_CONTINUOUS_GPS_GAP_SECONDS;
		const speed = isLongGpsGap ? 0 : (point.spd ?? rawSpeed);
		this.recent.push(speed);
		if (this.recent.length > 3) this.recent.shift();
		this.speed = [...this.recent].sort((a, b) => a - b)[this.recent.length >> 1];
		if (distanceMeters > 4) {
			this.heading = bearing([prev.lon, prev.lat], [point.lon, point.lat]);
		}
		this.prev = point;
		this.stats.duration = (point.t - this.first) / 1000;
		if (point.ele !== undefined && point.ele > this.stats.maxEle) {
			this.stats.maxEle = point.ele;
		}
		if (point.hr) {
			this.hrSum += point.hr;
			this.hrCount++;
			this.stats.avgHr = Math.round(this.hrSum / this.hrCount);
			this.stats.maxHr = Math.max(this.stats.maxHr ?? 0, point.hr);
		}

		const moving = this.speed > 1;
		const lift = moving ? this.liftUnder(point) : -1;
		if (lift >= 0 && lift === this.liftCandidate) this.liftStreak++;
		else if (lift >= 0) {
			this.liftCandidate = lift;
			this.liftStreak = 1;
		}

		if (this.activity === 'lift') {
			if (lift === this.currentLift) this.liftMisses = 0;
			else if (++this.liftMisses >= MAX_LIFT_MISSES_BEFORE_IDLE) {
				this.activity = 'idle';
				this.currentLift = -1;
				this.refEle = null;
			}
		}
		if (this.activity !== 'lift' && lift >= 0 && this.liftStreak >= MIN_SAMPLES_TO_CONFIRM_LIFT) {
			this.activity = 'lift';
			this.currentLift = lift;
			this.currentEdge = -1;
			this.liftMisses = 0;
			this.stats.liftRides++;
			this.lifts.set(lift, (this.lifts.get(lift) ?? 0) + 1);
			this.refEle = null;
		}
		if (lift < 0) this.liftStreak = 0;
		if (this.activity === 'lift') return;

		if (!moving) {
			if (this.speed < 0.4) this.activity = 'idle';
			return;
		}

		if (lift >= 0 && this.activity !== 'ride') return;
		const edge = this.pisteUnder(point);
		if (this.activity !== 'ride') {
			const isDescendingPiste = edge >= 0 && this.speed >= MIN_SPEED_TO_START_RUN_METERS_PER_SEC;
			if (!isDescendingPiste) return;
			this.activity = 'ride';
			this.stats.runs++;
		}
		if (!isLongGpsGap) {
			this.stats.distance += distanceMeters;
			this.stats.movingTime += dtSeconds;
			if (this.speed > this.stats.maxSpeed) this.stats.maxSpeed = this.speed;
		}
		const eleNow = point.ele ?? (edge >= 0 ? this.edgeEle(edge) : undefined);
		if (eleNow !== undefined) {
			if (this.refEle === null) this.refEle = eleNow;
			else if (eleNow < this.refEle - ELEVATION_HYSTERESIS_STEP_METERS) {
				this.stats.descent += this.refEle - eleNow;
				this.refEle = eleNow;
			} else if (eleNow > this.refEle + ELEVATION_HYSTERESIS_STEP_METERS) {
				this.refEle = eleNow;
			}
		}
		if (edge >= 0 && edge !== this.currentEdge) {
			if (this.currentEdge >= 0) this.fillGap(this.currentEdge, edge);
			this.edges.set(edge, (this.edges.get(edge) ?? 0) + 1);
			this.currentEdge = edge;
		}
	}

	result(): MatchResult {
		return {
			edges: [...this.edges.keys()],
			lifts: [...this.lifts.keys()],
			stats: { ...this.stats }
		};
	}

	private liftUnder(point: TrackPoint): number {
		if (this.heading === null) return -1;
		const heading = this.heading;
		const hit = this.resort.nearestEdge(point.lon, point.lat, LIFT_MATCH_RADIUS_METERS, (e) => {
			return e.k === 'l';
		});
		if (!hit) return -1;
		const edge = this.resort.data.edges[hit.edge];
		const lift = this.resort.data.lifts[edge.o];
		const headingDeviation = angleDiff(heading, hit.bearing);
		const matchesLiftDirection =
			headingDeviation <= MAX_LIFT_HEADING_DEVIATION_DEG ||
			(edge.bi && headingDeviation >= MIN_BIDIRECTIONAL_LIFT_HEADING_DEG);
		if (!matchesLiftDirection) return -1;
		const liftRatedSpeed = lift.length / lift.duration;
		const maxBelievableLiftSpeed =
			liftRatedSpeed * LIFT_SPEED_TOLERANCE_FACTOR + LIFT_SPEED_MARGIN_METERS_PER_SEC;
		if (this.speed > maxBelievableLiftSpeed) return -1;
		return edge.o;
	}

	private pisteUnder(point: TrackPoint): number {
		const heading = this.heading;
		const hits = this.resort.nearestEdges(
			point.lon,
			point.lat,
			PISTE_MATCH_RADIUS_METERS,
			(e) => e.k === 'p'
		);
		for (const hit of hits) {
			const edge = this.resort.data.edges[hit.edge];
			if (
				heading === null ||
				edge.bi ||
				angleDiff(heading, hit.bearing) <= MAX_PISTE_HEADING_DEVIATION_DEG
			) {
				return hit.edge;
			}
		}
		return -1;
	}

	private edgeEle(edge: number): number {
		const e = this.resort.data.edges[edge];
		const n = this.resort.data.nodes;
		return (n[e.a][2] + n[e.b][2]) / 2;
	}

	private fillGap(from: number, to: number): void {
		const { edges } = this.resort.data;
		const start = edges[from].b;
		const goal = edges[to].a;
		if (start === goal) return;
		const prevEdge = new Map<number, number>([[start, -1]]);
		let frontier = [start];
		for (let depth = 0; depth < 5 && frontier.length; depth++) {
			const next: number[] = [];
			for (const node of frontier) {
				for (const arc of this.resort.out[node]) {
					const ei = arc >> 1;
					if (edges[ei].k !== 'p' || arc & 1) continue;
					const m = edges[ei].b;
					if (prevEdge.has(m)) continue;
					prevEdge.set(m, ei);
					if (m === goal) {
						for (let n = m; prevEdge.get(n)! >= 0; n = edges[prevEdge.get(n)!].a) {
							const ei2 = prevEdge.get(n)!;
							this.edges.set(ei2, (this.edges.get(ei2) ?? 0) + 1);
						}
						return;
					}
					next.push(m);
				}
			}
			frontier = next;
		}
	}
}

export function matchTrack(resort: Resort, points: TrackPoint[]): MatchResult {
	const matcher = new TrackMatcher(resort);
	for (const point of points) matcher.push(point);
	return matcher.result();
}
