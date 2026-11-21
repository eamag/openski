import { plural } from '../intl.ts';

export const about = {
	pisteDistance: (distance: string) => `${distance} of piste`,
	liftCount: (count: number) => plural(count, { one: '# lift', other: '# lifts' }),
	elevationRange: (low: string, high: string, vertical: string) =>
		`${low}–${high} (${vertical} vertical)`,
	summary: (pisteDistance: string, lifts: string, elevation: string) =>
		`${pisteDistance} · ${lifts} · ${elevation}`,
	lifts: 'Lifts',
	longestAndSteepest: 'Longest and steepest',
	steepestAt: (gradient: string) => `${gradient} at the steepest`,
	aspectTitle: 'Which way it faces',
	pisteMaps: 'Piste maps',
	mapsLoading: 'Looking for maps…',
	mapsLoadError: 'The piste maps could not be loaded right now.',
	noMaps: 'No piste map is listed for this resort.',
	noMapsSkimap: 'No piste map is listed for this resort on skimap.org.',
	pisteMapAlt: (year: number, title?: string) => `Piste map ${year}${title ? `: ${title}` : ''}`,
	originalFile: 'Original file',
	mapFromYear: (year: number) => `Map from ${year}`,
	attribution: {
		mapsFrom: 'Maps from',
		archiveDescription:
			', the community archive of ski maps, which belong to their publishers. Pistes, lifts and heights come from OpenStreetMap.'
	}
};
