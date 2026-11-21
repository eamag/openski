import type { Messages } from '../en/index.ts';

export const conditions: Messages['conditions'] = {
	byHour: 'Verhältnisse nach Stunde',
	noForecast: 'keine Vorhersage',
	hourCellAria: (hour: number, score: string) => `${hour}:00 Uhr, ${score}`,
	surface: {
		powder: 'Neuschnee',
		packed: 'Griffig',
		firm: 'Hart',
		icy: 'Eisig',
		soft: 'Weich',
		slush: 'Sulzig'
	},
	light: {
		sun: 'Sonne',
		shade: 'Schatten',
		flat: 'Diffuses Licht',
		fog: 'Nebel',
		glare: 'Tiefstehende Sonne'
	},
	score: {
		great: 'Ausgezeichnet',
		good: 'Gut',
		fair: 'Mäßig',
		poor: 'Schlecht',
		bad: 'Sehr schlecht'
	},
	weather: {
		clear: 'Klar',
		mostlySunny: 'Überwiegend sonnig',
		overcast: 'Bedeckt',
		fog: 'Nebel',
		drizzle: 'Nieselregen',
		rain: 'Regen',
		snow: 'Schneefall',
		showers: 'Schauer',
		snowShowers: 'Schneeschauer',
		thunderstorm: 'Gewitter'
	},
	error: {
		noForecastForArea: 'Für dieses Skigebiet gibt es keine Vorhersage.',
		forecastNotAnswering: 'Der Wetterbericht antwortet gerade nicht.',
		pisteConditionsNotAvailable:
			'Pistenverhältnisse sind für dieses Skigebiet noch nicht verfügbar.',
		pisteConditionsRebuilding:
			'Die Pistenverhältnisse für dieses Skigebiet werden neu berechnet. Versuche es später noch einmal.',
		forecastDidNotLoad:
			'Die Vorhersage konnte nicht geladen werden. Überprüfe deine Internetverbindung.'
	}
};
