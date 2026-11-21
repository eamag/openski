import type { LiftKind, ResortStatus } from './intermaps.ts';

export const lumiplayUrls = (uuid: string): string[] => [
	`https://public.lumiplay.link/interactive-map/v1/map/${uuid}/staticPoiData?lang=fr`,
	`https://public.lumiplay.link/interactive-map/v1/map/${uuid}/dynamicPoiData?lang=fr`
];

interface StaticItem {
	data?: { id?: number; name?: string; type?: string; liftType?: string };
}
interface DynamicItem {
	id?: number;
	openingStatus?: string | null;
}

const LUMIPLAY_OPEN_STATUS = 'OPEN';
const KNOWN_OPERATIONAL_STATUSES = new Set([
	LUMIPLAY_OPEN_STATUS,
	'CLOSED',
	'FORECAST',
	'OUT_OF_PERIOD',
	'OUT_OF_PERIOD_SEASON_ENDING'
]);

function liftKind(type: string | undefined): LiftKind {
	switch (type) {
		case 'GONDOLA':
		case 'CABRIOLET_GONDOLA':
		case 'FUNITEL':
		case 'TRAM':
		case 'FUNICULAR':
			return 'gondola';
		case 'CHAIRLIFT':
		case 'DETACHABLE_CHAIRLIFT':
		case 'DETACHABLE_BUBBLE_CHAIRLIFT':
			return 'chair';
		case 'SURFACE_LIFT':
		case 'ROPE_TOW':
		case 'MAGIC_CARPET':
			return 'drag';
		default:
			return 'other';
	}
}

export function parseLumiplay(staticDoc: unknown, dynamicDoc: unknown): ResortStatus {
	const items = (staticDoc as { items?: StaticItem[] })?.items;
	const states = (dynamicDoc as { items?: DynamicItem[] })?.items;
	if (!Array.isArray(items) || !Array.isArray(states)) throw new Error('unexpected status format');
	const status = new Map(states.map((s) => [s.id, s.openingStatus ?? '']));
	const lifts: ResortStatus['lifts'] = [];
	const pistes: ResortStatus['pistes'] = [];
	for (const { data } of items) {
		const name = data?.name?.trim().replace(/\.+$/, '');
		const state = status.get(data?.id);
		if (!name || !state || !KNOWN_OPERATIONAL_STATUSES.has(state)) continue;
		if (data?.type === 'LIFT')
			lifts.push({ name, kind: liftKind(data.liftType), open: state === LUMIPLAY_OPEN_STATUS });
		else if (data?.type === 'TRAIL')
			pistes.push({ ref: name, open: state === LUMIPLAY_OPEN_STATUS });
	}
	return { at: new Date().toISOString(), lifts, pistes };
}
