import { error, json } from '@sveltejs/kit';
import { enforce } from '#lib/server/rate-limit.ts';
import { safeFetch } from '#lib/server/upstream.ts';
import { isWinter, parseSkimap, skimapPage, type SkimapMap } from '#lib/skimap.ts';
import type { RequestHandler } from './$types';

const SKIMAP_CACHE_MAX_AGE_SECONDS = 7 * 24 * 3600;
const MAX_UPSTREAM_RESPONSE_BYTES = 2 * 1024 * 1024;
const RATE_LIMIT_MAX_REQUESTS = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;
const UPSTREAM_TIMEOUT_MS = 10_000;

export const GET: RequestHandler = async ({ params, request }) => {
	enforce(request, 'skimap', RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS);
	const isNumericSkimapId = /^\d{1,7}$/.test(params.id);
	if (!isNumericSkimapId) error(404, 'Unknown ski area');

	const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
	const cacheKey = new Request(new URL(request.url).origin + `/api/skimap/${params.id}`);
	const hit = await cache?.match(cacheKey);
	if (hit) return hit;

	let maps: SkimapMap[];
	try {
		const res = await safeFetch(
			skimapPage(Number(params.id)),
			{},
			{
				hosts: ['skimap.org'],
				maxBytes: MAX_UPSTREAM_RESPONSE_BYTES,
				timeoutMs: UPSTREAM_TIMEOUT_MS
			}
		);
		if (res.status === 404) maps = [];
		else if (!res.ok) throw new Error(`skimap.org answered ${res.status}`);
		else maps = parseSkimap(await res.text()).filter(isWinter);
	} catch (err) {
		console.warn('skimap_failed', { id: params.id, reason: (err as Error).message });
		error(502, 'Piste maps are unavailable right now.');
	}

	const response = json(maps, {
		headers: { 'cache-control': `public, max-age=${SKIMAP_CACHE_MAX_AGE_SECONDS}` }
	});
	await cache?.put(cacheKey, response.clone());
	return response;
};
