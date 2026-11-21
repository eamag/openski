import { error } from '@sveltejs/kit';
import { enforce } from '#lib/server/rate-limit.ts';
import { isAllowedUpstream, safeFetch } from '#lib/server/upstream.ts';
import type { RequestHandler } from './$types';

const CACHE_SECONDS = 120;
const MAX_URL_LENGTH = 2_048;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const RATE_LIMIT_REQUESTS = 60;
const RATE_LIMIT_WINDOW_MS = 60_000;
const UPSTREAM_TIMEOUT_MS = 10_000;

export const GET: RequestHandler = async ({ url, request }) => {
	enforce(request, 'webcam-picture', RATE_LIMIT_REQUESTS, RATE_LIMIT_WINDOW_MS);

	const rawTarget = url.searchParams.get('url');
	if (!rawTarget || rawTarget.length > MAX_URL_LENGTH) {
		error(400, 'Missing or overlong url query parameter');
	}
	let targetUrl: URL;
	try {
		targetUrl = new URL(rawTarget);
	} catch {
		error(400, `Invalid URL: ${rawTarget}`);
	}
	if (!isAllowedUpstream(targetUrl)) {
		error(403, `Forbidden picture host: ${targetUrl.hostname}`);
	}

	const edgeCache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
	const edgeRequest = new Request(
		new URL(request.url).origin +
			`/api/webcam-resolve/picture?url=${encodeURIComponent(targetUrl.href)}`
	);
	const hit = await edgeCache?.match(edgeRequest);
	if (hit) return hit;

	let upstream: Response;
	try {
		upstream = await safeFetch(
			targetUrl.href,
			{},
			{
				maxBytes: MAX_IMAGE_BYTES,
				timeoutMs: UPSTREAM_TIMEOUT_MS,
				imageOnly: true,
				accept: 'image/*'
			}
		);
	} catch (err) {
		console.warn('webcam_picture_failed', {
			host: targetUrl.hostname,
			reason: (err as Error).message
		});
		error(502, 'The webcam picture is not answering.');
	}

	const headers = new Headers({
		'content-type': upstream.headers.get('content-type') as string,
		'cache-control': `public, max-age=${CACHE_SECONDS}`,
		'access-control-allow-origin': '*'
	});
	const modified = upstream.headers.get('last-modified');
	if (modified) headers.set('last-modified', modified);

	const response = new Response(upstream.body, { headers });
	if (edgeCache) await edgeCache.put(edgeRequest, response.clone());
	return response;
};
