import type { LiftKind, ResortStatus } from './intermaps.ts';

export const monterosaUrl = (area: string) =>
	`https://monterosaski.eu/en/bollettino-neve-e-piste/${area}`;

function text(cell: string): string {
	return cell
		.replace(/<[^>]+>/g, ' ')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/\s+/g, ' ')
		.trim();
}

function liftKind(type: string): LiftKind {
	if (/cablecar|gondola/.test(type)) return 'gondola';
	if (/chairlift/.test(type)) return 'chair';
	return 'drag';
}

function updatedAt(html: string): string {
	const m = html.match(/last update[\s\S]{0,80}?(\d{2})\/(\d{2})\/(\d{4})\s*-\s*(\d{2}):(\d{2})/);
	if (!m) return new Date().toISOString();
	const [, month, day, year, hour, minute] = m;
	const dayNum = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))).getUTCDay();
	const lastSunday = (y: number, mo: number) => {
		const days = new Date(Date.UTC(y, mo, 0)).getUTCDate();
		return days - new Date(Date.UTC(y, mo - 1, days)).getUTCDay();
	};
	const moNum = Number(month);
	const summer =
		(moNum > 3 && moNum < 10) ||
		(moNum === 3 && Number(day) >= lastSunday(Number(year), 3)) ||
		(moNum === 10 && Number(day) < lastSunday(Number(year), 10));
	const date = new Date(
		`${year}-${month}-${day}T${hour}:${minute}:00${summer ? '+02:00' : '+01:00'}`
	);
	return dayNum >= 0 && !Number.isNaN(date.getTime())
		? date.toISOString()
		: new Date().toISOString();
}

const ITALIAN_OPEN_SPRITE_IDENTIFIER = 'aperto';

export function parseMonterosa(html: string): ResortStatus {
	const lifts: ResortStatus['lifts'] = [];
	const seen = new Set<string>();
	for (const row of html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/g) ?? []) {
		if (!row.includes('data-col-1="Impianto"')) continue;
		const name = text(row.match(/data-col-1="Impianto"[^>]*>([\s\S]*?)<\/td>/)?.[1] ?? '').replace(
			/^\d+\s*-\s*/,
			''
		);
		const stateCell = row.match(/data-col-2="Stato"[^>]*>([\s\S]*?)<\/td>/)?.[1] ?? '';
		const word = text(stateCell);
		const sprite = stateCell.match(/impianto-([a-z]+)-svg/)?.[1];
		const type = row.match(/data-col-3="Tipo"[^>]*>[\s\S]*?\/([a-z]+)\.svg/)?.[1] ?? '';
		if (!name || seen.has(name)) continue;
		const open = /^open$/i.test(word) || sprite === ITALIAN_OPEN_SPRITE_IDENTIFIER;
		if (!/^open$/i.test(word) && !/^closed$/i.test(word) && !sprite) continue;
		seen.add(name);
		lifts.push({ name, kind: liftKind(type), open });
	}
	if (!lifts.length) throw new Error('unexpected status format');
	return { at: updatedAt(html), lifts, pistes: [] };
}

export function parseMonterosaPages(htmls: string[]): ResortStatus {
	const byName = new Map<string, ResortStatus['lifts'][number]>();
	let at = '';
	for (const html of htmls) {
		const page = parseMonterosa(html);
		const isMoreRecentUpdate = page.at > at;
		if (isMoreRecentUpdate) at = page.at;
		for (const lift of page.lifts) {
			if (!byName.has(lift.name)) byName.set(lift.name, lift);
		}
	}
	if (!byName.size) throw new Error('unexpected status format');
	return { at: at || new Date().toISOString(), lifts: [...byName.values()], pistes: [] };
}
