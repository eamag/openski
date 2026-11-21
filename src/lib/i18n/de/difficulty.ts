import type { Messages } from '../en/index.ts';

/** Piste grades: OSM's grade words and the colours resorts paint on their signs. */
export const difficulty: Messages['difficulty'] = {
	grade: {
		novice: 'Anfänger',
		easy: 'Leicht',
		intermediate: 'Mittel',
		advanced: 'Schwer',
		expert: 'Experte',
		freeride: 'Freeride',
		unknown: 'Nicht eingestuft'
	},
	sign: {
		green: 'Grün',
		blue: 'Blau',
		red: 'Rot',
		black: 'Schwarz',
		doubleBlack: 'Doppelschwarz',
		skiRoute: 'Skiroute'
	},
	/** "Blue · Intermediate" where the sign colour and the grade word differ. */
	signWithGrade: (sign: string, grade: string) => `${sign} · ${grade}`,
	difficultyUnknown: 'Schwierigkeit unbekannt',
	all: 'Alle',
	pistesByDifficulty: 'Pisten nach Schwierigkeit',
	pistesByColour: 'Pisten nach Farbe',
	/** Progress badges for riding every piste of one grade, by the name skiers use there. */
	badgeTitle: {
		green: 'Grüner Cruiser',
		blue: 'Blauer Cruiser',
		red: 'Rot sehen',
		black: 'Ganz in Schwarz',
		easy: 'Leichter Cruiser',
		intermediate: 'Mittlerer Cruiser',
		advanced: 'Schwerer Cruiser'
	},
	badgeHint: {
		green: 'Jede grüne Piste',
		blue: 'Jede blaue Piste',
		red: 'Jede rote Piste',
		black: 'Jede schwarze Piste',
		easy: 'Jede leichte Piste',
		intermediate: 'Jede mittlere Piste',
		advanced: 'Jede schwere Piste'
	},
	/** Elevation profile colours by gradient; `name` is the local name of that grade. */
	slope: {
		uphill: 'Bergauf',
		flat: 'Flach, unter 5 %',
		easy: (name: string) => `${name}-Steilheit, 5–25 %`,
		intermediate: (name: string) => `${name}, 25–40 %`,
		advanced: (name: string) => `${name}, 40–80 %`,
		expert: 'Über 80 %'
	}
};
