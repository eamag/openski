import type { Messages } from '../en/index.ts';
import { formatNumber, plural } from '../intl.ts';

export const map: Messages['map'] = {
	unavailable: 'Domaine indisponible',
	chooseResort: 'Choisir un domaine',
	chooseDifferentResort: 'Choisir un autre domaine',
	searchPlaceholder: (resort: string) => `Pistes, remontées, refuges à ${resort}`,
	options: 'Options du plan',
	aboutResort: (name: string) => `À propos de ${name}`,
	aboutDescription: 'Pistes par couleur, remontées, orientation et plans des pistes',
	offlineMap: 'Plan hors ligne',
	allSettings: 'Tous les paramètres',
	settingsDescription: 'Apparence, compte, données hors ligne et plus encore',
	settings: 'Paramètres',
	helpAria: 'Répondre aux questions pour améliorer ce plan',
	terrain3d: 'Relief 3D',
	locationUnavailable: 'Position indisponible',
	showLocation: 'Afficher ma position',
	start: 'le départ',
	destination: 'l’arrivée',
	tapMapToSet: (target: string) => `Touchez le plan pour définir ${target}`,
	sheet: {
		expand: 'Agrandir le panneau',
		collapse: 'Afficher plus de carte'
	},
	dimClosed: 'Atténuer ce qui est fermé',
	dimDone: 'Atténuer ce qui a été parcouru',
	slopes: 'Ombrer les pentes raides',
	slopesHint:
		'Inclinaison des pentes comme sur les cartes des avalanches, dès le zoom 11\u00A0: là où le hors-piste devient raide',
	closedDefaultHint: 'Remontées et pistes annoncées fermées aujourd’hui par le domaine',
	reportMissing: 'Le bulletin d’ouverture du domaine n’est pas disponible pour le moment',
	reportNoSource: 'Aucun bulletin d’ouverture en direct pour ce domaine skiable pour le moment',
	statusCounts: (openLifts: number, totalLifts: number, openPistes: number, totalPistes: number) =>
		`${formatNumber(openLifts)} sur ${plural(totalLifts, { one: '# remontée', other: '# remontées' })} et ${formatNumber(openPistes)} sur ${plural(totalPistes, { one: '# piste', other: '# pistes' })} ouvertes`,
	staleReport: (counts: string, at: string) =>
		`${counts}, selon le dernier bulletin de ${at} (pas de connexion)`,
	reportedAt: (counts: string, at: string) => `${counts}, selon le bulletin de ${at}`,
	doneCounts: (pistesDone: number, pistesTotal: number, liftsDone: number, liftsTotal: number) =>
		`${formatNumber(pistesDone)} sur ${plural(pistesTotal, { one: '# piste', other: '# pistes' })} et ${formatNumber(liftsDone)} sur ${plural(liftsTotal, { one: '# remontée', other: '# remontées' })} faites\u00A0; le reste reste éclairé`,
	doneDefaultHint: 'Pistes et remontées déjà parcourues\u00A0; le reste reste éclairé',
	slopeClass: {
		30: '30–35°',
		35: '35–40°',
		40: '40–45°',
		45: 'plus de 45°'
	},
	errorNotFound: 'Il n’y a pas encore de plan pour ce domaine skiable.',
	errorStatus: (status: number) => `Le plan n’a pas pu être chargé (erreur ${status}). Réessayez.`,
	errorNetwork: 'Le plan n’a pas pu être chargé. Vérifiez votre connexion et réessayez.',
	myLocation: 'Ma position',
	droppedPin: 'Repère placé',
	onPiste: (name: string) => `Sur ${name}`,
	nearLift: (name: string) => `Près de ${name}`,
	station: {
		bottom: 'gare de départ',
		middle: 'gare intermédiaire',
		top: 'gare d’arrivée',
		label: (name: string, which: string) => `${name} · ${which}`
	},
	pisteDetail: (km: string, top: string, bottom: string) => `${km} · ${top}–${bottom}`,
	pisteRef: (ref: string) => `Piste ${ref}`,
	pisteLink: 'Lien'
};
