import type { Messages } from '../en/index.ts';

export const titles: Messages['titles'] = {
	home: 'OpenSki · Plans des pistes propulsés par OpenStreetMap',
	resorts: 'Domaines skiables',
	resortMap: (name: string, hasQueueCams: boolean) =>
		hasQueueCams
			? `${name}\u00A0: plan des pistes, état de la neige et files d'attente`
			: `${name}\u00A0: plan des pistes et état de la neige`,
	resortNow: (name: string, hasQueueCams: boolean) =>
		hasQueueCams
			? `${name}\u00A0: état de la neige et files d'attente aujourd’hui`
			: `${name}\u00A0: état de la neige aujourd’hui`,
	resortRoute: (name: string) => `${name}\u00A0: planificateur d'itinéraire à ski et snowboard`,
	resortAbout: (name: string) => `${name}\u00A0: domaine skiable, pistes, remontées et plans`,
	resortTrack: (name: string) => `Enregistrer une journée à ${name}`,
	resortProgress: (name: string) => `Pistes parcourues à ${name}`,
	resortEdit: (name: string) => `Améliorer la carte de ${name} sur OpenStreetMap`,
	resortQuestions: (name: string) => `Répondre aux questions sur ${name}`
};
