export const LOCALES = ['en', 'de', 'fr'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE = 'en' satisfies Locale;

/** Each language in its own words, for the language picker. */
export const LOCALE_NAMES: Record<Locale, string> = {
	en: 'English',
	de: 'Deutsch',
	fr: 'Français'
};

export const isLocale = (value: unknown): value is Locale => LOCALES.includes(value as Locale);

const baseLanguage = (tag: string) => tag.toLowerCase().split('-')[0];

export function matchLocale(preferredTags: readonly string[]): Locale {
	for (const tag of preferredTags) {
		const base = baseLanguage(tag);
		if (isLocale(base)) return base;
	}
	return DEFAULT_LOCALE;
}

export let locale: Locale = DEFAULT_LOCALE;
/** The device's own tag when it speaks the chosen language (de-CH, en-US), so numbers and dates look local. */
let formattingLocale: string = DEFAULT_LOCALE;

export function setActiveLocale(next: Locale, preferredTags: readonly string[] = []): void {
	locale = next;
	formattingLocale = preferredTags.find((tag) => baseLanguage(tag) === next) ?? next;
	numberFormats.clear();
	dateFormats.clear();
	pluralRules = null;
	listFormats.clear();
	relativeTimeFormat = null;
	regionNames = null;
}

const numberFormats = new Map<string, Intl.NumberFormat>();
function numberFormat(options: Intl.NumberFormatOptions): Intl.NumberFormat {
	const key = JSON.stringify(options);
	let format = numberFormats.get(key);
	if (!format) {
		format = new Intl.NumberFormat(formattingLocale, options);
		numberFormats.set(key, format);
	}
	return format;
}

/** `digits` fixes the decimals like toFixed: formatNumber(3, 1) → "3.0" ("3,0" in German). */
export function formatNumber(value: number, digits = 0): string {
	return numberFormat({ minimumFractionDigits: digits, maximumFractionDigits: digits }).format(
		value
	);
}

export type Unit =
	| 'meter'
	| 'kilometer'
	| 'centimeter'
	| 'kilometer-per-hour'
	| 'celsius'
	| 'degree'
	| 'percent'
	| 'hour'
	| 'minute'
	| 'second';

export function formatUnit(value: number, unit: Unit, digits = 0): string {
	return numberFormat({
		style: 'unit',
		unit,
		unitDisplay: 'short',
		minimumFractionDigits: digits,
		maximumFractionDigits: digits
	}).format(value);
}

/** The unit's short symbol on its own ("km/h"), for layouts that set the number and unit apart. */
export function unitSymbol(unit: Unit): string {
	const parts = numberFormat({ style: 'unit', unit, unitDisplay: 'short' }).formatToParts(2);
	return parts
		.filter((part) => part.type === 'unit')
		.map((part) => part.value)
		.join('');
}

/** Heights and drops: "2,340 m". */
export const formatMeters = (meters: number) => formatUnit(Math.round(meters), 'meter');

export const formatKm = (meters: number, digits = 1) =>
	formatUnit(meters / 1000, 'kilometer', digits);

/** Under 1 km to the nearest 10 m, under 10 km with one decimal, then whole kilometres. */
export function formatDistance(meters: number): string {
	if (meters < 1000) return formatUnit(Math.round(meters / 10) * 10, 'meter');
	return formatKm(meters, meters >= 10_000 ? 0 : 1);
}

export const formatSpeed = (metersPerSecond: number) =>
	formatUnit(Math.round(metersPerSecond * 3.6), 'kilometer-per-hour');

export const formatTemperature = (celsius: number) => formatUnit(Math.round(celsius), 'celsius');

/** A share from 0 to 1: formatPercent(0.42) → "42%". */
export function formatPercent(fraction: number, digits = 0): string {
	return numberFormat({
		style: 'percent',
		minimumFractionDigits: digits,
		maximumFractionDigits: digits
	}).format(fraction);
}

export const formatMinutes = (minutes: number) => formatUnit(Math.round(minutes), 'minute');

/** Rounded to whole minutes, at least one: "6 min", "1 hr 5 min". */
export function formatDuration(seconds: number): string {
	const totalMinutes = Math.round(seconds / 60);
	if (totalMinutes < 60) return formatUnit(Math.max(1, totalMinutes), 'minute');
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	return minutes
		? `${formatUnit(hours, 'hour')} ${formatUnit(minutes, 'minute')}`
		: formatUnit(hours, 'hour');
}

const dateFormats = new Map<string, Intl.DateTimeFormat>();
function dateFormat(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
	const key = JSON.stringify(options);
	let format = dateFormats.get(key);
	if (!format) {
		format = new Intl.DateTimeFormat(formattingLocale, options);
		dateFormats.set(key, format);
	}
	return format;
}

type DateInput = Date | number | string;
const toDate = (value: DateInput) => (value instanceof Date ? value : new Date(value));

export function formatDate(
	value: DateInput,
	options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }
): string {
	return dateFormat(options).format(toDate(value));
}

/** Time of day; pass the resort's time zone when it can differ from the phone's. */
export function formatTime(value: DateInput, timeZone?: string): string {
	return dateFormat({ hour: 'numeric', minute: '2-digit', timeZone }).format(toDate(value));
}

/** An hour on its own, for hour strips: "10", "10 AM". */
export function formatHour(value: DateInput, timeZone?: string): string {
	return dateFormat({ hour: 'numeric', timeZone }).format(toDate(value));
}

export function formatWeekday(
	value: DateInput,
	width: 'long' | 'short' = 'long',
	timeZone?: string
): string {
	return dateFormat({ weekday: width, timeZone }).format(toDate(value));
}

let relativeTimeFormat: Intl.RelativeTimeFormat | null = null;

/** "5 minutes ago", "in 2 hours", "yesterday". */
export function formatRelativeTime(value: DateInput, now: number = Date.now()): string {
	relativeTimeFormat ??= new Intl.RelativeTimeFormat(formattingLocale, { numeric: 'auto' });
	const seconds = Math.round((toDate(value).getTime() - now) / 1000);
	const abs = Math.abs(seconds);
	if (abs < 60) return relativeTimeFormat.format(seconds, 'second');
	if (abs < 3600) return relativeTimeFormat.format(Math.round(seconds / 60), 'minute');
	if (abs < 86_400) return relativeTimeFormat.format(Math.round(seconds / 3600), 'hour');
	return relativeTimeFormat.format(Math.round(seconds / 86_400), 'day');
}

const listFormats = new Map<string, Intl.ListFormat>();

/** "Red, Blue and Black" in the chosen language. */
export function formatList(items: string[], type: 'conjunction' | 'disjunction' = 'conjunction') {
	let format = listFormats.get(type);
	if (!format) {
		format = new Intl.ListFormat(formattingLocale, { style: 'long', type });
		listFormats.set(type, format);
	}
	return format.format(items);
}

let regionNames: Intl.DisplayNames | null = null;

export function countryName(code: string): string {
	regionNames ??= new Intl.DisplayNames([formattingLocale], { type: 'region' });
	try {
		return regionNames.of(code.toUpperCase()) ?? code;
	} catch {
		return code;
	}
}

let pluralRules: Intl.PluralRules | null = null;

export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

/**
 * Picks the plural form the language uses for `count` and puts the formatted number where `#` is:
 * plural(3, { one: '# lift', other: '# lifts' }) → "3 lifts".
 */
export function plural(count: number, forms: PluralForms): string {
	pluralRules ??= new Intl.PluralRules(locale);
	const form = (count === 0 && forms.zero) || forms[pluralRules.select(count)] || forms.other;
	return form.replaceAll('#', formatNumber(count));
}
