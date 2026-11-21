import { error, json } from '@sveltejs/kit';
import { enforce } from '#lib/server/rate-limit.ts';
import { createSafeFetch, isAllowedUpstream, UpstreamError } from '#lib/server/upstream.ts';
import { adapters, resolveWebcam } from '#lib/webcams/resolve.ts';
import { type ResolvedWebcam, UnsupportedWebcam } from '#lib/webcams/types.ts';
import type { RequestHandler } from './$types';

const namedProviderAdapters = adapters.filter((adapter) => adapter.name !== 'direct');

const MAX_INPUT_CHARS = 2_048;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;
const RATE_LIMIT_REQUESTS = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;
const UPSTREAM_TIMEOUT_MS = 10_000;
const BROWSER_CACHE_CONTROL = 'public, max-age=600';

interface CacheEntry {
	data: ResolvedWebcam;
	expiresAt: number;
}

const resolveCache = new Map<string, CacheEntry>();

function isHostClaimedByAdapter(url: URL): boolean {
	return namedProviderAdapters.some((adapter) => adapter.match(url));
}

function isAllowedTarget(url: URL): boolean {
	return isAllowedUpstream(url) && isHostClaimedByAdapter(url);
}

function assertAllowedPictureHost(pictureUrl: URL): void {
	if (!isAllowedUpstream(pictureUrl)) {
		throw new UpstreamError(`Picture host not allowed: ${pictureUrl.hostname}`);
	}
}

function remember(cacheKey: string, data: ResolvedWebcam): void {
	if (resolveCache.size >= MAX_CACHE_ENTRIES) {
		const oldest = resolveCache.keys().next().value;
		if (oldest !== undefined) resolveCache.delete(oldest);
	}
	resolveCache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

export const GET: RequestHandler = async ({ url, request }) => {
	enforce(request, 'webcam-resolve', RATE_LIMIT_REQUESTS, RATE_LIMIT_WINDOW_MS);

	const rawTarget = url.searchParams.get('url');
	if (!rawTarget || rawTarget.length > MAX_INPUT_CHARS) {
		error(400, 'Missing or overlong url query parameter');
	}

	let targetUrl: URL;
	try {
		targetUrl = new URL(rawTarget);
	} catch {
		error(400, `Invalid URL: ${rawTarget}`);
	}
	if (!isAllowedTarget(targetUrl)) {
		error(422, `Unsupported webcam host: ${targetUrl.hostname}`);
	}

	const cacheKey = targetUrl.href;
	const cached = resolveCache.get(cacheKey);
	if (cached && Date.now() < cached.expiresAt) {
		return json(cached.data, { headers: { 'cache-control': BROWSER_CACHE_CONTROL } });
	}

	const edgeCache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
	const edgeRequest = new Request(
		new URL(request.url).origin + `/api/webcam-resolve?url=${encodeURIComponent(cacheKey)}`
	);
	const hit = await edgeCache?.match(edgeRequest);
	if (hit) return hit;

	try {
		const resolved = await resolveWebcam(
			targetUrl.href,
			createSafeFetch({ maxBytes: MAX_RESPONSE_BYTES, timeoutMs: UPSTREAM_TIMEOUT_MS })
		);
		const picture = new URL(resolved.imageUrl, targetUrl);
		assertAllowedPictureHost(picture);
		remember(cacheKey, resolved);

		const response = json(resolved, { headers: { 'cache-control': BROWSER_CACHE_CONTROL } });
		if (edgeCache) await edgeCache.put(edgeRequest, response.clone());
		return response;
	} catch (err) {
		if (err instanceof UnsupportedWebcam) {
			error(422, `Unsupported webcam host: ${err.host}`);
		}
		console.warn('webcam_resolve_failed', {
			host: targetUrl.hostname,
			reason: (err as Error).message
		});
		error(502, `Failed to resolve webcam: ${(err as Error).message}`);
	}
};
