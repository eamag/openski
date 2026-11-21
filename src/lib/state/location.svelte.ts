import { bearing, haversine, type LngLat } from '#lib/geo.ts';

export interface Fix {
	t: number;
	lon: number;
	lat: number;
	acc: number;
	ele?: number;
	spd?: number;
	heading?: number;
}

export interface LocationSource {
	start(onFix: (fix: Fix) => void, onError: (reason: 'denied' | 'unavailable') => void): void;
	stop(): void;
}

class BrowserLocation implements LocationSource {
	private watch: number | null = null;
	start(onFix: (fix: Fix) => void, onError: (reason: 'denied' | 'unavailable') => void) {
		if (!('geolocation' in navigator)) return onError('unavailable');
		this.watch = navigator.geolocation.watchPosition(
			(pos) => {
				const c = pos.coords;
				onFix({
					t: pos.timestamp,
					lon: c.longitude,
					lat: c.latitude,
					acc: c.accuracy,
					ele: c.altitude ?? undefined,
					spd: c.speed ?? undefined,
					heading: c.heading !== null && !Number.isNaN(c.heading) ? c.heading : undefined
				});
			},
			(err) => onError(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable'),
			{ enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 }
		);
	}
	stop() {
		if (this.watch !== null) navigator.geolocation.clearWatch(this.watch);
		this.watch = null;
	}
}

const SIMULATED_FIX_ACCURACY_METERS = 6;
const ONE_SECOND_MS = 1000;
const MIN_STEP_DISTANCE_METERS = 0.1;

export class SimulatedLocation implements LocationSource {
	private timer: ReturnType<typeof setInterval> | null = null;
	constructor(
		private readonly path: { at: LngLat; ele: number; speed: number }[],
		private readonly rate = 1
	) {}
	start(onFix: (fix: Fix) => void) {
		let i = 0;
		let along = 0;
		let t = Date.now();
		this.timer = setInterval(() => {
			if (i >= this.path.length - 1) return this.stop();
			along += this.path[i].speed;
			t += ONE_SECOND_MS;
			for (;;) {
				const len = haversine(this.path[i].at, this.path[i + 1].at);
				if (along < len || i >= this.path.length - 2) break;
				along -= len;
				i++;
			}
			const p = this.path[i];
			const q = this.path[i + 1];
			const f = Math.min(1, along / Math.max(MIN_STEP_DISTANCE_METERS, haversine(p.at, q.at)));
			onFix({
				t,
				lon: p.at[0] + (q.at[0] - p.at[0]) * f,
				lat: p.at[1] + (q.at[1] - p.at[1]) * f,
				acc: SIMULATED_FIX_ACCURACY_METERS,
				ele: p.ele + (q.ele - p.ele) * f,
				spd: p.speed,
				heading: bearing(p.at, q.at)
			});
			if (i >= this.path.length - 2 && f >= 1) this.stop();
		}, ONE_SECOND_MS / this.rate);
	}
	stop() {
		if (this.timer) clearInterval(this.timer);
		this.timer = null;
	}
}

export type LocationStatus = 'off' | 'pending' | 'on' | 'denied' | 'unavailable';

class LocationState {
	fix = $state.raw<Fix | null>(null);
	status = $state<LocationStatus>('off');
	simulated = $state(false);
	private source: LocationSource = new BrowserLocation();
	private listeners = new Set<(fix: Fix) => void>();

	start() {
		if (this.status === 'on' || this.status === 'pending') return;
		this.status = 'pending';
		this.source.start(
			(fix) => {
				this.fix = fix;
				this.status = 'on';
				for (const fn of this.listeners) fn(fix);
			},
			(reason) => {
				this.status = reason;
			}
		);
	}

	stop() {
		this.source.stop();
		this.status = 'off';
	}

	use(source: LocationSource, simulated = false) {
		const wasOn = this.status === 'on' || this.status === 'pending';
		this.source.stop();
		this.source = source;
		this.simulated = simulated;
		this.status = 'off';
		this.fix = null;
		if (wasOn || simulated) this.start();
	}

	useBrowser() {
		this.use(new BrowserLocation());
	}

	subscribe(fn: (fix: Fix) => void): () => void {
		this.listeners.add(fn);
		return () => this.listeners.delete(fn);
	}
}

export const location = new LocationState();
