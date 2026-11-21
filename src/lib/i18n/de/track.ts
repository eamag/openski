import type { Messages } from '../en/index.ts';
import { plural } from '../intl.ts';

export const track: Messages['track'] = {
	activity: {
		lift: 'Im Lift',
		ride: 'Auf Abfahrt',
		recording: 'Aufzeichnung läuft'
	},
	stats: {
		max: 'Max.',
		distance: 'Distanz',
		vertical: 'Höhenmeter',
		runs: 'Abfahrten'
	},
	liftsCount: (count: number) => plural(count, { one: '# Lift', other: '# Lifte' }),
	locationBlocked:
		'Standortzugriff ist für diese Website blockiert. Erlaube ihn in den Browser-Einstellungen, um aufzuzeichnen.',
	wakeLockFailed:
		'Bildschirm konnte nicht aktiv gehalten werden. Die Aufzeichnung pausiert, sobald sich der Bildschirm ausschaltet.',
	stopAndSave: 'Stoppen & speichern',
	unfinishedRecording: (date: string) => `Unvollendete Aufzeichnung vom ${date}`,
	pointsKept: (count: number) =>
		plural(count, { one: '# Punkt wurde behalten.', other: '# Punkte wurden behalten.' }),
	resume: 'Fortsetzen',
	discard: 'Verwerfen',
	pocket: {
		whyTitle: 'Aufzeichnung in der Hosentasche erfordert die Smartphone-App',
		whyBody:
			'Eine Web-App, selbst wenn sie zum Startbildschirm hinzugefügt wurde, erhält kein GPS-Signal mehr, sobald der Bildschirm ausgeht. Hier kannst du mit eingeschaltetem Bildschirm aufzeichnen; für die Hosentasche brauchst du die openski.org-App.',
		getPhoneApp: 'Smartphone-App holen',
		recordScreenOn: 'Mit eingeschaltetem Bildschirm aufzeichnen',
		storesTitle: 'Die Smartphone-App ist noch nicht in den App Stores',
		storesBody:
			'openski.org ist kostenlos und wird von einer einzelnen Person entwickelt, die noch kein Entwicklerkonto bei App Store oder Google Play hat. Sponsoring hilft, diese zu finanzieren. Oder schreib mir, dann gebe ich Bescheid, sobald die App da ist.',
		sponsorGithub: 'Auf GitHub sponsern',
		writeMe: 'Schreib mir'
	},
	startRecording: 'Aufzeichnung starten',
	import: 'Importieren',
	screenNotice:
		'Aufzeichnung erfordert eingeschalteten Bildschirm: Eine Web-App erhält bei gesperrtem Telefon kein GPS. Für die Hosentasche zeichne mit deiner Sportuhr oder Strava auf und importiere die GPX-Datei hier.',
	notice: {
		saved: 'Skitag gespeichert.',
		tooShort: 'Zu kurz zum Speichern.',
		imported: (added: number, gained: number) => {
			const tracks = plural(added, { one: '# Aufzeichnung', other: '# Aufzeichnungen' });
			const segments = plural(gained, {
				one: '# neuer Pistenabschnitt',
				other: '# neue Pistenabschnitte'
			});
			return `${tracks} importiert: ${segments} abgedeckt.`;
		},
		notInResort: (resortName: string) => `Diese Aufzeichnung liegt nicht in ${resortName}.`,
		couldNotRead: 'Datei konnte nicht gelesen werden. GPX und TCX werden unterstützt.',
		noTrackFound: 'Keine Aufzeichnung in dieser Datei gefunden.',
		pointsNoLongerStored: 'Die Wegpunkte dieser Aufzeichnung sind nicht mehr gespeichert.'
	},
	sessions: 'Aufzeichnungen',
	emptySessions: 'Hier wurde noch nichts aufgezeichnet.',
	source: {
		import: 'importiert',
		live: 'aufgezeichnet'
	},
	bpm: 'bpm',
	exportGpx: 'GPX exportieren',
	deleteSession: 'Aufzeichnung löschen',
	runs: (count: number) => plural(count, { one: 'Abfahrt', other: 'Abfahrten' }),
	vertical: 'Höhenmeter',
	max: 'max.'
};
