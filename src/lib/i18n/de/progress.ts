import type { Messages } from '../en/index.ts';

export const progress: Messages['progress'] = {
	shareRidden: (share: string) => `${share} des Skigebiets gefahren`,
	kmRidden: (km: string, totalKm: string) => `${km} von ${totalKm} km gefahren`,
	pistes: 'Pisten',
	lifts: 'Lifte',
	badges: {
		firstTracks: 'Erste Spuren',
		firstTracksHint: 'Fahre eine beliebige Piste',
		threeSummits: 'Drei Gipfel',
		topOfTheResort: 'Höchster Punkt',
		liftCollector: 'Liftsammler',
		liftCollectorHint: 'Jeder Lift'
	},
	tabs: {
		pistes: 'Pisten',
		lifts: 'Lifte'
	},
	filters: {
		all: 'Alle',
		todo: 'Offen',
		done: 'Gefahren'
	},
	action: {
		ridden: 'Gefahren',
		markAsRidden: 'Als gefahren markieren',
		label: (action: string, name: string) => `${action}: ${name}`
	},
	emptyPistes: {
		done: 'Noch keine Pisten gefahren.',
		todo: 'Alle Pisten gefahren.',
		all: 'Diese Karte hat keine Pisten zum Abhaken.'
	},
	emptyLifts: {
		done: 'Noch keine Lifte gefahren.',
		todo: 'Alle Lifte gefahren.',
		all: 'Diese Karte hat keine Lifte zum Abhaken.'
	}
};
