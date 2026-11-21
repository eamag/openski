import type { Messages } from '../en/index.ts';

export const progress: Messages['progress'] = {
	shareRidden: (share: string) => `${share} du domaine parcouru`,
	kmRidden: (km: string, totalKm: string) => `${km} sur ${totalKm}\u00A0km parcourus`,
	pistes: 'pistes',
	lifts: 'remontées',
	badges: {
		firstTracks: 'Première trace',
		firstTracksHint: 'Descendez n’importe quelle piste',
		threeSummits: 'Trois sommets',
		topOfTheResort: 'Toit du domaine',
		liftCollector: 'Chasseur de remontées',
		liftCollectorHint: 'Toutes les remontées'
	},
	tabs: {
		pistes: 'Pistes',
		lifts: 'Remontées'
	},
	filters: {
		all: 'Toutes',
		todo: 'À faire',
		done: 'Faites'
	},
	action: {
		ridden: 'Parcourue',
		markAsRidden: 'Marquer comme parcourue',
		label: (action: string, name: string) => `${action}\u00A0: ${name}`
	},
	emptyPistes: {
		done: 'Aucune piste parcourue pour l’instant.',
		todo: 'Toutes les pistes ont été parcourues.',
		all: 'Ce plan n’a aucune piste à cocher.'
	},
	emptyLifts: {
		done: 'Aucune remontée empruntée pour l’instant.',
		todo: 'Toutes les remontées ont été empruntées.',
		all: 'Ce plan n’a aucune remontée à cocher.'
	}
};
