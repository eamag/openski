import type { Messages } from '../en/index.ts';

export const settings: Messages['settings'] = {
	title: 'Einstellungen',
	close: 'Einstellungen schließen',
	language: 'Sprache',
	languageAuto: (deviceLanguage: string) => `Wie auf diesem Telefon (${deviceLanguage})`,
	languageHint: 'Namen von Skigebieten, Pisten und Liften bleiben wie erfasst.',
	appearance: 'Erscheinungsbild',
	theme: {
		auto: 'Automatisch',
		autoHint: 'Diesem Telefon folgen',
		light: 'Hell',
		lightHint: 'Hell, wie der Schnee',
		dark: 'Dunkel',
		darkHint: 'Angenehmer für die Augen bei Nacht',
		sunset: 'Dunkel nach Sonnenuntergang',
		sunsetHint: 'Wird im Skigebiet nach Sonnenuntergang dunkel'
	},
	mapDisplay: 'Kartendarstellung',
	account: 'Benutzerkonto',
	offlineData: 'Offline-Daten',
	removeSaved: (name: string) => `${name} von diesem Gerät entfernen`,
	savedDays: 'Gespeicherte Skitage',
	forgetDays: (resortName: string) =>
		`Alle in ${resortName} aufgezeichneten Tage löschen? Dies kann nicht rückgängig gemacht werden.`,
	confirmClear: 'Ja, löschen',
	keepDays: 'Behalten',
	clearDays: 'Tage in diesem Skigebiet löschen',
	clearDaysHint: 'Aufzeichnungen, abgehakte Pisten und Lifte',
	aboutResort: (name: string) => `Über ${name}`,
	aboutResortHint: 'Pisten, Lifte und Pistenpläne',
	sourceCode: 'Quellcode auf GitHub',
	sourceCodeHint: 'Repository ist noch nicht öffentlich'
};
