import { t } from '#lib/i18n/index.ts';
import type { Difficulty } from './types.ts';
import type { RoutePrefs } from './routing.ts';

/**
 * How a resort's signs show each OSM `piste:difficulty`, after
 * https://wiki.openstreetmap.org/wiki/Key:piste:difficulty. A North American blue square is
 * `intermediate` and a green circle is `easy`; in the Alps blue is `easy`. Where the convention is
 * unknown, labels use the OSM grade words and the map keeps the default palette.
 */
export type DifficultySystem = 'europe' | 'north_america' | 'japan' | 'other';

const NORTH_AMERICA_OCEANIA = new Set(['US', 'CA', 'AU', 'NZ']);
// prettier-ignore
const EUROPE = new Set(['AD', 'AL', 'AM', 'AT', 'AZ', 'BA', 'BE', 'BG', 'BY', 'CH', 'CY', 'CZ', 'DE', 'DK',
	'EE', 'ES', 'FI', 'FR', 'GB', 'GE', 'GR', 'HR', 'HU', 'IE', 'IS', 'IT', 'LI', 'LT', 'LU', 'LV', 'MC', 'MD',
	'ME', 'MK', 'MT', 'NL', 'NO', 'PL', 'PT', 'RO', 'RS', 'RU', 'SE', 'SI', 'SK', 'SM', 'TR', 'UA', 'XK']);
/** Countries whose beginner runs are marked green. */
const GREEN_NOVICE = new Set(['FR', 'ES', 'AD', 'NO', 'SE', 'FI']);

export function getDifficultySystem(country?: string): DifficultySystem {
	const c = country?.toUpperCase();
	if (!c) return 'other';
	if (NORTH_AMERICA_OCEANIA.has(c)) return 'north_america';
	if (c === 'JP') return 'japan';
	return EUROPE.has(c) ? 'europe' : 'other';
}

type Paint = 'green' | 'lightBlue' | 'blue' | 'red' | 'black' | 'orange' | 'grey';

const PAINT: Record<'light' | 'dark', Record<Paint, string>> = {
	light: {
		green: '#16a34a',
		lightBlue: '#3aa8f5',
		blue: '#1f7ae0',
		red: '#e23a3a',
		black: '#1b1e24',
		orange: '#e08a00',
		grey: '#9ca3af'
	},
	dark: {
		green: '#22c55e',
		lightBlue: '#5cb8f7',
		blue: '#3d92f2',
		red: '#e23a3a',
		black: '#e8ebf0',
		orange: '#e08a00',
		grey: '#9ca3af'
	}
};

const GRADES: Difficulty[] = [
	'novice',
	'easy',
	'intermediate',
	'advanced',
	'expert',
	'freeride',
	'unknown'
];

type SignName = keyof typeof t.difficulty.sign | Difficulty;
type Sign = [paint: Paint, name: SignName];

const DEFAULT_PALETTE: Record<Difficulty, Paint> = {
	novice: 'lightBlue',
	easy: 'blue',
	intermediate: 'red',
	advanced: 'black',
	expert: 'black',
	freeride: 'orange',
	unknown: 'grey'
};

function signs(country?: string): Record<Difficulty, Sign> {
	const system = getDifficultySystem(country);
	const unknown: Sign = ['grey', 'unknown'];
	if (system === 'north_america' || system === 'japan') {
		const mid: Sign = system === 'japan' ? ['red', 'red'] : ['blue', 'blue'];
		return {
			novice: ['green', 'novice'],
			easy: ['green', 'green'],
			intermediate: mid,
			advanced: ['black', 'black'],
			expert: ['black', system === 'japan' ? 'black' : 'doubleBlack'],
			freeride: ['orange', 'freeride'],
			unknown
		};
	}
	if (system === 'europe') {
		const greenNovice = GREEN_NOVICE.has(country!.toUpperCase());
		return {
			novice: greenNovice ? ['green', 'green'] : ['lightBlue', 'novice'],
			easy: ['blue', 'blue'],
			intermediate: ['red', 'red'],
			advanced: ['black', 'black'],
			expert: ['black', 'black'],
			freeride: ['orange', 'skiRoute'],
			unknown
		};
	}
	const out = {} as Record<Difficulty, Sign>;
	for (const d of GRADES) out[d] = [DEFAULT_PALETTE[d], d];
	return out;
}

function signLabel(name: SignName): string {
	return name in t.difficulty.grade
		? t.difficulty.grade[name as Difficulty]
		: t.difficulty.sign[name as keyof typeof t.difficulty.sign];
}

export function getPisteColors(country?: string, dark = false): Record<Difficulty, string> {
	const paint = PAINT[dark ? 'dark' : 'light'];
	const s = signs(country);
	const out = {} as Record<Difficulty, string>;
	for (const d of Object.keys(s) as Difficulty[]) out[d] = paint[s[d][0]];
	return out;
}

/** What skiers call it there: "Blue" in the Alps, "Green" in Colorado, "Easy" elsewhere. */
export function getDifficultyLabel(d: Difficulty, country?: string): string {
	return signLabel(signs(country)[d][1]);
}

/** The local name with the OSM grade, e.g. "Blue · Intermediate" in North America. */
export function getDifficultyLongLabel(d: Difficulty, country?: string): string {
	if (d === 'unknown') return t.difficulty.difficultyUnknown;
	const sign = signs(country)[d][1];
	return sign === d
		? signLabel(sign)
		: t.difficulty.signWithGrade(signLabel(sign), t.difficulty.grade[d]);
}

/** Label for an OSM `piste:difficulty` value in the editor; other values stay as written. */
export function getEditorDifficultyLabel(value: string, country?: string): string {
	return GRADES.includes(value as Difficulty)
		? getDifficultyLongLabel(value as Difficulty, country)
		: value.replace(/_/g, ' ');
}

const LEVELS = ['easy', 'intermediate', 'advanced'] as const;

export function getRouteFilterLevels(
	country?: string
): { value: RoutePrefs['maxDifficulty']; label: string; colorKey: Difficulty }[] {
	return LEVELS.map((d) => ({ value: d, label: getDifficultyLabel(d, country), colorKey: d }));
}

export function getNowFilterLevels(
	country?: string
): { id: 'all' | (typeof LEVELS)[number]; label: string; colorKey?: Difficulty }[] {
	return [
		{ id: 'all', label: t.difficulty.all },
		...LEVELS.map((d) => ({ id: d, label: getDifficultyLabel(d, country), colorKey: d }))
	];
}

export function getProgressBadges(country?: string) {
	const badge = (d: (typeof LEVELS)[number]) => {
		const sign = signs(country)[d][1] as keyof typeof t.difficulty.badgeTitle;
		return { name: t.difficulty.badgeTitle[sign], hint: t.difficulty.badgeHint[sign] };
	};
	return { low: badge('easy'), mid: badge('intermediate'), high: badge('advanced') };
}

export function getElevationBands(country?: string) {
	const name = (d: Difficulty) => getDifficultyLabel(d, country);
	return {
		up: { color: '#f59e0b', label: t.difficulty.slope.uphill },
		flat: { color: 'var(--ink-soft)', label: t.difficulty.slope.flat },
		easy: { color: 'var(--piste-easy)', label: t.difficulty.slope.easy(name('easy')) },
		intermediate: {
			color: 'var(--piste-intermediate)',
			label: t.difficulty.slope.intermediate(name('intermediate'))
		},
		advanced: {
			color: 'var(--piste-advanced)',
			label: t.difficulty.slope.advanced(name('advanced'))
		},
		expert: { color: 'var(--piste-freeride)', label: t.difficulty.slope.expert }
	};
}

/** Map legend: one row per colour the map uses for graded pistes. */
export function getLegendItems(
	country?: string,
	dark = false
): { key: Difficulty; label: string; color: string }[] {
	const colors = getPisteColors(country, dark);
	const seen = new Set<string>();
	const out: { key: Difficulty; label: string; color: string }[] = [];
	for (const d of ['novice', 'easy', 'intermediate', 'advanced', 'expert', 'freeride'] as const) {
		const label = getDifficultyLongLabel(d, country);
		if (seen.has(colors[d] + label)) continue;
		seen.add(colors[d] + label);
		out.push({ key: d, label, color: colors[d] });
	}
	return out;
}

export function getDifficultySectionTitle(country?: string): string {
	return getDifficultySystem(country) === 'other'
		? t.difficulty.pistesByDifficulty
		: t.difficulty.pistesByColour;
}

export function getCatalogPisteColours(country?: string, dark = false) {
	const colors = getPisteColors(country, dark);
	return (['novice', 'easy', 'intermediate', 'advanced', 'freeride', 'unknown'] as const).map(
		(key) => ({ key, label: getDifficultyLabel(key, country), color: colors[key] })
	);
}
