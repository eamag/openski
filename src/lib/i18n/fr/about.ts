import type { Messages } from '../en/index.ts';
import { plural } from '../intl.ts';

export const about: Messages['about'] = {
	pisteDistance: (distance: string) => `${distance} de pistes`,
	liftCount: (count: number) => plural(count, { one: '# remontée', other: '# remontées' }),
	elevationRange: (low: string, high: string, vertical: string) =>
		`${low}–${high} (${vertical} de dénivelé)`,
	summary: (pisteDistance: string, lifts: string, elevation: string) =>
		`${pisteDistance} · ${lifts} · ${elevation}`,
	lifts: 'Remontées',
	longestAndSteepest: 'Plus longues et plus raides',
	steepestAt: (gradient: string) => `${gradient} au plus raide`,
	aspectTitle: 'Orientation des pentes',
	pisteMaps: 'Plans des pistes',
	mapsLoading: 'Recherche des plans…',
	mapsLoadError: 'Impossible de charger les plans des pistes pour le moment.',
	noMaps: 'Aucun plan des pistes répertorié pour ce domaine.',
	noMapsSkimap: 'Aucun plan des pistes répertorié pour ce domaine sur skimap.org.',
	pisteMapAlt: (year: number, title?: string) =>
		`Plan des pistes ${year}${title ? `\u00A0: ${title}` : ''}`,
	originalFile: 'Fichier d’origine',
	mapFromYear: (year: number) => `Plan de ${year}`,
	attribution: {
		mapsFrom: 'Plans issus de',
		archiveDescription:
			', l’archive communautaire de plans des pistes, qui appartiennent à leurs éditeurs. Les pistes, remontées et altitudes proviennent d’OpenStreetMap.'
	}
};
