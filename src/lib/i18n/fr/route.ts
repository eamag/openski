import type { Messages } from '../en/index.ts';
import { plural } from '../intl.ts';

export const route: Messages['route'] = {
	startFrom: 'Départ de…',
	whereTo: 'Où aller\u202F?',
	myLocation: 'Ma position',
	chooseOnMap: 'Choisir sur le plan',
	swap: 'Inverser départ et arrivée',
	hardestPiste: 'Piste la plus difficile',
	noDragLifts: 'Sans téléski',
	avoidFlats: 'Éviter les plats',
	bestConditions: 'Meilleur état de neige',
	avoidThem: 'Les éviter',
	ignore: 'Ignorer',
	closedLifts: (count: number) =>
		plural(count, { one: '# remontée fermée', other: '# remontées fermées' }),
	closedPistes: (count: number) =>
		plural(count, { one: '# piste fermée', other: '# pistes fermées' }),
	avoidingClosures: (summary: string, report: string) => `Évite ${summary}, ${report}.`,
	ignoringClosures: (summary: string, report: string) => `Ignore ${summary}, ${report}.`,
	reportStale: (time: string) => `selon le dernier bulletin reçu (${time}, pas de connexion)`,
	reportCurrent: (time: string) => `selon le bulletin du domaine à ${time}`,
	previewNotice:
		'Aperçu sur l’ensemble du domaine\u00A0: traverse des remontées ou pistes annoncées fermées aujourd’hui (indiquées ci-dessous).',
	down: (meters: string) => `${meters} de descente`,
	up: (meters: string) => `${meters} de montée`,
	walk: 'À pied',
	walkOrSkate: 'À pied / pas de patineur',
	rideDown: 'descendre',
	closed: 'fermé',
	unreported: 'non mentionné dans le bulletin du domaine',
	flatWarning: (distance: string) => `${distance} de plat, gardez votre vitesse`,
	waitingAt: (count: number, time: string) =>
		plural(count, {
			one: `# personne en attente à ${time}`,
			other: `# personnes en attente à ${time}`
		}),
	paceNote: 'Les temps supposent un rythme régulier et une courte attente à chaque remontée.',
	checkOpenNote: 'Vérifiez le jour même quelles remontées et pistes sont ouvertes.',
	noDestination:
		'Choisissez une destination, ou appuyez sur une piste ou une remontée sur le plan et sélectionnez «\u00A0Itinéraire jusqu’ici\u00A0».',
	problem: {
		startTooFar: 'Le départ est trop éloigné de toute piste ou remontée.',
		locationDenied:
			'L’accès à la position est désactivé. Choisissez un point de départ sur le plan.',
		waitingForLocation: 'En attente de votre position…',
		outsideResort: 'Vous êtes en dehors du domaine. Choisissez un point de départ sur le plan.',
		destinationTooFar: 'La destination est trop éloignée de toute piste ou remontée.',
		sameEndpoints: 'Le départ et la destination sont identiques.',
		noRouteFound:
			'Aucun itinéraire trouvé avec ces critères. Essayez une couleur plus difficile ou autorisez les téléskis.'
	}
};
