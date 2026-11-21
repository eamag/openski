export interface ResortStatus {
	at: string;
	lifts: { name: string; kind: LiftKind; open: boolean }[];
	pistes: { ref: string; open: boolean }[];
	source?: { name: string; url: string };
}

export type LiftKind = 'gondola' | 'chair' | 'drag' | 'other';

interface Entry {
	number?: string | null;
	status?: string;
	subtitle?: string | null;
	popup?: { title?: string | null };
}

function liftKind(subtitle: string): LiftKind {
	const s = subtitle.toLowerCase();
	if (s.includes('gondola') || s.includes('cable car')) return 'gondola';
	if (s.includes('chair')) return 'chair';
	if (s.includes('ski lift') || s.includes('carpet') || s.includes('tow')) return 'drag';
	return 'other';
}

function pisteRef(e: Entry): string | null {
	const title = e.popup?.title?.match(/(?:Piste|Skiroute)\s+Nr\.?\s*(\d+[a-z]?)\b/i)?.[1] ?? '';
	const number = (e.number ?? '').trim().match(/^\d+[a-z]?$/i)?.[0] ?? '';
	const ref = title.length >= number.length ? title : number;
	return ref ? ref.toLowerCase() : null;
}

interface IntermapsFeedDoc {
	lifts?: Entry[];
	slopes?: Entry[];
	lastUpdate?: string;
}

export function parseIntermaps(doc: unknown): ResortStatus {
	const intermapsDoc = doc as IntermapsFeedDoc;
	if (!Array.isArray(intermapsDoc?.lifts) || !Array.isArray(intermapsDoc?.slopes))
		throw new Error('unexpected status format');
	const hasKnownStatus = (e: Entry) => e.status === 'open' || e.status === 'closed';
	return {
		at: intermapsDoc.lastUpdate ?? new Date().toISOString(),
		lifts: intermapsDoc.lifts
			.filter((l) => hasKnownStatus(l) && l.popup?.title)
			.map((l) => ({
				name: l.popup!.title as string,
				kind: liftKind(l.subtitle ?? ''),
				open: l.status === 'open'
			})),
		pistes: intermapsDoc.slopes.flatMap((s) => {
			const ref = pisteRef(s);
			return ref && hasKnownStatus(s) ? [{ ref, open: s.status === 'open' }] : [];
		})
	};
}
