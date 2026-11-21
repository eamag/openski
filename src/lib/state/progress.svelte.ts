import { matchTrack, type TrackPoint } from '#lib/resort/match.ts';
import type { Resort } from '#lib/resort/model.ts';
import {
	clearDraft,
	deletePoints,
	loadManual,
	loadPoints,
	loadSessions,
	saveManual,
	savePoints,
	saveSessions,
	sessionFromMatch,
	type ManualMarks,
	type Session
} from '#lib/storage.ts';
import { app } from './app.svelte.ts';

export const PISTE_DONE = 0.8;

export interface PisteProgress {
	share: number;
	manual: boolean;
	done: boolean;
}

class ProgressState {
	sessions = $state.raw<Session[]>([]);
	manual = $state.raw<ManualMarks>({ pistes: [], lifts: [] });
	live = $state.raw<{ edges: number[]; lifts: number[] }>({ edges: [], lifts: [] });
	ready = $state(false);

	private loadedFor: string | null = null;

	here = $derived.by(() => {
		const id = app.resort?.id;
		return this.sessions.filter((s) => s.resort === id).sort((a, b) => b.start - a.start);
	});

	tracked = $derived.by(() => {
		const set = new Set<number>(this.live.edges);
		for (const s of this.here) for (const e of s.match.edges) set.add(e);
		return set;
	});

	pistes = $derived.by((): PisteProgress[] => {
		const resort = app.resort;
		if (!resort) return [];
		const manual = new Set(this.manual.pistes);
		const tracked = this.tracked;
		return resort.data.pistes.map((p, i) => {
			let covered = 0;
			let total = 0;
			for (const e of resort.pisteEdges[i]) {
				const len = resort.data.edges[e].len;
				total += len;
				if (tracked.has(e)) covered += len;
			}
			const share = total ? covered / total : 0;
			const isManual = manual.has(p.id);
			return { share, manual: isManual, done: isManual || share >= PISTE_DONE };
		});
	});

	covered = $derived.by(() => {
		const resort = app.resort;
		const set = new Set(this.tracked);
		if (!resort) return set;
		this.pistes.forEach((p, i) => {
			if (p.manual) for (const e of resort.pisteEdges[i]) set.add(e);
		});
		return set;
	});

	lifts = $derived.by((): boolean[] => {
		const resort = app.resort;
		if (!resort) return [];
		const ridden = new Set<number>(this.live.lifts);
		for (const s of this.here) for (const l of s.match.lifts) ridden.add(l);
		const manual = new Set(this.manual.lifts);
		return resort.data.lifts.map((l, i) => ridden.has(i) || manual.has(l.id));
	});

	summary = $derived.by(() => {
		const resort = app.resort;
		if (!resort) return null;
		const { pistes, edges, lifts } = resort.data;
		const covered = this.covered;
		let km = 0;
		for (const e of covered) if (pistes[edges[e].o].counted) km += edges[e].len;
		const counted = pistes.map((p, i) => ({ p, s: this.pistes[i] })).filter((x) => x.p.counted);
		const realLifts = lifts
			.map((l, i) => ({ l, done: this.lifts[i] }))
			.filter((x) => x.l.length > 150);
		return {
			share: resort.countedLength ? km / resort.countedLength : 0,
			km: km / 1000,
			totalKm: resort.countedLength / 1000,
			pistesDone: counted.filter((x) => x.s.done).length,
			pistesTotal: counted.length,
			liftsDone: realLifts.filter((x) => x.done).length,
			liftsTotal: realLifts.length
		};
	});

	reset(): void {
		this.manual = { pistes: [], lifts: [] };
		this.live = { edges: [], lifts: [] };
		this.ready = false;
		this.loadedFor = null;
	}

	async init(resort: Resort) {
		if (this.loadedFor === resort.id) return;
		this.loadedFor = resort.id;
		const [sessions, manual] = await Promise.all([loadSessions(), loadManual(resort.id)]);
		this.manual = manual;
		let changed = false;
		for (const s of sessions) {
			if (s.resort !== resort.id || s.match.version === resort.data.version) continue;
			const points = await loadPoints(s.id);
			if (!points.length) continue;
			const m = matchTrack(resort, points);
			s.match = { version: resort.data.version, edges: m.edges, lifts: m.lifts };
			s.stats = m.stats;
			changed = true;
		}
		this.sessions = sessions;
		if (changed) await saveSessions(sessions);
		this.ready = true;
	}

	async addSession(
		name: string,
		source: Session['source'],
		points: TrackPoint[],
		targetResort?: Resort
	): Promise<Session | null> {
		const resort = targetResort ?? app.resort;
		if (!resort || points.length < 2) return null;
		const session = sessionFromMatch(resort.data, name, source, points, matchTrack(resort, points));
		await savePoints(session.id, points);
		this.sessions = [...this.sessions, session];
		await saveSessions(this.sessions);
		return session;
	}

	async removeSession(id: string) {
		this.sessions = this.sessions.filter((s) => s.id !== id);
		await Promise.all([saveSessions(this.sessions), deletePoints(id)]);
	}

	async clearDays(resortId: string): Promise<void> {
		const gone = this.sessions.filter((s) => s.resort === resortId);
		this.sessions = this.sessions.filter((s) => s.resort !== resortId);
		this.manual = { pistes: [], lifts: [] };
		this.live = { edges: [], lifts: [] };
		await Promise.all([
			saveSessions(this.sessions),
			saveManual(resortId, this.manual),
			clearDraft(),
			...gone.map((s) => deletePoints(s.id))
		]);
	}

	async togglePiste(id: string) {
		const has = this.manual.pistes.includes(id);
		this.manual = {
			...this.manual,
			pistes: has ? this.manual.pistes.filter((p) => p !== id) : [...this.manual.pistes, id]
		};
		if (app.resort) await saveManual(app.resort.id, this.manual);
	}

	async toggleLift(id: string) {
		const has = this.manual.lifts.includes(id);
		this.manual = {
			...this.manual,
			lifts: has ? this.manual.lifts.filter((l) => l !== id) : [...this.manual.lifts, id]
		};
		if (app.resort) await saveManual(app.resort.id, this.manual);
	}
}

export const progress = new ProgressState();
