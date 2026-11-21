import { APP_USER_AGENT } from '#lib/identity.ts';
import { error, json } from '@sveltejs/kit';
import { parseAspen } from '#lib/status/aspen.ts';
import { FEEDS, VENDOR_CREDIT } from '#lib/status/feeds.ts';
import { parseIntermaps } from '#lib/status/intermaps.ts';
import { parseInfosnow } from '#lib/status/infosnow.ts';
import { parseItinemap } from '#lib/status/itinemap.ts';
import { parseLumiplan } from '#lib/status/lumiplan.ts';
import { parseLumiplay } from '#lib/status/lumiplay.ts';
import { parseMonterosaPages } from '#lib/status/monterosa.ts';
import { parseMtnPowder } from '#lib/status/mtnpowder.ts';
import { parseOpenDataHub } from '#lib/status/opendatahub.ts';
import { parseSkiamadePages } from '#lib/status/skiamade.ts';
import { parseSkistarPages } from '#lib/status/skistar.ts';
import type { ResortStatus } from '#lib/status/intermaps.ts';
import type { RequestHandler } from './$types';

const STATUS_CACHE_MAX_AGE_SECONDS = 300;
const IDENTIFYING_REFERER_URL = 'https://openski.org/';

async function fetchText(url: string, fetchFn: typeof fetch): Promise<string> {
	const res = await fetchFn(url, {
		headers: {
			'User-Agent': APP_USER_AGENT,
			Referer: IDENTIFYING_REFERER_URL
		}
	});
	if (!res.ok) throw new Error(`the resort's feed answered ${res.status}`);
	return await res.text();
}

export const GET: RequestHandler = async ({ params, request, fetch }) => {
	const spec = FEEDS[params.resort];
	if (!spec) {
		const empty: ResortStatus = {
			at: new Date().toISOString(),
			lifts: [],
			pistes: []
		};
		return json(empty, {
			headers: { 'cache-control': `public, max-age=${STATUS_CACHE_MAX_AGE_SECONDS}` }
		});
	}

	const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
	const cacheKey = new Request(new URL(request.url).origin + `/api/status/${params.resort}`);
	const hit = await cache?.match(cacheKey);
	if (hit) return hit;

	let status: ResortStatus;
	try {
		if (spec.vendor === 'intermaps') {
			const text = await fetchText(spec.urls[0], fetch);
			status = parseIntermaps(JSON.parse(text));
		} else if (spec.vendor === 'opendatahub' && spec.bbox) {
			status = parseOpenDataHub(JSON.parse(await fetchText(spec.urls[0], fetch)), spec.bbox);
		} else if (spec.vendor === 'lumiplan') {
			status = parseLumiplan(await fetchText(spec.urls[0], fetch));
		} else if (spec.vendor === 'lumiplay') {
			const [staticText, dynamicText] = await Promise.all(
				spec.urls.map((url) => fetchText(url, fetch))
			);
			status = parseLumiplay(JSON.parse(staticText), JSON.parse(dynamicText));
		} else if (spec.vendor === 'monterosa') {
			status = parseMonterosaPages(
				await Promise.all(spec.urls.map((url) => fetchText(url, fetch)))
			);
		} else if (spec.vendor === 'mtnpowder') {
			status = parseMtnPowder(JSON.parse(await fetchText(spec.urls[0], fetch)));
		} else if (spec.vendor === 'aspen') {
			status = parseAspen(JSON.parse(await fetchText(spec.urls[0], fetch)));
		} else if (spec.vendor === 'skiamade') {
			status = parseSkiamadePages(await Promise.all(spec.urls.map((url) => fetchText(url, fetch))));
		} else if (spec.vendor === 'skistar') {
			status = parseSkistarPages(await Promise.all(spec.urls.map((url) => fetchText(url, fetch))));
		} else if (spec.vendor === 'infosnow') {
			const parts: ResortStatus[] = [];
			for (const url of spec.urls) {
				const text = await fetchText(url, fetch);
				parts.push(parseInfosnow(text));
			}
			status = {
				at: parts[0]?.at ?? new Date().toISOString(),
				lifts: parts.flatMap((p) => p.lifts),
				pistes: parts.flatMap((p) => p.pistes)
			};
		} else {
			let liftsDoc: unknown = null;
			let tracksDoc: unknown = null;
			for (const url of spec.urls) {
				const text = await fetchText(url, fetch);
				const parsed = JSON.parse(text);
				if (url.includes('get-lifts')) liftsDoc = parsed;
				else if (url.includes('get-tracks')) tracksDoc = parsed;
				else if (Array.isArray(parsed)) {
					const hasPisteTrackItem = parsed.some(
						(item: { level?: unknown; groomed?: unknown } | null) =>
							item?.level !== undefined || item?.groomed !== undefined
					);
					if (hasPisteTrackItem) tracksDoc = parsed;
					else liftsDoc = parsed;
				}
			}
			status = parseItinemap({ lifts: liftsDoc, tracks: tracksDoc });
		}
	} catch (err) {
		console.warn('status_feed_failed', { resort: params.resort, reason: (err as Error).message });
		error(502, 'Lift status is unavailable right now.');
	}

	status.source = VENDOR_CREDIT[spec.vendor];
	const response = json(status, {
		headers: { 'cache-control': `public, max-age=${STATUS_CACHE_MAX_AGE_SECONDS}` }
	});
	await cache?.put(cacheKey, response.clone());
	return response;
};
