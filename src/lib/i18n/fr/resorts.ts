import type { Messages } from '../en/index.ts';
import { formatUnit, plural } from '../intl.ts';

export const resorts: Messages['resorts'] = {
	tagline: 'État des pistes et files d’attente',
	backToMap: 'Retour au plan',
	searchPlaceholder: 'Rechercher parmi 4\u00A0000 domaines skiables…',
	searchAria: 'Rechercher un domaine skiable',
	clearSearchAria: 'Effacer la recherche',
	loading: 'Chargement des domaines skiables…',
	loadError:
		'La liste des domaines skiables n’a pas pu être chargée. Vérifiez votre connexion et réessayez.',
	searchResultsHeading: (count: string) => `Résultats de recherche (${count})`,
	noMatches: (query: string) => `Aucun domaine skiable trouvé pour «\u00A0${query}\u00A0»`,
	noMapYet: 'Pas encore de plan',
	lastOpened: 'Dernière ouverture',
	openMap: 'Ouvrir le plan',
	allResortsHeading: (count: string) => `Tous les plans des domaines (${count})`,
	liftCount: (count: number) => plural(count, { one: '# remontée', other: '# remontées' }),
	pistesKm: (km: number) => `${formatUnit(Math.round(km), 'kilometer')} de pistes`,
	pisteKmByColourAria: (breakdown: string) => `Kilomètres de pistes par couleur\u00A0: ${breakdown}`
};
