import {
	TrackMatcher,
	type Activity,
	type TrackPoint,
	type TrackStats
} from '#lib/resort/match.ts';
import type { Resort } from '#lib/resort/model.ts';
import { clearDraft, loadDraft, saveDraft } from '#lib/storage.ts';
import type { LngLat } from '#lib/geo.ts';
import { formatDate } from '#lib/i18n/index.ts';
import { app } from './app.svelte.ts';
import { location, type Fix } from './location.svelte.ts';
import { progress } from './progress.svelte.ts';

const EMPTY_STATS: TrackStats = {
	distance: 0,
	descent: 0,
	maxSpeed: 0,
	movingTime: 0,
	duration: 0,
	runs: 0,
	liftRides: 0,
	maxEle: 0
};

const MIN_SESSION_POINTS = 10;
const DRAFT_AUTOSAVE_INTERVAL_MS = 15_000;

class TrackingState {
	recording = $state(false);
	stats = $state.raw<TrackStats>(EMPTY_STATS);
	activity = $state<Activity>('idle');
	speed = $state(0);
	on = $state<string | null>(null);
	path = $state.raw<LngLat[]>([]);
	startedAt = $state(0);
	wakeLockFailed = $state(false);
	recoverable = $state.raw<{ start: number; points: number } | null>(null);
	recordingResort = $state.raw<Resort | null>(null);

	private points: TrackPoint[] = [];
	private matcher: TrackMatcher | null = null;
	private unsubscribe: (() => void) | null = null;
	private wakeLock: WakeLockSentinel | null = null;
	private lastSave = 0;

	async checkDraft() {
		const resort = app.resort;
		const draft = await loadDraft();
		if (draft && draft.points.length > 1 && !this.recording) {
			if (resort && draft.resort === resort.id) {
				this.recoverable = { start: draft.start, points: draft.points.length };
			} else {
				this.recoverable = null;
			}
		} else {
			this.recoverable = null;
		}
	}

	async start(resume = false) {
		const resort = app.resort;
		if (!resort || this.recording) return;
		this.recordingResort = resort;
		this.points = [];
		this.matcher = new TrackMatcher(resort);
		this.startedAt = Date.now();
		if (resume) {
			const draft = await loadDraft();
			if (draft && draft.resort === resort.id) {
				this.points = draft.points;
				this.startedAt = draft.start;
				for (const p of draft.points) this.matcher.push(p);
			}
		}
		this.recoverable = null;
		this.recording = true;
		this.publish();
		location.start();
		this.unsubscribe = location.subscribe((fix) => this.onFix(fix));
		await this.acquireWakeLock();
		document.addEventListener('visibilitychange', this.onVisible);
	}

	async stop(): Promise<boolean> {
		if (!this.recording) return false;
		this.recording = false;
		this.unsubscribe?.();
		this.unsubscribe = null;
		document.removeEventListener('visibilitychange', this.onVisible);
		await this.wakeLock?.release().catch(() => {});
		this.wakeLock = null;
		const points = this.points;
		const resort = this.recordingResort ?? app.resort;
		this.recordingResort = null;
		this.points = [];
		this.matcher = null;
		progress.live = { edges: [], lifts: [] };
		this.path = [];
		this.on = null;
		await clearDraft();
		if (points.length < MIN_SESSION_POINTS || !resort) return false;
		const day = formatDate(points[0].t, {
			weekday: 'short',
			day: 'numeric',
			month: 'short'
		});
		return !!(await progress.addSession(day, 'live', points, resort));
	}

	async discardDraft() {
		this.recoverable = null;
		await clearDraft();
	}

	async saveDraftAsSession() {
		const draft = await loadDraft();
		this.recoverable = null;
		if (draft && draft.points.length > MIN_SESSION_POINTS) {
			const day = formatDate(draft.start, {
				weekday: 'short',
				day: 'numeric',
				month: 'short'
			});
			await progress.addSession(day, 'live', draft.points);
		}
		await clearDraft();
	}

	private onFix(fix: Fix) {
		const resort = this.recordingResort;
		if (!this.matcher || !resort) return;
		const p: TrackPoint = { t: fix.t, lat: fix.lat, lon: fix.lon, acc: fix.acc };
		if (fix.ele !== undefined) p.ele = +fix.ele.toFixed(1);
		if (fix.spd !== undefined) p.spd = +fix.spd.toFixed(2);
		this.points.push(p);
		this.matcher.push(p);
		this.publish();
		if (fix.t - this.lastSave > DRAFT_AUTOSAVE_INTERVAL_MS) {
			this.lastSave = fix.t;
			void saveDraft({ resort: resort.id, start: this.startedAt, points: this.points });
		}
	}

	private publish() {
		const m = this.matcher;
		const resort = this.recordingResort;
		if (!m || !resort) return;
		this.stats = { ...m.stats };
		this.activity = m.activity;
		this.speed = m.speed;
		const { edges, pistes, lifts } = resort.data;
		this.on =
			m.activity === 'lift' && m.currentLift >= 0
				? lifts[m.currentLift].name
				: m.activity === 'ride' && m.currentEdge >= 0
					? resort.pisteName(pistes[edges[m.currentEdge].o])
					: null;
		if (app.resort?.id === resort.id) {
			if (
				m.edges.size !== progress.live.edges.length ||
				m.lifts.size !== progress.live.lifts.length
			)
				progress.live = { edges: [...m.edges.keys()], lifts: [...m.lifts.keys()] };
		}
		const last = this.points[this.points.length - 1];
		if (last) this.path = [...this.path, [last.lon, last.lat]];
	}

	private async acquireWakeLock() {
		try {
			this.wakeLock = (await navigator.wakeLock?.request('screen')) ?? null;
			this.wakeLockFailed = !this.wakeLock;
		} catch {
			this.wakeLockFailed = true;
		}
	}

	private onVisible = () => {
		if (document.visibilityState === 'visible' && this.recording) void this.acquireWakeLock();
	};
}

export const tracking = new TrackingState();
