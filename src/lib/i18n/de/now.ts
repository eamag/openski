import type { Messages } from '../en/index.ts';
import { formatMinutes, plural } from '../intl.ts';

export const now: Messages['now'] = {
	liftQueues: 'Warteschlangen an Liften',
	tabs: {
		pistes: 'Pisten',
		lifts: 'Lifte'
	},
	compass: ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'],
	windSpeed: (speed: string) => `${speed} Wind`,
	windUpTop: (speed: string, dir: string) => `Wind oben ${speed} ${dir}`,
	snowing: 'Schneefall',
	weatherSummary: (highTemp: string, highEle: string, lowTemp: string) =>
		`${highTemp} auf ${highEle}, ${lowTemp} im Tal`,
	underOneMinute: 'unter 1 Min.',
	aboutMinutes: (min: number) => `ca. ${formatMinutes(min)}`,
	peopleCount: (count: number) => plural(count, { one: '# Person', other: '# Personen' }),
	makingSnapshot: 'Momentaufnahme wird erstellt…',
	askAi: 'KI fragen, was man heute fahren soll',
	aiPrompt: (resortName: string, url: string, preference: string) =>
		`Ich fahre heute in ${resortName} Ski. Diese Seite zeigt das Skigebiet aktuell: welche Lifte und Pisten ` +
		`geöffnet sind, stündliche Schnee-, Licht- und Windverhältnisse auf jeder Piste sowie auf Webcams gezählte Liftschlangen: ${url}\n\n` +
		`Lies das und schlage mir vor, was ich für den Rest des Tages fahren soll${preference}. ` +
		`Verlinke jede Piste und jeden Lift, den du nennst, mit dem Link von dieser Seite.`,
	aiFilterPreference: (label: string) => ` (am liebsten Pisten der Kategorie ${label})`,
	copiedPrompt: 'Kopiert: In einen beliebigen KI-Chat einfügen.',
	openPrompt: 'In einem KI-Chat öffnen:',
	aiPromptHint: 'Die KI liest die Momentaufnahme und antwortet mit Links hierher zurück.',
	snapshotError: (message: string) => `Momentaufnahme konnte nicht erstellt werden (${message}).`,
	noConnection: 'keine Verbindung',
	calculatingConditions: 'Sonne, Schnee und Wind werden für jede Piste berechnet…',
	bestAllDay: 'den ganzen Tag am besten',
	bestTimeRange: (from: number, to: number) => `am besten ${from}:00–${to}:00 Uhr`,
	factors: {
		snow: 'Schnee',
		light: 'Licht',
		wind: 'Wind'
	},
	windWord: {
		calm: 'Ruhig',
		breezy: 'Auffrischend',
		windy: 'Windig',
		stormy: 'Stürmisch'
	},
	routeHere: 'Route hierher',
	scoreAria: (scoreWord: string, score: number) => `${scoreWord}, ${score} von 100`,
	allClosedToday: 'Alle Pisten dieser Farbe sind heute geschlossen.',
	noPistesOfColour: 'Keine Pisten dieser Farbe.',
	pistesReportedClosed: (count: number) =>
		plural(count, {
			one: '# Piste, die das Skigebiet heute als geschlossen meldet, wird ausgelassen.',
			other: '# Pisten, die das Skigebiet heute als geschlossen meldet, werden ausgelassen.'
		}),
	disclaimer:
		'Eine Schätzung anhand des Wetterberichts, des Sonnenstands und des Geländeprofils. Schließt aus, was das Skigebiet als geschlossen meldet, weiß aber nicht, was frisch präpariert wurde.',
	weatherDataBy: 'Wetterdaten von',
	noWebcams: 'Für dieses Skigebiet sind noch keine Webcams eingerichtet',
	addWebcam: 'Webcam hinzufügen',
	gettingCounter: (percent: string) => `Personenzähler wird geladen… ${percent}`,
	lookingForPictures: 'Aktuelle Webcambilder werden gesucht…',
	countingPeople: (done: number, total: number) =>
		`Personen werden gezählt… ${done} von ${total} Ansichten`,
	liftsShutTitle: 'Die Lifte sind geschlossen.',
	liftsShutDesc: (from: string, until: string) =>
		`Warteschlangen werden von ${from} bis ${until} Uhr Ortszeit gezählt.`,
	picturesFromTitle: (times: string) => `Webcambilder von ${times} Uhr.`,
	picturesFromDesc: 'Tippe auf ein Zählergebnis, um das zugehörige Bild zu sehen.',
	countPeopleTitle: (count: number) =>
		plural(count, {
			one: 'Personen auf # Webcam zählen.',
			other: 'Personen auf # Webcams zählen.'
		}),
	countPeopleDesc:
		'Läuft direkt auf deinem Telefon. Jede Überprüfung lädt die neuesten Webcambilder herunter; beim ersten Mal zusätzlich den 15 MB großen Personenzähler.',
	check: 'Prüfen',
	checkAgain: 'Erneut prüfen',
	inView: (people: string, time: string) => `${people} im Bild · ${time} Uhr`,
	waitingSummary: (people: string, waitTime: string, time: string) =>
		`${people} warten · ${waitTime} · ${time} Uhr`,
	noPictureFromCamera: (cameraName: string) => `Kein Bild von der Kamera ${cameraName}`,
	closedToday: 'Heute geschlossen',
	cameraAt: (cameraName: string) => `Kamera bei ${cameraName}`,
	noWebcamLooksAtQueue: 'In diesem Skigebiet zeigt keine Webcam auf eine Liftschlange.',
	aroundMountain: 'Rund um den Berg',
	aroundMountainHint: 'Personen im Bild, wo eine Webcam keine Liftschlange zeigt.',
	turningCamera: ', Schwenkkamera',
	noPictureFromGenericCamera: 'Kein Bild von der Kamera',
	unwatchedSummary: (count: number) =>
		count === 0
			? 'Jeder Lift wird von einer Webcam erfasst.'
			: plural(count, {
					one: '# anderer Lift ist von keiner Webcam aus zu sehen.',
					other: '# andere Lifte sind von keiner Webcam aus zu sehen.'
				}),
	queueDisclaimer:
		'Gezählt wird, was eine Kamera vom Wartebereich sehen kann. Eine lange Schlange bedeutet daher „mindestens so lang“, und Nebel oder Schneefall „nicht erkennbar“. Aktuelle Zählergebnisse fließen in Routenzeiten ein.',
	addWebcamOrArea: 'Webcam oder Wartebereich hinzufügen'
};
