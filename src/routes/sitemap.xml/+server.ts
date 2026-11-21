import { builtResorts } from '#lib/server/catalog.ts';
import { SITE_URL } from '#lib/server/seo.ts';

export const prerender = true;

const INDEXED_RESORT_PAGES = ['', '/now', '/about'];

export function GET() {
	const paths = [
		'/',
		'/resorts',
		...builtResorts().flatMap((resort) =>
			INDEXED_RESORT_PAGES.map((page) => `/${resort.id}${page}`)
		)
	];
	const urls = paths.map((path) => `<url><loc>${SITE_URL}${path}</loc></url>`).join('\n');
	return new Response(
		`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
		{ headers: { 'content-type': 'application/xml; charset=utf-8' } }
	);
}
