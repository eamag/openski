import type { Messages } from '../en/index.ts';

export const difficulty: Messages['difficulty'] = {
	grade: {
		novice: 'Débutant',
		easy: 'Facile',
		intermediate: 'Intermédiaire',
		advanced: 'Difficile',
		expert: 'Expert',
		freeride: 'Hors-piste',
		unknown: 'Non classée'
	},
	sign: {
		green: 'Verte',
		blue: 'Bleue',
		red: 'Rouge',
		black: 'Noire',
		doubleBlack: 'Double noire',
		skiRoute: 'Itinéraire'
	},
	signWithGrade: (sign: string, grade: string) => `${sign} · ${grade}`,
	difficultyUnknown: 'Difficulté inconnue',
	all: 'Toutes',
	pistesByDifficulty: 'Pistes par difficulté',
	pistesByColour: 'Pistes par couleur',
	badgeTitle: {
		green: 'Adepte des vertes',
		blue: 'Adepte des bleues',
		red: 'Dans le rouge',
		black: 'Retour au noir',
		easy: 'Adepte des faciles',
		intermediate: 'Adepte des intermédiaires',
		advanced: 'Adepte des difficiles'
	},
	badgeHint: {
		green: 'Toutes les pistes vertes',
		blue: 'Toutes les pistes bleues',
		red: 'Toutes les pistes rouges',
		black: 'Toutes les pistes noires',
		easy: 'Toutes les pistes faciles',
		intermediate: 'Toutes les pistes intermédiaires',
		advanced: 'Toutes les pistes difficiles'
	},
	slope: {
		uphill: 'Montée',
		flat: 'Plat, moins de 5\u00A0%',
		easy: (name: string) => `Pente ${name}, 5–25\u00A0%`,
		intermediate: (name: string) => `${name}, 25–40\u00A0%`,
		advanced: (name: string) => `${name}, 40–80\u00A0%`,
		expert: 'Plus de 80\u00A0%'
	}
};
