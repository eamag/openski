import {
	homeTitle,
	resortsTitle,
	resortHeading,
	resortTitle,
	SITE_NAME
} from '#lib/page-titles.ts';
import type { CatalogResort } from '#lib/resort/catalog.ts';
import { FEEDS } from '#lib/status/feeds.ts';
import { findResort } from './catalog.ts';

export const SITE_URL = 'https://openski.org';

const APP_PAGES = new Set(['', 'resorts', 'now', 'progress', 'route', 'track']);
const NON_PAGE_SEGMENTS = new Set([
	'api',
	's',
	'login',
	'logout',
	'contribute',
	'dev',
	'sitemap.xml',
	'llms.txt'
]);
const RESORT_PAGES = new Set([
	'',
	'now',
	'route',
	'about',
	'track',
	'progress',
	'edit',
	'questions'
]);
const PRIVATE_RESORT_PAGES = new Set(['track', 'progress', 'edit', 'questions']);

export interface PageMeta {
	title: string;
	description: string;
	canonicalPath: string;
	indexable: boolean;
	structuredData?: object;
	heading?: string;
}

const HOME_DESCRIPTION =
	'Explore free offline piste maps for about 3,900 ski areas and help improve OpenStreetMap. Plan ski and snowboard routes, check snow conditions and see lift queues where available.';

const HOME_META: PageMeta = {
	title: homeTitle(),
	description: HOME_DESCRIPTION,
	canonicalPath: '/',
	indexable: true,
	structuredData: {
		'@context': 'https://schema.org',
		'@type': 'WebApplication',
		name: SITE_NAME,
		url: `${SITE_URL}/`,
		applicationCategory: 'TravelApplication',
		operatingSystem: 'Any',
		isAccessibleForFree: true,
		offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
		description: HOME_DESCRIPTION
	}
};

function countryName(code: string): string {
	try {
		return new Intl.DisplayNames(['en'], { type: 'region' }).of(code.toUpperCase()) ?? code;
	} catch {
		return code;
	}
}

function describeResort(resort: CatalogResort): string {
	const [lowest, highest] = resort.ele;
	const size = `${Math.round(resort.km)} km of pistes and ${resort.lifts} lifts between ${lowest} and ${highest} m`;
	const webcams = resort.webcams ? `, ${resort.webcams} webcams` : '';
	const live = [
		FEEDS[resort.id] ? 'live lift status' : '',
		resort.cams ? 'lift queues counted from webcams' : ''
	].filter(Boolean);
	const extras = live.length ? `, ${live.join(', ')}` : '';
	return `Explore and help improve the OpenStreetMap piste map of ${resort.name}, ${countryName(resort.country)}: ${size}${webcams}. Offline maps, ski and snowboard routes, and hour-by-hour snow conditions${extras}.`;
}

function resortMeta(resort: CatalogResort, page: string): PageMeta {
	const resortPath = `/${resort.id}`;
	const indexable = resort.built && !PRIVATE_RESORT_PAGES.has(page);
	const canonicalPath = indexable && page ? `${resortPath}/${page}` : resortPath;
	const [longitude, latitude] = resort.center;
	return {
		title: resortTitle(resort, page),
		description: describeResort(resort),
		canonicalPath,
		indexable,
		heading: resortHeading(resort, page),
		structuredData: {
			'@context': 'https://schema.org',
			'@type': 'SkiResort',
			name: resort.name,
			url: `${SITE_URL}${resortPath}`,
			geo: { '@type': 'GeoCoordinates', latitude, longitude },
			address: { '@type': 'PostalAddress', addressCountry: resort.country.toUpperCase() },
			...(resort.web ? { sameAs: resort.web } : {})
		}
	};
}

export type PageLookup =
	{ kind: 'page'; meta: PageMeta } | { kind: 'not-found' } | { kind: 'other' };

export function lookupPage(pathname: string): PageLookup {
	const [first = '', page = '', ...rest] = pathname.split('/').filter(Boolean);
	if (NON_PAGE_SEGMENTS.has(first)) return { kind: 'other' };
	if (APP_PAGES.has(first) && !page) {
		if (first === '') return { kind: 'page', meta: HOME_META };
		if (first === 'resorts')
			return {
				kind: 'page',
				meta: {
					...HOME_META,
					title: resortsTitle(),
					canonicalPath: '/resorts',
					structuredData: undefined
				}
			};
		return { kind: 'page', meta: { ...HOME_META, canonicalPath: '/', indexable: false } };
	}
	const resort = findResort(first);
	if (!resort || rest.length || !RESORT_PAGES.has(page)) return { kind: 'not-found' };
	return { kind: 'page', meta: resortMeta(resort, page) };
}

const escapeHtml = (text: string) =>
	text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function applyPageMeta(html: string, meta: PageMeta): string {
	const canonical = `${SITE_URL}${meta.canonicalPath}`;
	const title = escapeHtml(meta.title);
	const description = escapeHtml(meta.description);
	const headExtras = [
		meta.indexable ? '' : '<meta name="robots" content="noindex" />',
		meta.structuredData
			? `<script type="application/ld+json">${JSON.stringify(meta.structuredData).replace(/</g, '\\u003c')}</script>`
			: ''
	].join('');
	const crawlerSummary = meta.heading
		? `<noscript><h1>${escapeHtml(meta.heading)}</h1><p>${description}</p><p><a href="/resorts">All ski areas</a></p></noscript>`
		: '';
	return html
		.replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`)
		.replace(/(<meta\s+name="description"\s+content=")[^"]*(")/, `$1${description}$2`)
		.replace(/(<meta\s+property="og:title"\s+content=")[^"]*(")/, `$1${title}$2`)
		.replace(/(<meta\s+property="og:description"\s+content=")[^"]*(")/, `$1${description}$2`)
		.replace(/(<meta\s+property="og:url"\s+content=")[^"]*(")/, `$1${canonical}$2`)
		.replace(/(<link\s+rel="canonical"\s+href=")[^"]*(")/, `$1${canonical}$2`)
		.replace('</head>', `${headExtras}</head>`)
		.replace(/(<body[^>]*>)/, `$1${crawlerSummary}`);
}
