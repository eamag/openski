import type { Messages } from '../en/index.ts';
import { plural } from '../intl.ts';

export const offline: Messages['offline'] = {
	description: (name: string) =>
		`Speichert Basiskarte, Gelände und Vorhersage für ${name} auf diesem Gerät, sodass die gesamte Karte auch ohne Netz funktioniert. Pisten, Routen und Aufzeichnung funktionieren nach dem Speichern offline.`,
	saving: 'Wird gespeichert…',
	savingPercent: (percent: number) => `Wird gespeichert… ${percent} %`,
	updateMap: 'Offline-Karte aktualisieren',
	retryFailed: (failedCount: number) => `Download wiederholen (${failedCount} fehlen)`,
	downloadForOffline: 'Für Offline-Nutzung herunterladen',
	downloadFailed: (count: number) =>
		plural(count, {
			one: '# Datei konnte nicht heruntergeladen werden. Verbindung prüfen und erneut versuchen.',
			other:
				'# Dateien konnten nicht heruntergeladen werden. Verbindung prüfen und erneut versuchen.'
		}),
	needServiceWorker: 'Offline-Karten benötigen einen Service-Worker.',
	appInstalling: 'Die App wird noch installiert. Versuche es gleich noch einmal.'
};
