import type { LiftKind, ResortStatus } from './intermaps.ts';

export const mtnPowderUrl = (resortId: number) => `https://mtnpowder.com/feed?resortId=${resortId}`;

interface Lift {
	Name?: string;
	StatusEnglish?: string;
	LiftType?: string;
}

interface Area {
	Lifts?: Lift[];
}

interface MtnPowderDoc {
	LastUpdate?: string;
	MountainAreas?: Area[];
}

const MTN_POWDER_OPEN_STATUS = 'open';

function liftKind(type = ''): LiftKind {
	const s = type.toLowerCase();
	if (/gondola|tram|cable|funitel|cabriolet/.test(s)) return 'gondola';
	if (/chair|double|triple|quad|six|eight|express|detachable/.test(s)) return 'chair';
	if (/surface|platter|t-?bar|j-?bar|rope|tow|magic|carpet|drag/.test(s)) return 'drag';
	return 'other';
}

export function parseMtnPowder(doc: unknown): ResortStatus {
	const feedDoc = doc as MtnPowderDoc;
	if (!Array.isArray(feedDoc?.MountainAreas)) throw new Error('unexpected status format');
	const lifts: ResortStatus['lifts'] = [];
	for (const area of feedDoc.MountainAreas) {
		for (const lift of area.Lifts ?? []) {
			const name = lift.Name?.trim();
			if (!name || !lift.StatusEnglish) continue;
			const isLiftOperational = lift.StatusEnglish === MTN_POWDER_OPEN_STATUS;
			lifts.push({ name, kind: liftKind(lift.LiftType), open: isLiftOperational });
		}
	}
	return { at: feedDoc.LastUpdate ?? new Date().toISOString(), lifts, pistes: [] };
}
