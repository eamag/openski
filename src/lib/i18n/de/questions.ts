import type { Messages } from '../en/index.ts';
import { formatNumber, plural } from '../intl.ts';

export const questions: Messages['questions'] = {
	backToMap: 'Zurück zur Karte',
	title: (resortName: string) => `Hilf mit, ${resortName} zu kartieren`,
	thisResort: 'dieses Skigebiet',
	questionsLeft: (count: number) => plural(count, { one: 'noch # Frage', other: 'noch # Fragen' }),
	drafted: (count: number) => `${formatNumber(count)} im Entwurf`,
	answersSaved: (changesetId: number) => `Antworten gespeichert · Änderungssatz #${changesetId}`,
	testNodeCreated: (changesetId: number) =>
		`Test-Knoten auf dem OSM-Dev-Server erstellt · Änderungssatz #${changesetId}`,
	viewChangeset: 'Änderungssatz auf OpenStreetMap ansehen ↗',
	answersNotSaved: (count: number) =>
		plural(count, {
			one: '# Antwort noch nicht gespeichert',
			other: '# Antworten noch nicht gespeichert'
		}),
	checkAndSaveHint: 'Überprüfe sie und speichere sie auf OpenStreetMap',
	reviewAndSave: 'Prüfen und speichern',
	signInPrompt:
		'Beantworte ruhig schon Fragen; melde dich mit OpenStreetMap an, sobald du speichern willst.',
	cantSaveYet: 'Speichern noch nicht möglich',
	savingUnavailable: 'Speichern auf OpenStreetMap ist gerade nicht verfügbar.',
	grantEditPermission: 'Bearbeitungsrechte erteilen',
	loadError: (error: string) => `Die Fragen konnten nicht geladen werden (${error}).`,
	lift: 'Lift',
	piste: 'Piste',
	distanceAway: (distance: string) => `${distance} entfernt`,
	sections: (count: number) => plural(count, { one: '# Abschnitt', other: '# Abschnitte' }),
	anotherNumber: 'Andere Nummer',
	typeItHere: 'Hier eingeben',
	ok: 'OK',
	skip: 'Nicht sicher · nächste Frage',
	allAnswered:
		'Hier gibt es keine offenen Fragen mehr: Jeder Lift und jede Piste hat diese Angaben. Vielen Dank!',
	addWebcam: 'Webcam und zugehörige Wartebereiche hinzufügen',
	savingToServer: (server: string, isTest: boolean) =>
		`Speichert auf ${server}${isTest ? ' (dem Testserver)' : ''}.`,
	review: {
		title: 'Deine Antworten überprüfen',
		ariaLabel: 'Deine Antworten überprüfen',
		close: 'Prüfung schließen',
		answersTogether: (count: number) =>
			`${plural(count, { one: '# Antwort', other: '# Antworten' })}, zusammen als ein Änderungssatz gespeichert`,
		notSaved: 'Nicht gespeichert',
		tagsToAdd: 'Hinzuzufügende Tags',
		removeAnswer: 'Antwort entfernen',
		waysCount: (count: number) => plural(count, { one: '# Way', other: '# Ways' }),
		wayRef: (wayId: number) => `Way #${wayId}`,
		comment: 'Änderungssatz-Kommentar',
		source: 'Quelle',
		surveyHint: '„survey“ bedeutet, dass du es selbst vor Ort auf der Piste gesehen hast.',
		surveyExplanation:
			'Deine Antworten müssen aus deiner eigenen Beobachtung vor Ort am Berg stammen und dürfen nicht von Pistenplänen Dritter kopiert werden. Sie ergänzen nur Tags, die noch fehlen, und werden unter deinem eigenen OpenStreetMap-Konto gespeichert, wo jeder sie sehen und verbessern kann.',
		saveToOsm: 'Auf OpenStreetMap speichern',
		saving: 'Wird gespeichert…',
		signInToSave: 'Zum Speichern mit OpenStreetMap anmelden',
		savingUnavailable: 'Speichern auf OpenStreetMap ist gerade nicht verfügbar.'
	},
	errors: {
		signInRequired: 'Melde dich mit OpenStreetMap an, um deine Antworten zu speichern.',
		conflict:
			'Jemand hat diese Ways auf OpenStreetMap vor einem Moment geändert. Schließe dies, öffne die Fragen erneut und versuche es noch einmal.',
		savingFailed: (status: number) => `Speichern fehlgeschlagen (Fehler ${status}).`,
		noConnection:
			'Keine Verbindung. Deine Antworten bleiben erhalten; versuche es erneut, sobald du wieder online bist.'
	}
};
