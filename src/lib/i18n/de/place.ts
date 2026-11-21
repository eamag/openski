import type { Messages } from '../en/index.ts';
import { plural } from '../intl.ts';

export const place: Messages['place'] = {
	closedToday: 'Heute geschlossen',
	drop: (meters: string) => `${meters} bergab`,
	up: (meters: string) => `${meters} bergauf`,
	poiType: {
		hut: 'Berghütte',
		restaurant: 'Restaurant',
		cafe: 'Café',
		bar: 'Bar',
		toilets: 'Toiletten',
		viewpoint: 'Aussichtspunkt'
	},
	average: 'Durchschnitt',
	steepest: 'Steilste Stelle',
	flatPush: 'Flachstück (schieben)',
	averageSlope: 'Durchschnittliches Gefälle',
	length: 'Länge',
	slope: (percent: string, degrees: string) => `${percent} · ${degrees}`,
	capacity: (n: number) =>
		plural(n, { one: '# Person pro Stunde', other: '# Personen pro Stunde' }),
	bubble: 'Haube',
	heatedSeats: 'Sitzheizung',
	routeHere: 'Route hierher',
	fromHere: 'Von hier',
	ridden: 'Gefahren',
	markRidden: 'Als gefahren markieren',
	editOsm: 'Auf OpenStreetMap bearbeiten',
	trackedProgress: (percent: string) => `Bisher ${percent} dieser Piste aufgezeichnet.`,
	features: {
		lit: 'Nachts beleuchtet',
		ungroomed: 'Nicht präpariert',
		tunnel: 'Tunnel'
	},
	outlook: {
		today: 'heute',
		tomorrow: 'morgen',
		inDays: (n: number) => plural(n, { one: 'in # Tag', other: 'in # Tagen' }),
		atTime: (time: string, when: string) => ` um ${time} Uhr ${when}`
	},
	profile: {
		title: 'Höhenprofil',
		ariaLabel: (top: string, bottom: string, distance: string, steepest: string) =>
			`Höhenprofil: ${top} bis ${bottom} über ${distance}, steilste Stelle ${steepest}`,
		afterDistance: (bottom: string, distance: string) => `${bottom} nach ${distance}`
	},
	compass: {
		north: 'Norden',
		'north-east': 'Nordosten',
		east: 'Osten',
		'south-east': 'Südosten',
		south: 'Süden',
		'south-west': 'Südwesten',
		west: 'Westen',
		'north-west': 'Nordwesten'
	},
	cardinal: {
		north: 'N',
		east: 'O',
		south: 'S',
		west: 'W'
	},
	aspect: {
		summary: (direction: string, percent: string) =>
			`Größtenteils nach ${direction} ausgerichtet: ${percent}`,
		mostFaces: 'Hauptausrichtung der Piste',
		ofItsLength: (percent: string) => `(${percent} der Länge)`,
		hint: 'Das Gelände fällt in Richtung der langen Spitzen ab. Südhänge werden zuerst weich, Nordhänge halten ihren Schnee länger.'
	}
};
