export const osm = {
	presets: {
		lift: {
			name: {
				label: 'Lift name',
				question: 'What is the name of this lift?'
			},
			ref: {
				label: 'Lift reference',
				question: 'What number or letter code is shown for this lift?'
			},
			aerialway: {
				label: 'Lift type',
				question: 'What type of lift is this?'
			},
			occupancy: {
				label: 'Chair / cabin occupancy',
				unit: 'seats',
				question: 'How many people fit on one chair or cabin?'
			},
			capacity: {
				label: 'Uphill capacity',
				unit: 'pers/h',
				question: 'What is the hourly capacity of this lift?'
			},
			duration: {
				label: 'Ride time',
				unit: 'min',
				question: 'How long does the ride take from bottom to top?'
			},
			bubble: {
				label: 'Weather bubble',
				question: 'Does this chairlift have a weather protection hood / bubble?'
			},
			heating: {
				label: 'Heated seats',
				question: 'Does this chairlift have heated seats?'
			},
			openingHours: {
				label: 'Operating hours',
				question: 'What are the operating hours of this lift?'
			},
			oneway: {
				label: 'One-way travel',
				question: 'Is this lift one-way (uphill only) or two-way?'
			},
			lit: {
				label: 'Floodlit',
				question: 'Is this lift illuminated for night skiing?'
			},
			website: {
				label: 'Lift website',
				question: 'What is the official webpage for this lift?'
			},
			bicycle: {
				label: 'Bicycle transport',
				question: 'Can you take a mountain bike on this lift?',
				summer: 'Summer'
			}
		},
		piste: {
			name: {
				label: 'Piste name',
				question: 'What is the official name of this piste?'
			},
			ref: {
				label: 'Piste number',
				question: 'What number or reference is marked on the piste markers?'
			},
			difficulty: {
				label: 'Difficulty',
				question: 'What is the color/difficulty rating of this piste?'
			},
			grooming: {
				label: 'Grooming',
				question: 'How is this slope prepared (groomed, mogul, freeride)?',
				classic: 'Groomed',
				mogul: 'Moguls',
				backcountry: 'Not groomed'
			},
			lit: {
				label: 'Floodlit',
				question: 'Is this piste illuminated for night skiing?'
			},
			oneway: {
				label: 'One-way direction',
				question: 'Is skiing permitted in only one direction down this piste?'
			},
			snowmaking: {
				label: 'Snowmaking',
				question: 'Does this piste have artificial snowmaking cannons or lances?'
			},
			gladed: {
				label: 'Tree run / gladed',
				question: 'Is this a gladed piste (skiing through thinned trees)?'
			},
			abandoned: {
				label: 'Abandoned piste',
				question: 'Is this piste permanently closed / abandoned?'
			}
		}
	},
	quests: {
		liftOccupancy: {
			question: (name: string) => `How many people fit on one ${name} chair or cabin?`,
			hint: 'Count the seats, or read the number on the station sign.'
		},
		liftBubble: {
			question: (name: string) =>
				`Do the chairs of ${name} have a bubble (a hood that closes over you)?`
		},
		liftHeating: {
			question: (name: string) => `Are the seats of ${name} heated?`
		},
		liftRef: {
			question: (name: string) => `Which number or code is on the sign of ${name}?`,
			hint: 'As printed at the station or lift tower, e.g. "C34" or "12".'
		},
		pisteDifficulty: {
			question: (name: string) => `Which grade do the markers of ${name} show?`,
			hint: 'The colour or symbol on the piste markers and signs.'
		},
		pisteGrooming: {
			question: (name: string) => `Is ${name} groomed?`,
			hint: 'Groomed: smooth corduroy from the snow cats. Moguls: bumps left on purpose.',
			classic: 'Groomed',
			mogul: 'Moguls',
			backcountry: 'Not groomed'
		},
		pisteRef: {
			question: (name: string) => `Which number is on the markers of ${name}?`,
			hint: 'The number on the poles along the edge of the piste.'
		},
		pisteSnowmaking: {
			question: (name: string) => `Are there snow cannons or lances along ${name}?`
		},
		pisteLit: {
			question: (name: string) => `Is ${name} lit for night skiing?`,
			hint: 'Floodlight masts along the piste.'
		}
	}
};
