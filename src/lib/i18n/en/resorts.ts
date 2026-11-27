import { formatUnit, plural } from '../intl.ts';

export const resorts = {
	tagline: 'Piste conditions & lift queues',
	backToMap: 'Back to map',
	searchPlaceholder: 'Search 4,000 ski areas by name…',
	searchAria: 'Search ski areas',
	clearSearchAria: 'Clear search',
	loading: 'Loading ski areas…',
	loadError: 'The list of ski areas did not load. Check your connection and try again.',
	searchResultsHeading: (count: string) => `Search results (${count})`,
	noMatches: (query: string) => `No ski areas found matching "${query}"`,
	noMapYet: 'No map yet',
	lastOpened: 'Last opened',
	openMap: 'Open map',
	allResortsHeading: (count: string) => `All ski area maps (${count})`,
	showMoreResorts: (remaining: string) => `Show more (${remaining} left)`,
	liftCount: (count: number) => plural(count, { one: '# lift', other: '# lifts' }),
	pistesKm: (km: number) => `${formatUnit(Math.round(km), 'kilometer')} pistes`,
	pisteKmByColourAria: (breakdown: string) => `Piste kilometres by colour: ${breakdown}`
};
