import type { LiftKind, ResortStatus } from './intermaps.ts';

interface ItinemapItem {
	id?: number;
	name?: string;
	opened?: boolean;
	openedScheduled?: boolean;
	characteristics?: number[];
	level?: number;
	groomed?: boolean;
	openingHour?: string | null;
	closingHour?: string | null;
}

const CHAIR_CHARACTERISTIC_IDS = new Set([59, 60]);
const GONDOLA_CHARACTERISTIC_IDS = new Set([61, 62, 64, 69]);
const DRAG_CHARACTERISTIC_IDS = new Set([63, 65, 66]);

function liftKind(characteristics?: number[], name?: string): LiftKind {
	if (Array.isArray(characteristics)) {
		if (characteristics.some((id) => CHAIR_CHARACTERISTIC_IDS.has(id))) return 'chair';
		if (characteristics.some((id) => GONDOLA_CHARACTERISTIC_IDS.has(id))) return 'gondola';
		if (characteristics.some((id) => DRAG_CHARACTERISTIC_IDS.has(id))) return 'drag';
	}

	const s = (name ?? '').toLowerCase();
	if (
		s.startsWith('tsd') ||
		s.startsWith('ts ') ||
		s.includes('télésiège') ||
		s.includes('chair')
	) {
		return 'chair';
	}
	if (
		s.startsWith('tc') ||
		s.startsWith('tph') ||
		s.includes('télécabine') ||
		s.includes('téléphérique') ||
		s.includes('funitel') ||
		s.includes('gondola') ||
		s.includes('cable car')
	) {
		return 'gondola';
	}
	if (
		s.startsWith('tk') ||
		s.includes('téléski') ||
		s.includes('tapis') ||
		s.includes('corde') ||
		s.includes('drag') ||
		s.includes('tow')
	) {
		return 'drag';
	}
	return 'other';
}

export function parseItinemap(doc: unknown): ResortStatus {
	let data = doc;
	if (typeof doc === 'string') {
		try {
			data = JSON.parse(doc);
		} catch {
			throw new Error('unexpected status format: invalid JSON');
		}
	}

	const lifts: ResortStatus['lifts'] = [];
	const pistes: ResortStatus['pistes'] = [];

	let liftItems: ItinemapItem[] = [];
	let trackItems: ItinemapItem[] = [];

	if (Array.isArray(data)) {
		for (const item of data as ItinemapItem[]) {
			if (item.level !== undefined || item.groomed !== undefined) {
				trackItems.push(item);
			} else {
				liftItems.push(item);
			}
		}
	} else if (typeof data === 'object' && data !== null) {
		const obj = data as {
			lifts?: ItinemapItem[];
			tracks?: ItinemapItem[];
			pistes?: ItinemapItem[];
		};
		if (Array.isArray(obj.lifts)) liftItems = obj.lifts;
		if (Array.isArray(obj.tracks)) trackItems = obj.tracks;
		if (Array.isArray(obj.pistes)) trackItems = obj.pistes;
	} else {
		throw new Error('unexpected status format');
	}

	for (const liftItem of liftItems) {
		if (!liftItem.name) continue;
		lifts.push({
			name: liftItem.name.trim(),
			kind: liftKind(liftItem.characteristics, liftItem.name),
			open: Boolean(liftItem.opened)
		});
	}

	for (const trackItem of trackItems) {
		if (!trackItem.name) continue;
		const name = trackItem.name.trim();
		const numMatch = name.match(/\b(\d+[a-z]?)\b/i);
		const ref = numMatch ? numMatch[1].toLowerCase() : name.toLowerCase();
		pistes.push({
			ref,
			open: Boolean(trackItem.opened)
		});
		if (ref !== name.toLowerCase()) {
			pistes.push({
				ref: name.toLowerCase(),
				open: Boolean(trackItem.opened)
			});
		}
	}

	return {
		at: new Date().toISOString(),
		lifts,
		pistes
	};
}
