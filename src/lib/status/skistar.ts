import type { ResortStatus } from './intermaps.ts';

export const skistarUrl = (path: string) => `https://www.skistar.com/en/ski-destinations/${path}`;

const PAGES = {
	areBy: 'are/winter-in-are/weather-and-slopes/are-by/SimpleView/',
	areHogzon: 'are/winter-in-are/weather-and-slopes/are-hogzon/SimpleView/',
	areBjornen: 'are/winter-in-are/weather-and-slopes/are-bjornen/SimpleView/',
	duved: 'are/winter-in-are/weather-and-slopes/duved/SimpleView/',
	lindvallen: 'salen/winter-in-salen/weather-slopes/lindvallen/SimpleView/',
	tandadalen: 'salen/winter-in-salen/weather-slopes/tandadalen/SimpleView/',
	hundfjallet: 'salen/winter-in-salen/weather-slopes/hundfjallet/SimpleView/',
	hogfjallet: 'salen/winter-in-salen/weather-slopes/hogfjallet/SimpleView/',
	turistsentret: 'trysil/winter-in-trysil/weather-and-slopes/turistsentret/SimpleView/',
	hogegga: 'trysil/winter-in-trysil/weather-and-slopes/hogegga/SimpleView/',
	hemsedal: 'hemsedal/winter-in-hemsedal/weather-and-slopes/SimpleView/',
	vemdalsskalet: 'vemdalen/winter-in-vemdalen/weather-and-slopes/vemdalsskalet/SimpleView/',
	bjornrike: 'vemdalen/winter-in-vemdalen/weather-and-slopes/bjornrike/SimpleView/',
	klovsjo: 'vemdalen/winter-in-vemdalen/weather-and-slopes/klovsjo/SimpleView/'
} as const;

type Page = keyof typeof PAGES;

export const skistarUrls = (...pages: Page[]): string[] => pages.map((p) => skistarUrl(PAGES[p]));

function decode(s: string): string {
	return s
		.replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
		.replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.trim();
}

const SKISTAR_OPEN_STATE = 'open';

export function parseSkistar(html: string): ResortStatus {
	const rows = html.match(/<li class="c-lpv-list__item[^"]*">[\s\S]*?<\/li>/g) ?? [];
	const lifts: ResortStatus['lifts'] = [];
	const seen = new Set<string>();
	for (const row of rows) {
		if (!row.includes('c-lpv-list__lift-icon')) continue;
		const name = decode(row.match(/c-lpv-list__item-name"[^>]*>\s*([^<]+?)\s*</)?.[1] ?? '');
		const state = row.match(/c-lpv-list__item-status--is-(open|closed)\b/)?.[1];
		if (!name || !state || seen.has(name)) continue;
		seen.add(name);
		const isOpen = state === SKISTAR_OPEN_STATE;
		lifts.push({ name, kind: 'other', open: isOpen });
	}
	if (!lifts.length) throw new Error('unexpected status format');
	return { at: new Date().toISOString(), lifts, pistes: [] };
}

export function parseSkistarPages(htmls: string[]): ResortStatus {
	const byName = new Map<string, ResortStatus['lifts'][number]>();
	for (const html of htmls) {
		for (const lift of parseSkistar(html).lifts) {
			if (!byName.has(lift.name)) byName.set(lift.name, lift);
		}
	}
	if (!byName.size) throw new Error('unexpected status format');
	return { at: new Date().toISOString(), lifts: [...byName.values()], pistes: [] };
}
