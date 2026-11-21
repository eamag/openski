import { t } from './i18n/index.ts';

export const SITE_NAME = 'openski.org';

export const homeTitle = () => t.titles.home;
export const resortsTitle = () => `${t.titles.resorts} · ${SITE_NAME}`;

export interface TitledResort {
	name: string;
	cams?: boolean;
}

const RESORT_PAGE_TITLES: Record<string, (resort: TitledResort) => string> = {
	'': ({ name, cams }) => t.titles.resortMap(name, !!cams),
	now: ({ name, cams }) => t.titles.resortNow(name, !!cams),
	route: ({ name }) => t.titles.resortRoute(name),
	about: ({ name }) => t.titles.resortAbout(name),
	track: ({ name }) => t.titles.resortTrack(name),
	progress: ({ name }) => t.titles.resortProgress(name),
	edit: ({ name }) => t.titles.resortEdit(name),
	questions: ({ name }) => t.titles.resortQuestions(name)
};

export function resortHeading(resort: TitledResort, page: string): string {
	return RESORT_PAGE_TITLES[page]?.(resort) ?? resort.name;
}

export function resortTitle(resort: TitledResort, page: string): string {
	return `${resortHeading(resort, page)} · ${SITE_NAME}`;
}

export function resortPageFromRouteId(routeId: string | null): string {
	return routeId?.split('/[resort]/')[1] ?? '';
}
