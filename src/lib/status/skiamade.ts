import type { LiftKind, ResortStatus } from './intermaps.ts';

export const skiamadeUrl = (path: string) => `https://www.skiamade.com/en/ski-areas/${path}`;

const PAGES = {
	flachau: '12-peaks-ski-region/flachau/facilities',
	wagrain: '12-peaks-ski-region/wagrain/facilities',
	stJohann: '12-peaks-ski-region/stjohann/facilities',
	zauchensee: '12-peaks-ski-region/zauchensee-flachauwinkl/facilities',
	flachauwinkl: '12-peaks-ski-region/flachauwinkl-kleinarl/facilities',
	radstadt: '12-peaks-ski-region/radstadt-altenmarkt/facilities',
	eben: '12-peaks-ski-region/eben/facilities',
	filzmoos: '12-peaks-ski-region/filzmoos/facilities',
	planai: 'schladming-dachstein/planai/facilities',
	hochwurzen: 'schladming-dachstein/hochwurzen/facilities',
	hauserKaibling: 'schladming-dachstein/hauser-kaibling/facilities',
	reiteralm: 'schladming-dachstein/reiteralm/facilities',
	fageralm: 'schladming-dachstein/fageralm/facilities',
	galsterberg: 'schladming-dachstein/galsterberg/facilities',
	ramsau: 'schladming-dachstein/ramsau/facilities',
	dachsteinGletscher: 'schladming-dachstein/dachstein-gletscher/facilities',
	schlossalm: 'gastein/schlossalm/facilities-schlossalm',
	stubnerkogel: 'gastein/schlossalm/facilities-stubnerkogel',
	angertal: 'gastein/schlossalm/facilities-angertal',
	sportgastein: 'gastein/sportgastein/facilities',
	dorfgastein: 'gastein/dorfgastein/facilities',
	mariaAlm: 'hochkoenig/maria-alm/facilities',
	dienten: 'hochkoenig/dienten/facilities',
	muehlbach: 'hochkoenig/muehlbach/facilities',
	grossarl: 'grossarltal/grossarl/facilities'
} as const;

type Page = keyof typeof PAGES;

export const SKIAMADE_PAGES: string[] = Object.values(PAGES).map(skiamadeUrl);
export const skiamadeUrls = (...pages: Page[]): string[] => pages.map((p) => skiamadeUrl(PAGES[p]));

function decode(s: string): string {
	return s
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
		.replace(/&([a-zA-Z])(?:acute|grave|circ|uml|tilde|cedil|ring);/g, '$1')
		.trim();
}

function liftKind(row: string): LiftKind {
	const icon = row.match(/icon-([a-z0-9-]+)/)?.[1] ?? '';
	if (/cablecar|gondola|funitel/.test(icon)) return 'gondola';
	if (/chair/.test(icon)) return 'chair';
	if (/t-bar|ski-lift|teller|drag|tow|magic/.test(icon)) return 'drag';
	return 'other';
}

const SKIAMADE_OPEN_STATE = 'open';

export function parseSkiamade(html: string): ResortStatus {
	const rows = html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/g) ?? [];
	const lifts: ResortStatus['lifts'] = [];
	const seen = new Set<string>();
	for (const row of rows) {
		const name = decode(row.match(/live-infos-table__name"[^>]*>\s*([^<]+?)\s*</)?.[1] ?? '');
		const state = row.match(/#state-(open|closed)\b/)?.[1];
		if (!name || !state || seen.has(name)) continue;
		seen.add(name);
		const isOpen = state === SKIAMADE_OPEN_STATE;
		lifts.push({ name, kind: liftKind(row), open: isOpen });
	}
	if (!lifts.length) throw new Error('unexpected status format');
	return { at: new Date().toISOString(), lifts, pistes: [] };
}

export function parseSkiamadePages(htmls: string[]): ResortStatus {
	const byName = new Map<string, ResortStatus['lifts'][number]>();
	for (const html of htmls) {
		for (const lift of parseSkiamade(html).lifts) {
			if (!byName.has(lift.name)) byName.set(lift.name, lift);
		}
	}
	if (!byName.size) throw new Error('unexpected status format');
	return { at: new Date().toISOString(), lifts: [...byName.values()], pistes: [] };
}
