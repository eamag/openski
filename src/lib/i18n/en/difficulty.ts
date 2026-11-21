/** Piste grades: OSM's grade words and the colours resorts paint on their signs. */
export const difficulty = {
	grade: {
		novice: 'Beginner',
		easy: 'Easy',
		intermediate: 'Intermediate',
		advanced: 'Advanced',
		expert: 'Expert',
		freeride: 'Freeride',
		unknown: 'Not graded'
	},
	sign: {
		green: 'Green',
		blue: 'Blue',
		red: 'Red',
		black: 'Black',
		doubleBlack: 'Double black',
		skiRoute: 'Ski route'
	},
	/** "Blue · Intermediate" where the sign colour and the grade word differ. */
	signWithGrade: (sign: string, grade: string) => `${sign} · ${grade}`,
	difficultyUnknown: 'Difficulty unknown',
	all: 'All',
	pistesByDifficulty: 'Pistes by difficulty',
	pistesByColour: 'Pistes by colour',
	/** Progress badges for riding every piste of one grade, by the name skiers use there. */
	badgeTitle: {
		green: 'Green cruiser',
		blue: 'Blue cruiser',
		red: 'Seeing red',
		black: 'Back in black',
		easy: 'Easy cruiser',
		intermediate: 'Intermediate cruiser',
		advanced: 'Advanced cruiser'
	},
	badgeHint: {
		green: 'Every green piste',
		blue: 'Every blue piste',
		red: 'Every red piste',
		black: 'Every black piste',
		easy: 'Every easy piste',
		intermediate: 'Every intermediate piste',
		advanced: 'Every advanced piste'
	},
	/** Elevation profile colours by gradient; `name` is the local name of that grade. */
	slope: {
		uphill: 'Uphill',
		flat: 'Flat, under 5 %',
		easy: (name: string) => `${name} steepness, 5–25 %`,
		intermediate: (name: string) => `${name}, 25–40 %`,
		advanced: (name: string) => `${name}, 40–80 %`,
		expert: 'Over 80 %'
	}
};
