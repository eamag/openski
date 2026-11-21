import type { Messages } from '../en/index.ts';
import { plural } from '../intl.ts';

export const queues: Messages['queues'] = {
	level: {
		none: 'Keine Schlange',
		short: 'Kurze Schlange',
		queue: 'Warteschlange',
		long: 'Lange Schlange'
	},
	hideBoxes: 'Boxen ausblenden',
	showBoxes: 'Boxen einblenden',
	pictureAlt: (time: string, people: number) =>
		`Webcambild von ${time} Uhr mit ${plural(people, { one: '# markierten Person', other: '# markierten Personen' })}`,
	pictureMissingDevice:
		'Das Bild zu dieser Zählung ist nicht mehr auf diesem Gerät. Prüfe erneut, um es zu sehen.',
	boxedSummary: (count: number, cameraName: string, time: string) =>
		count === 0
			? `Niemand im Webcambild der Kamera ${cameraName} von ${time} Uhr gefunden.`
			: `${plural(count, { one: '# Person', other: '# Personen' })} im Webcambild der Kamera ${cameraName} von ${time} Uhr markiert.`,
	tapToHideBoxes: 'Tippe auf das Bild, um die Boxen auszublenden und selbst nachzuzählen.',
	originalPicture: (current?: number, total?: number) =>
		current && total ? `Originalbild ${current}/${total}` : 'Originalbild',
	openWebcam: 'Webcam öffnen',
	error: {
		needsConnection:
			'Das Zählen von Warteschlangen benötigt eine Verbindung: Die Webcambilder werden jedes Mal neu heruntergeladen.',
		noWebcamList: 'Die Liste der Webcams konnte nicht geladen werden.',
		webcamsNotAnswering: 'Die Webcams antworten nicht.',
		noWebcamImages: 'Die Webcambilder konnten nicht geladen werden.',
		camerasFailed: (failed: number, total: number, atTime?: boolean) =>
			`${failed} von ${total} Kameras lieferten kein Bild${atTime ? ' für diesen Zeitpunkt' : ''}.`,
		checkFailed: 'Warteschlangen konnten nicht geprüft werden.',
		cannotDrawOffscreen: 'Dieser Browser unterstützt kein Zeichnen im Hintergrund (Offscreen).',
		modelDownloadFailed: (status: number) =>
			`Der Personenzähler konnte nicht heruntergeladen werden (Fehler ${status}). Versuche es noch einmal.`,
		noPicturesToday: 'Die Kamera hat keine Bilder von heute.'
	}
};
