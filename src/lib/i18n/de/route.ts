import type { Messages } from '../en/index.ts';
import { plural } from '../intl.ts';

export const route: Messages['route'] = {
	startFrom: 'Starten bei…',
	whereTo: 'Wohin soll es gehen?',
	myLocation: 'Mein Standort',
	chooseOnMap: 'Auf der Karte auswählen',
	swap: 'Start und Ziel tauschen',
	hardestPiste: 'Schwierigste Piste',
	noDragLifts: 'Keine Schlepplifte',
	avoidFlats: 'Flachstücke vermeiden',
	bestConditions: 'Beste Schneeverhältnisse',
	avoidThem: 'Vermeiden',
	ignore: 'Ignorieren',
	closedLifts: (count: number) =>
		plural(count, { one: '# geschlossener Lift', other: '# geschlossene Lifte' }),
	closedPistes: (count: number) =>
		plural(count, { one: '# geschlossene Piste', other: '# geschlossene Pisten' }),
	avoidingClosures: (summary: string, report: string) => `Gemieden: ${summary}, ${report}.`,
	ignoringClosures: (summary: string, report: string) => `Ignoriert: ${summary}, ${report}.`,
	reportStale: (time: string) =>
		`laut letztem Bericht auf dem Telefon (${time} Uhr, keine Verbindung)`,
	reportCurrent: (time: string) => `laut Meldung des Skigebiets um ${time} Uhr`,
	previewNotice:
		'Dies ist eine Vorschau über den gesamten Berg: Sie führt über Lifte oder Pisten, die das Skigebiet heute als geschlossen meldet (unten markiert).',
	down: (meters: string) => `${meters} bergab`,
	up: (meters: string) => `${meters} bergauf`,
	walk: 'Gehen',
	walkOrSkate: 'Gehen / skaten',
	rideDown: 'abfahren',
	closed: 'geschlossen',
	unreported: 'nicht im Bericht des Skigebiets',
	flatWarning: (distance: string) => `${distance} flach, Schwung mitnehmen`,
	waitingAt: (count: number, time: string) =>
		plural(count, { one: `# wartet um ${time} Uhr`, other: `# warten um ${time} Uhr` }),
	paceNote: 'Zeiten gehen von zügigem Tempo und kurzen Wartezeiten an jedem Lift aus.',
	checkOpenNote: 'Prüfe am jeweiligen Tag, welche Lifte und Pisten geöffnet sind.',
	noDestination:
		'Wähle ein Ziel oder tippe auf eine Piste oder einen Lift auf der Karte und wähle „Route hierher“.',
	problem: {
		startTooFar: 'Der Startpunkt liegt zu weit von Pisten oder Liften entfernt.',
		locationDenied: 'Standortzugriff ist deaktiviert. Wähle stattdessen einen Startpunkt.',
		waitingForLocation: 'Warte auf Standort…',
		outsideResort: 'Du bist außerhalb des Skigebiets. Wähle stattdessen einen Startpunkt.',
		destinationTooFar: 'Das Ziel liegt zu weit von Pisten oder Liften entfernt.',
		sameEndpoints: 'Start und Ziel sind identisch.',
		noRouteFound:
			'Mit diesen Einstellungen wurde kein Weg gefunden. Wähle eine schwerere Pistenfarbe oder erlaube Schlepplifte.'
	}
};
