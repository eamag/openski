import type { Messages } from '../en/index.ts';

export const conditions: Messages['conditions'] = {
	byHour: 'Conditions heure par heure',
	noForecast: 'aucune prévision',
	hourCellAria: (hour: number, score: string) => `${hour}:00, ${score}`,
	surface: {
		powder: 'Poudreuse',
		packed: 'Accrocheuse',
		firm: 'Ferme',
		icy: 'Glacée',
		soft: 'Douce',
		slush: 'Neige soupe'
	},
	light: {
		sun: 'Soleil',
		shade: 'Ombre',
		flat: 'Jour blanc',
		fog: 'Brouillard',
		glare: 'Soleil rasant de face'
	},
	score: {
		great: 'Excellent',
		good: 'Bon',
		fair: 'Correct',
		poor: 'Médiocre',
		bad: 'Mauvais'
	},
	weather: {
		clear: 'Dégagé',
		mostlySunny: 'Éclaircies',
		overcast: 'Couvert',
		fog: 'Brouillard',
		drizzle: 'Bruine',
		rain: 'Pluie',
		snow: 'Neige',
		showers: 'Averses',
		snowShowers: 'Averses de neige',
		thunderstorm: 'Orage'
	},
	error: {
		noForecastForArea: 'Aucune prévision pour ce domaine skiable.',
		forecastNotAnswering: 'Les prévisions météo ne répondent pas pour le moment.',
		pisteConditionsNotAvailable:
			'L’état de la neige sur les pistes n’est pas encore disponible pour ce domaine skiable.',
		pisteConditionsRebuilding:
			'L’état de la neige pour ce domaine skiable est en cours d’actualisation. Réessayez plus tard.',
		forecastDidNotLoad: 'Les prévisions n’ont pas pu être chargées. Vérifiez votre connexion.'
	}
};
