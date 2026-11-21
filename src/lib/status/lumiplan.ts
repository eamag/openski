import type { LiftKind, ResortStatus } from './intermaps.ts';

export const lumiplanUrl = (station: string) =>
	`https://bulletinv3.lumiplan.pro/bulletin.php?station=${station}&lang=fr&isSoir=false`;

const LIFT_TYPES = new Set([
	'TRAM',
	'GONDOLA',
	'CABRIOLET_GONDOLA',
	'FUNICULAR',
	'CHAIRLIFT',
	'DETACHABLE_CHAIRLIFT',
	'DETACHABLE_BUBBLE_CHAIRLIFT',
	'SURFACE_LIFT',
	'ROPE_TOW',
	'MAGIC_CARPET',
	'LIFTS'
]);

function liftKind(type: string): LiftKind {
	if (/TRAM|GONDOLA|FUNICULAR/.test(type)) return 'gondola';
	if (/CHAIRLIFT/.test(type)) return 'chair';
	return 'drag';
}

function updatedAt(html: string): string {
	const m = html.match(/Mis à jour le (\d{2})\/(\d{2})\/(\d{4}) à (\d{2}):(\d{2})/);
	if (!m) return new Date().toISOString();
	const [, day, month, year, hour, minute] = m;
	const lastSunday = (y: number, mo: number) => {
		const days = new Date(Date.UTC(y, mo, 0)).getUTCDate();
		return days - new Date(Date.UTC(y, mo - 1, days)).getUTCDay();
	};
	const mNum = Number(month);
	const dNum = Number(day);
	const summer =
		(mNum > 3 && mNum < 10) ||
		(mNum === 3 && dNum >= lastSunday(Number(year), 3)) ||
		(mNum === 10 && dNum < lastSunday(Number(year), 10));
	const date = new Date(
		`${year}-${month}-${day}T${hour}:${minute}:00${summer ? '+02:00' : '+01:00'}`
	);
	return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function decode(s: string): string {
	return s
		.replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
		.replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.trim();
}

const LUMIPLAN_OPEN_STATE_IDENTIFIER = 'lp_runway_trail_opened';

export function parseLumiplan(html: string): ResortStatus {
	const lifts: ResortStatus['lifts'] = [];
	const seen = new Set<string>();
	for (const block of html.split('<div class="POI_info">').slice(1)) {
		const type = block.match(/image\/type\/([A-Z0-9_]+)\.svg/)?.[1];
		if (!type || !LIFT_TYPES.has(type)) continue;
		const name = decode(block.match(/<span class="nom">([\s\S]*?)<\/span>/)?.[1] ?? '');
		const state = block.match(/image\/etats\/(lp_runway_trail_[a-z_]+)\.svg/)?.[1];
		if (!name || !state || seen.has(name)) continue;
		seen.add(name);
		lifts.push({ name, kind: liftKind(type), open: state === LUMIPLAN_OPEN_STATE_IDENTIFIER });
	}
	if (!lifts.length) throw new Error('unexpected status format');
	return { at: updatedAt(html), lifts, pistes: [] };
}
