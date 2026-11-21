import { error } from '@sveltejs/kit';
import { APP_USER_AGENT } from '#lib/identity.ts';
import { OFM_HOST } from '#lib/offline-config.ts';
import type { RequestHandler } from './$types';

const MAX_URL_LENGTH = 2048;
const MAX_TILE_BYTES = 5 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 15000;
const CACHE_SECONDS = 86400 * 7;

// The TileJSON, vector tiles and glyph ranges a resort download needs, nothing else.
const ALLOWED_PATH_PATTERN =
	/^\/(planet|planet\/[\w.-]+\/\d{1,2}\/\d{1,7}\/\d{1,7}\.pbf|fonts\/[\w %,-]+\/\d+-\d+\.pbf)$/;

export const GET: RequestHandler = async ({ url, request }) => {
	// Only this app's service worker downloads through here, not pages on other sites.
	const site = request.headers.get('sec-fetch-site');
	if (site && site !== 'same-origin') error(403, 'Offline downloads only.');

	const rawTarget = url.searchParams.get('url');
	if (!rawTarget || rawTarget.length > MAX_URL_LENGTH) {
		error(400, 'Missing or overlong url query parameter');
	}

	let targetUrl: URL;
	try {
		targetUrl = new URL(rawTarget);
	} catch {
		error(400, 'Invalid url query parameter');
	}

	if (targetUrl.protocol !== 'https:' || targetUrl.hostname !== OFM_HOST) {
		error(403, `Forbidden tile host: ${targetUrl.hostname}`);
	}

	if (targetUrl.port && targetUrl.port !== '443') {
		error(403, 'Invalid port');
	}

	if (targetUrl.username || targetUrl.password) {
		error(403, 'Credentials not permitted');
	}

	if (!ALLOWED_PATH_PATTERN.test(targetUrl.pathname)) {
		error(403, `Forbidden path: ${targetUrl.pathname}`);
	}

	const edgeCache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
	const edgeRequest = new Request(
		new URL(request.url).origin + `/api/offline-tiles?url=${encodeURIComponent(targetUrl.href)}`
	);
	const hit = await edgeCache?.match(edgeRequest);
	if (hit) return hit;

	let upstream: Response;
	try {
		upstream = await fetch(targetUrl.href, {
			headers: {
				'user-agent': APP_USER_AGENT,
				accept: request.headers.get('accept') ?? '*/*'
			},
			signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
		});
	} catch (err) {
		console.warn('offline_tile_fetch_failed', {
			url: targetUrl.href,
			reason: (err as Error).message
		});
		error(502, 'Tile provider is not answering.');
	}

	if (!upstream.ok) {
		error(upstream.status, `Upstream answered ${upstream.status}`);
	}

	const declaredLength = Number(upstream.headers.get('content-length'));
	if (Number.isFinite(declaredLength) && declaredLength > MAX_TILE_BYTES) {
		error(502, 'Tile response too large');
	}

	const contentType =
		upstream.headers.get('content-type') ||
		(targetUrl.pathname.endsWith('.pbf')
			? 'application/x-protobuf'
			: targetUrl.pathname === '/planet'
				? 'application/json'
				: 'application/octet-stream');

	const headers = new Headers({
		'content-type': contentType,
		'cache-control': `public, max-age=${CACHE_SECONDS}`
	});

	const response = new Response(upstream.body, { status: upstream.status, headers });
	if (edgeCache) await edgeCache.put(edgeRequest, response.clone());
	return response;
};
