import { formatNumber, plural } from '../intl.ts';

export const map = {
	unavailable: 'Resort unavailable',
	chooseResort: 'Choose a resort',
	chooseDifferentResort: 'Choose a different resort',
	searchPlaceholder: (resort: string) => `Search ${resort} pistes, lifts, huts`,
	options: 'Map options',
	aboutResort: (name: string) => `About ${name}`,
	aboutDescription: 'Pistes by colour, lifts, which way it faces and piste maps',
	offlineMap: 'Offline map',
	allSettings: 'All settings',
	settingsDescription: 'Appearance, account, offline data and more',
	settings: 'Settings',
	helpAria: 'Answer questions to improve this map',
	terrain3d: '3D terrain',
	locationUnavailable: 'Location unavailable',
	showLocation: 'Show my location',
	start: 'start',
	destination: 'destination',
	tapMapToSet: (target: string) => `Tap the map to set the ${target}`,
	sheet: {
		expand: 'Expand panel',
		collapse: 'Show more of the map'
	},
	dimClosed: 'Fade what is closed',
	dimDone: 'Fade what I have ridden',
	slopes: 'Shade steep terrain',
	slopesHint: 'Slope angles as on avalanche maps, from zoom 11: where the off-piste gets steep',
	closedDefaultHint: 'Lifts and pistes the resort reports closed today',
	reportMissing: 'The resort’s open/closed report is not available right now',
	reportNoSource: 'No live open/closed report for this ski area yet',
	statusCounts: (openLifts: number, totalLifts: number, openPistes: number, totalPistes: number) =>
		`${formatNumber(openLifts)} of ${plural(totalLifts, { one: '# lift', other: '# lifts' })} and ${formatNumber(openPistes)} of ${plural(totalPistes, { one: '# piste', other: '# pistes' })} open`,
	staleReport: (counts: string, at: string) =>
		`${counts}, last known report from ${at} (no connection)`,
	reportedAt: (counts: string, at: string) => `${counts}, as reported at ${at}`,
	doneCounts: (pistesDone: number, pistesTotal: number, liftsDone: number, liftsTotal: number) =>
		`${formatNumber(pistesDone)} of ${plural(pistesTotal, { one: '# piste', other: '# pistes' })} and ${formatNumber(liftsDone)} of ${plural(liftsTotal, { one: '# lift', other: '# lifts' })} done; what is left stays bright`,
	doneDefaultHint: 'Pistes and lifts you have finished; what is left stays bright',
	slopeClass: {
		30: '30–35°',
		35: '35–40°',
		40: '40–45°',
		45: 'over 45°'
	},
	errorNotFound: 'There is no map for this ski area yet.',
	errorStatus: (status: number) => `The map did not load (error ${status}). Try again.`,
	errorNetwork: 'The map did not load. Check your connection and try again.',
	myLocation: 'My location',
	droppedPin: 'Dropped pin',
	onPiste: (name: string) => `On ${name}`,
	nearLift: (name: string) => `Near ${name}`,
	station: {
		bottom: 'bottom',
		middle: 'middle',
		top: 'top',
		label: (name: string, which: string) => `${name} · ${which}`
	},
	pisteDetail: (km: string, top: string, bottom: string) => `${km} · ${top}–${bottom}`,
	pisteRef: (ref: string) => `Piste ${ref}`,
	pisteLink: 'Link'
};
