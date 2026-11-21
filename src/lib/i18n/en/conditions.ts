export const conditions = {
	byHour: 'Conditions by hour',
	noForecast: 'no forecast',
	hourCellAria: (hour: number, score: string) => `${hour}:00, ${score}`,
	surface: {
		powder: 'Fresh snow',
		packed: 'Grippy',
		firm: 'Firm',
		icy: 'Icy',
		soft: 'Soft',
		slush: 'Slushy'
	},
	light: {
		sun: 'Sun',
		shade: 'Shade',
		flat: 'Flat light',
		fog: 'Fog',
		glare: 'Low sun ahead'
	},
	score: {
		great: 'Great',
		good: 'Good',
		fair: 'Fair',
		poor: 'Poor',
		bad: 'Bad'
	},
	weather: {
		clear: 'Clear',
		mostlySunny: 'Mostly sunny',
		overcast: 'Overcast',
		fog: 'Fog',
		drizzle: 'Drizzle',
		rain: 'Rain',
		snow: 'Snow',
		showers: 'Showers',
		snowShowers: 'Snow showers',
		thunderstorm: 'Thunderstorm'
	},
	error: {
		noForecastForArea: 'There is no forecast for this ski area.',
		forecastNotAnswering: 'The weather forecast is not answering right now.',
		pisteConditionsNotAvailable: 'Piste conditions are not available for this ski area yet.',
		pisteConditionsRebuilding:
			'Piste conditions for this ski area are being rebuilt. Try again later.',
		forecastDidNotLoad: 'The forecast did not load. Check your connection.'
	}
};
