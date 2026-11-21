import { plural } from '../intl.ts';

export const route = {
	startFrom: 'Start from…',
	whereTo: 'Where to?',
	myLocation: 'My location',
	chooseOnMap: 'Choose on the map',
	swap: 'Swap start and destination',
	hardestPiste: 'Hardest piste',
	noDragLifts: 'No drag lifts',
	avoidFlats: 'Avoid flats',
	bestConditions: 'Best conditions',
	avoidThem: 'Avoid them',
	ignore: 'Ignore',
	closedLifts: (count: number) => plural(count, { one: '# closed lift', other: '# closed lifts' }),
	closedPistes: (count: number) =>
		plural(count, { one: '# closed piste', other: '# closed pistes' }),
	avoidingClosures: (summary: string, report: string) => `Avoiding ${summary}, ${report}.`,
	ignoringClosures: (summary: string, report: string) => `Ignoring ${summary}, ${report}.`,
	reportStale: (time: string) => `from the last report the phone has (${time}, no connection)`,
	reportCurrent: (time: string) => `as the resort reported at ${time}`,
	previewNotice:
		'This is a preview across the whole mountain: it runs through lifts or pistes the resort reports closed today (marked below).',
	down: (meters: string) => `${meters} down`,
	up: (meters: string) => `${meters} up`,
	walk: 'Walk',
	walkOrSkate: 'Walk / skate',
	rideDown: 'ride down',
	closed: 'closed',
	unreported: "not in the resort's report",
	flatWarning: (distance: string) => `${distance} flat, keep your speed`,
	waitingAt: (count: number, time: string) =>
		plural(count, { one: `# waiting at ${time}`, other: `# waiting at ${time}` }),
	paceNote: 'Times assume a steady pace and a short wait at each lift.',
	checkOpenNote: 'Check on the day which lifts and pistes are open.',
	noDestination: 'Pick a destination, or tap a piste or lift on the map and choose “Route here”.',
	problem: {
		startTooFar: 'The start is too far from any piste or lift.',
		locationDenied: 'Location access is off. Pick a starting point instead.',
		waitingForLocation: 'Waiting for your location…',
		outsideResort: 'You are outside the resort. Pick a starting point instead.',
		destinationTooFar: 'The destination is too far from any piste or lift.',
		sameEndpoints: 'Start and destination are the same.',
		noRouteFound: 'No way there within these limits. Try a harder colour or allow drag lifts.'
	}
};
