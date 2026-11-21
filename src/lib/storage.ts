import { del, get, set } from 'idb-keyval';
import type { MatchResult, TrackPoint, TrackStats } from './resort/match.ts';

export interface Session {
	id: string;
	resort: string;
	name: string;
	source: 'live' | 'import';
	start: number;
	end: number;
	points: number;
	stats: TrackStats;
	match: { version: string; edges: number[]; lifts: number[] };
}

export interface ManualMarks {
	pistes: string[];
	lifts: string[];
}

const STORAGE_KEYS = {
	sessions: 'sessions',
	points: (sessionId: string) => `points:${sessionId}`,
	manualMarks: (resortId: string) => `manual:${resortId}`,
	inProgressDraft: 'draft',
	userPreferences: 'prefs'
};

async function withStorageFallback<T>(operation: () => Promise<T>, fallback: T): Promise<T> {
	try {
		return await operation();
	} catch {
		return fallback;
	}
}

export const loadSessions = () =>
	withStorageFallback(async () => (await get<Session[]>(STORAGE_KEYS.sessions)) ?? [], []);
export const saveSessions = (sessions: Session[]) =>
	withStorageFallback(() => set(STORAGE_KEYS.sessions, sessions), undefined);

export const loadPoints = (id: string) =>
	withStorageFallback(async () => (await get<TrackPoint[]>(STORAGE_KEYS.points(id))) ?? [], []);
export const savePoints = (id: string, points: TrackPoint[]) =>
	withStorageFallback(() => set(STORAGE_KEYS.points(id), points), undefined);
export const deletePoints = (id: string) =>
	withStorageFallback(() => del(STORAGE_KEYS.points(id)), undefined);

export const loadManual = (resort: string) =>
	withStorageFallback(
		async () =>
			(await get<ManualMarks>(STORAGE_KEYS.manualMarks(resort))) ?? { pistes: [], lifts: [] },
		{ pistes: [], lifts: [] }
	);
export const saveManual = (resort: string, marks: ManualMarks) =>
	withStorageFallback(() => set(STORAGE_KEYS.manualMarks(resort), marks), undefined);

export interface Draft {
	resort: string;
	start: number;
	points: TrackPoint[];
}
export const loadDraft = () =>
	withStorageFallback(() => get<Draft>(STORAGE_KEYS.inProgressDraft), undefined);
export const saveDraft = (draft: Draft) =>
	withStorageFallback(() => set(STORAGE_KEYS.inProgressDraft, draft), undefined);
export const clearDraft = () =>
	withStorageFallback(() => del(STORAGE_KEYS.inProgressDraft), undefined);

export const loadPrefs = <T>() =>
	withStorageFallback(() => get<T>(STORAGE_KEYS.userPreferences), undefined);
export const savePrefs = <T>(prefs: T) =>
	withStorageFallback(() => set(STORAGE_KEYS.userPreferences, prefs), undefined);

export function sessionFromMatch(
	resort: { id: string; version: string },
	name: string,
	source: Session['source'],
	points: TrackPoint[],
	match: MatchResult
): Session {
	return {
		id: `${points[0]?.t ?? Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
		resort: resort.id,
		name,
		source,
		start: points[0]?.t ?? Date.now(),
		end: points[points.length - 1]?.t ?? Date.now(),
		points: points.length,
		stats: match.stats,
		match: { version: resort.version, edges: match.edges, lifts: match.lifts }
	};
}
