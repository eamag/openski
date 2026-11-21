import type { Messages } from '../en/index.ts';
import { plural } from '../intl.ts';

export const about: Messages['about'] = {
	pisteDistance: (distance: string) => `${distance} Pisten`,
	liftCount: (count: number) => plural(count, { one: '# Lift', other: '# Lifte' }),
	elevationRange: (low: string, high: string, vertical: string) =>
		`${low}–${high} (${vertical} Höhenmeter)`,
	summary: (pisteDistance: string, lifts: string, elevation: string) =>
		`${pisteDistance} · ${lifts} · ${elevation}`,
	lifts: 'Lifte',
	longestAndSteepest: 'Längste und steilste',
	steepestAt: (gradient: string) => `${gradient} an der steilsten Stelle`,
	aspectTitle: 'Hangausrichtung',
	pisteMaps: 'Pistenpläne',
	mapsLoading: 'Pistenpläne werden gesucht…',
	mapsLoadError: 'Die Pistenpläne konnten gerade nicht geladen werden.',
	noMaps: 'Für dieses Skigebiet ist kein Pistenplan verzeichnet.',
	noMapsSkimap: 'Auf skimap.org ist für dieses Skigebiet kein Pistenplan verzeichnet.',
	pisteMapAlt: (year: number, title?: string) => `Pistenplan ${year}${title ? `: ${title}` : ''}`,
	originalFile: 'Originaldatei',
	mapFromYear: (year: number) => `Plan von ${year}`,
	attribution: {
		mapsFrom: 'Pistenpläne von',
		archiveDescription:
			', dem Community-Archiv für Pistenpläne, deren Rechte bei den jeweiligen Herausgebern liegen. Pisten, Lifte und Höhenangaben stammen von OpenStreetMap.'
	}
};
