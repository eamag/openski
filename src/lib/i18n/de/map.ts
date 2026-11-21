import type { Messages } from '../en/index.ts';
import { formatNumber, plural } from '../intl.ts';

export const map: Messages['map'] = {
	unavailable: 'Skigebiet nicht verfügbar',
	chooseResort: 'Skigebiet auswählen',
	chooseDifferentResort: 'Anderes Skigebiet auswählen',
	searchPlaceholder: (resort: string) => `Pisten, Lifte und Hütten in ${resort} suchen`,
	options: 'Kartenoptionen',
	aboutResort: (name: string) => `Über ${name}`,
	aboutDescription: 'Pisten nach Farbe, Lifte, Hangausrichtung und Pistenpläne',
	offlineMap: 'Offline-Karte',
	allSettings: 'Alle Einstellungen',
	settingsDescription: 'Erscheinungsbild, Benutzerkonto, Offline-Daten und mehr',
	settings: 'Einstellungen',
	helpAria: 'Beantworte Fragen, um diese Karte zu verbessern',
	terrain3d: '3D-Gelände',
	locationUnavailable: 'Standort nicht verfügbar',
	showLocation: 'Meinen Standort anzeigen',
	start: 'Start',
	destination: 'Ziel',
	tapMapToSet: (target: string) => `Tippe auf die Karte, um ${target} festzulegen`,
	sheet: {
		expand: 'Bedienfeld vergrößern',
		collapse: 'Mehr von der Karte anzeigen'
	},
	dimClosed: 'Geschlossenes abblenden',
	dimDone: 'Gefahrenes abblenden',
	slopes: 'Steilhänge schattieren',
	slopesHint: 'Hangneigung wie auf Lawinenkarten, ab Zoomstufe 11: wo das Gelände steil wird',
	closedDefaultHint: 'Lifte und Pisten, die das Skigebiet heute als geschlossen meldet',
	reportMissing: 'Der Öffnungsstatus des Skigebiets ist gerade nicht verfügbar',
	reportNoSource: 'Für dieses Skigebiet gibt es noch keinen Live-Öffnungsstatus',
	statusCounts: (openLifts: number, totalLifts: number, openPistes: number, totalPistes: number) =>
		`${formatNumber(openLifts)} von ${plural(totalLifts, { one: '# Lift', other: '# Liften' })} und ${formatNumber(openPistes)} von ${plural(totalPistes, { one: '# Piste', other: '# Pisten' })} geöffnet`,
	staleReport: (counts: string, at: string) =>
		`${counts}, letzter bekannter Stand von ${at} (keine Verbindung)`,
	reportedAt: (counts: string, at: string) => `${counts}, gemeldet um ${at}`,
	doneCounts: (pistesDone: number, pistesTotal: number, liftsDone: number, liftsTotal: number) =>
		`${formatNumber(pistesDone)} von ${plural(pistesTotal, { one: '# Piste', other: '# Pisten' })} und ${formatNumber(liftsDone)} von ${plural(liftsTotal, { one: '# Lift', other: '# Liften' })} gefahren; der Rest bleibt hervorgehoben`,
	doneDefaultHint: 'Pisten und Lifte, die du schon gefahren bist; der Rest bleibt hervorgehoben',
	slopeClass: {
		30: '30–35°',
		35: '35–40°',
		40: '40–45°',
		45: 'über 45°'
	},
	errorNotFound: 'Für dieses Skigebiet gibt es noch keine Karte.',
	errorStatus: (status: number) =>
		`Die Karte konnte nicht geladen werden (Fehler ${status}). Versuche es noch einmal.`,
	errorNetwork:
		'Die Karte konnte nicht geladen werden. Überprüfe deine Internetverbindung und versuche es erneut.',
	myLocation: 'Mein Standort',
	droppedPin: 'Gesetzte Stecknadel',
	onPiste: (name: string) => `Auf ${name}`,
	nearLift: (name: string) => `In der Nähe von ${name}`,
	station: {
		bottom: 'Talstation',
		middle: 'Mittelstation',
		top: 'Bergstation',
		label: (name: string, which: string) => `${name} · ${which}`
	},
	pisteDetail: (km: string, top: string, bottom: string) => `${km} · ${top}–${bottom}`,
	pisteRef: (ref: string) => `Piste ${ref}`,
	pisteLink: 'Link'
};
