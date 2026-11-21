import type { Messages } from '../en/index.ts';
import { plural } from '../intl.ts';

export const place: Messages['place'] = {
	closedToday: 'Fermé aujourd’hui',
	drop: (meters: string) => `${meters} de descente`,
	up: (meters: string) => `${meters} de montée`,
	poiType: {
		hut: 'Refuge de montagne',
		restaurant: 'Restaurant',
		cafe: 'Café',
		bar: 'Bar',
		toilets: 'Toilettes',
		viewpoint: 'Point de vue'
	},
	average: 'Moyenne',
	steepest: 'Plus raide',
	flatPush: 'Plat (pousser)',
	averageSlope: 'Pente moyenne',
	length: 'Longueur',
	slope: (percent: string, degrees: string) => `${percent} · ${degrees}`,
	capacity: (n: number) =>
		plural(n, { one: '# personne par heure', other: '# personnes par heure' }),
	bubble: 'Bulle',
	heatedSeats: 'Sièges chauffants',
	routeHere: 'Itinéraire jusqu’ici',
	fromHere: 'Depuis ici',
	ridden: 'Parcourue',
	markRidden: 'Marquer comme parcourue',
	editOsm: 'Modifier sur OpenStreetMap',
	trackedProgress: (percent: string) => `${percent} de cette piste enregistrés jusqu’ici.`,
	features: {
		lit: 'Éclairée la nuit',
		ungroomed: 'Non damée',
		tunnel: 'Tunnel'
	},
	outlook: {
		today: 'aujourd’hui',
		tomorrow: 'demain',
		inDays: (n: number) => plural(n, { one: 'dans # jour', other: 'dans # jours' }),
		atTime: (time: string, when: string) => ` à ${time} ${when}`
	},
	profile: {
		title: 'Profil altimétrique',
		ariaLabel: (top: string, bottom: string, distance: string, steepest: string) =>
			`Profil altimétrique\u00A0: de ${top} à ${bottom} sur ${distance}, pente max ${steepest}`,
		afterDistance: (bottom: string, distance: string) => `${bottom} après ${distance}`
	},
	compass: {
		north: 'nord',
		'north-east': 'nord-est',
		east: 'est',
		'south-east': 'sud-est',
		south: 'sud',
		'south-west': 'sud-ouest',
		west: 'ouest',
		'north-west': 'nord-ouest'
	},
	cardinal: {
		north: 'N',
		east: 'E',
		south: 'S',
		west: 'O'
	},
	aspect: {
		summary: (direction: string, percent: string) =>
			`La majeure partie de la piste est orientée ${direction}\u00A0: ${percent}`,
		mostFaces: 'Orientation principale',
		ofItsLength: (percent: string) => `(${percent} de sa longueur)`,
		hint: 'La pente descend vers les pointes les plus longues. Les pentes orientées sud ramollissent en premier\u00A0; celles orientées nord gardent leur neige.'
	}
};
