import { error } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { building } from '$app/env';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { env } from 'cloudflare:workers';
import { applyPageMeta, lookupPage } from '#lib/server/seo.ts';

const AUTH_PATHS = [
	'/api/auth',
	'/api/me',
	'/api/osm',
	'/api/contrib',
	'/login',
	'/logout',
	'/contribute/webcam'
];

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function isCrossSiteWrite(request: Request, url: URL): boolean {
	if (!UNSAFE_METHODS.has(request.method)) return false;
	const origin = request.headers.get('origin');
	return origin !== null && origin !== url.origin;
}

const SECURITY_HEADERS: Record<string, string> = {
	'X-Content-Type-Options': 'nosniff',
	'Referrer-Policy': 'strict-origin-when-cross-origin',
	'Content-Security-Policy': "frame-ancestors 'none'"
};

function withHeaders(response: Response, headers: Record<string, string>): Response {
	try {
		for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
		return response;
	} catch {
		const mutableCopy = new Response(response.body, response);
		for (const [name, value] of Object.entries(headers)) mutableCopy.headers.set(name, value);
		return mutableCopy;
	}
}

const isDevRoute = (path: string) => path === '/dev' || path.startsWith('/dev/');

function devRoutesEnabled(): boolean {
	if (import.meta.env.DEV) return true;
	const flag = String((env as Partial<Env>).ENABLE_DEV_ROUTES ?? '').toLowerCase();
	return flag === '1' || flag === 'true';
}

const handleAccounts: Handle = async ({ event, resolve }) => {
	if (building) return resolve(event);

	const path = event.url.pathname;
	if (isDevRoute(path) && !devRoutesEnabled()) error(404, 'Not found');

	const needsAccount = AUTH_PATHS.some(
		(prefix) => path === prefix || path.startsWith(`${prefix}/`)
	);
	if (!needsAccount) return resolve(event);
	if (isCrossSiteWrite(event.request, event.url))
		error(403, 'Cross-site requests are not accepted.');

	const db = (env as Partial<Env>).DB;
	if (!db) return new Response('Accounts are not set up on this deployment.', { status: 404 });

	const { createAuth, osmAuthConfigured } = await import('#lib/server/auth.ts');
	if (!osmAuthConfigured) return resolve(event);
	event.locals.auth = createAuth(db);

	const { auth } = event.locals;
	const session = await auth.api.getSession({ headers: event.request.headers });
	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

const TEST_SITE_HOST = 'openski.eamag.me';

export const handle: Handle = async ({ event, resolve }) => {
	const page = lookupPage(event.url.pathname);
	if (page.kind === 'not-found') error(404, 'Not found');
	const resolveWithPageMeta: typeof resolve =
		page.kind === 'page'
			? (pageEvent, options) =>
					resolve(pageEvent, {
						...options,
						transformPageChunk: ({ html }) => applyPageMeta(html, page.meta)
					})
			: resolve;
	const response = await handleAccounts({ event, resolve: resolveWithPageMeta });
	const isTestHost = event.url.hostname === TEST_SITE_HOST;
	return withHeaders(
		response,
		isTestHost ? { ...SECURITY_HEADERS, 'X-Robots-Tag': 'noindex' } : SECURITY_HEADERS
	);
};
