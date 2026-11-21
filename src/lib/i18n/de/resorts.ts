import type { Messages } from '../en/index.ts';
import { formatUnit, plural } from '../intl.ts';

export const resorts: Messages['resorts'] = {
	tagline: 'Schneeverhältnisse & Liftschlangen',
	backToMap: 'Zurück zur Karte',
	searchPlaceholder: '4.000 Skigebiete nach Namen suchen…',
	searchAria: 'Skigebiete suchen',
	clearSearchAria: 'Suche löschen',
	loading: 'Skigebiete werden geladen…',
	loadError:
		'Die Liste der Skigebiete konnte nicht geladen werden. Verbindung prüfen und erneut versuchen.',
	searchResultsHeading: (count: string) => `Suchergebnisse (${count})`,
	noMatches: (query: string) => `Keine Skigebiete passend zu „${query}“ gefunden`,
	noMapYet: 'Noch keine Karte',
	lastOpened: 'Zuletzt geöffnet',
	openMap: 'Karte öffnen',
	allResortsHeading: (count: string) => `Alle Skigebietskarten (${count})`,
	liftCount: (count: number) => plural(count, { one: '# Lift', other: '# Lifte' }),
	pistesKm: (km: number) => `${formatUnit(Math.round(km), 'kilometer')} Pisten`,
	pisteKmByColourAria: (breakdown: string) => `Pistenkilometer nach Farbe: ${breakdown}`
};
