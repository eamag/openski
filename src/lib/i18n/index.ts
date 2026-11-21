import { readStored, writeStored } from '#lib/browser-storage.ts';
import { en, type Messages } from './en/index.ts';
import {
	DEFAULT_LOCALE,
	isLocale,
	locale,
	matchLocale,
	setActiveLocale,
	type Locale
} from './intl.ts';

export * from './intl.ts';
export type { Messages };

const CHOSEN_LOCALE_KEY = 'locale';

const TRANSLATIONS: Record<Exclude<Locale, typeof DEFAULT_LOCALE>, () => Promise<Messages>> = {
	de: () => import('./de/index.ts').then((module) => module.de),
	fr: () => import('./fr/index.ts').then((module) => module.fr)
};

/**
 * Every UI string, in the language picked before the app first renders. Read it where the text is
 * shown (templates, `$derived`, functions), never into module-level constants: a language change
 * reloads the page, so nothing else needs to react to it.
 */
export let t: Messages = en;

/** The language set in Settings, or null to follow the device. */
export function chosenLocale(): Locale | null {
	const stored = readStored(CHOSEN_LOCALE_KEY);
	return isLocale(stored) ? stored : null;
}

export async function initLocale(): Promise<void> {
	const deviceTags = navigator.languages?.length ? navigator.languages : [navigator.language];
	const wanted = chosenLocale() ?? matchLocale(deviceTags);
	let active: Locale = DEFAULT_LOCALE;
	if (wanted !== DEFAULT_LOCALE) {
		try {
			t = await TRANSLATIONS[wanted]();
			active = wanted;
		} catch {
			// Offline before the translation was cached: stay in English.
		}
	}
	setActiveLocale(active, deviceTags);
	document.documentElement.lang = locale;
}

export function chooseLocale(next: Locale | null): void {
	writeStored(CHOSEN_LOCALE_KEY, next);
	location.reload();
}
