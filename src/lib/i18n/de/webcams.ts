import type { Messages } from '../en/index.ts';

export const webcams: Messages['webcams'] = {
	webcam: 'Webcam',
	loading: 'Bild wird geladen…',
	unavailable:
		'Das Bild ist gerade nicht verfügbar. Die Webcam-Seite zeigt es möglicherweise noch an.',
	showPicture: 'Bild anzeigen',
	heavyHint: '(einige MB)',
	openPage: 'Webcam-Seite öffnen',
	countQueues: 'Liftschlangen auf dieser Webcam zählen',
	pictureAlt: (name: string) => `Aktuelles Bild der Webcam ${name}`
};
