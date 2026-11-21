export const progress = {
	shareRidden: (share: string) => `${share} of the resort ridden`,
	kmRidden: (km: string, totalKm: string) => `${km} of ${totalKm} km ridden`,
	pistes: 'pistes',
	lifts: 'lifts',
	badges: {
		firstTracks: 'First tracks',
		firstTracksHint: 'Ride any piste',
		threeSummits: 'Three summits',
		topOfTheResort: 'Top of the resort',
		liftCollector: 'Lift collector',
		liftCollectorHint: 'Every lift'
	},
	tabs: {
		pistes: 'Pistes',
		lifts: 'Lifts'
	},
	filters: {
		all: 'All',
		todo: 'To do',
		done: 'Done'
	},
	action: {
		ridden: 'Ridden',
		markAsRidden: 'Mark as ridden',
		label: (action: string, name: string) => `${action}: ${name}`
	},
	emptyPistes: {
		done: 'No pistes ridden yet.',
		todo: 'Every piste ridden.',
		all: 'This map has no pistes to tick off.'
	},
	emptyLifts: {
		done: 'No lifts ridden yet.',
		todo: 'Every lift ridden.',
		all: 'This map has no lifts to tick off.'
	}
};
