import { plural } from '../intl.ts';

export const place = {
	closedToday: 'Closed today',
	drop: (meters: string) => `${meters} drop`,
	up: (meters: string) => `${meters} up`,
	poiType: {
		hut: 'Mountain hut',
		restaurant: 'Restaurant',
		cafe: 'Café',
		bar: 'Bar',
		toilets: 'Toilets',
		viewpoint: 'Viewpoint'
	},
	average: 'Average',
	steepest: 'Steepest',
	flatPush: 'Flat (push)',
	averageSlope: 'Average slope',
	length: 'Length',
	slope: (percent: string, degrees: string) => `${percent} · ${degrees}`,
	capacity: (n: number) => plural(n, { one: '# person an hour', other: '# people an hour' }),
	bubble: 'Bubble',
	heatedSeats: 'Heated seats',
	routeHere: 'Route here',
	fromHere: 'From here',
	ridden: 'Ridden',
	markRidden: 'Mark ridden',
	editOsm: 'Edit on OpenStreetMap',
	trackedProgress: (percent: string) => `Tracked ${percent} of this piste so far.`,
	features: {
		lit: 'Lit at night',
		ungroomed: 'Not groomed',
		tunnel: 'Tunnel'
	},
	outlook: {
		today: 'today',
		tomorrow: 'tomorrow',
		inDays: (n: number) => plural(n, { one: 'in # day', other: 'in # days' }),
		atTime: (time: string, when: string) => ` at ${time} ${when}`
	},
	profile: {
		title: 'Elevation profile',
		ariaLabel: (top: string, bottom: string, distance: string, steepest: string) =>
			`Elevation profile: ${top} to ${bottom} over ${distance}, steepest ${steepest}`,
		afterDistance: (bottom: string, distance: string) => `${bottom} after ${distance}`
	},
	compass: {
		north: 'north',
		'north-east': 'north-east',
		east: 'east',
		'south-east': 'south-east',
		south: 'south',
		'south-west': 'south-west',
		west: 'west',
		'north-west': 'north-west'
	},
	cardinal: {
		north: 'N',
		east: 'E',
		south: 'S',
		west: 'W'
	},
	aspect: {
		summary: (direction: string, percent: string) => `Most piste faces ${direction}: ${percent}`,
		mostFaces: 'Most piste faces',
		ofItsLength: (percent: string) => `(${percent} of its length)`,
		hint: 'The ground slopes down towards the long wedges. South-facing runs soften first; north-facing ones keep their snow.'
	}
};
