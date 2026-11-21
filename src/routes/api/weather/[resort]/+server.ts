import { APP_USER_AGENT } from '#lib/identity.ts';
import { error, json } from '@sveltejs/kit';
import { OPEN_METEO_API_KEY } from '$app/env/private';
import {
	openMeteoCacheKey,
	openMeteoUrl,
	parseOpenMeteo,
	WEATHER_POINTS,
	type WeatherPoint,
	type Weather
} from '#lib/conditions/weather.ts';
import { findResort } from '#lib/server/catalog.ts';
import type { RequestHandler } from './$types';

const FRESH_SECONDS = 3600;
const STALE_SECONDS = 86400;
const RETRY_AFTER_FAILURE_SECONDS = 300;
const MIN_MAX_AGE_SECONDS = 60;
const CACHED_AT_HEADER = 'x-weather-cached-at';

interface MemoryEntry {
	weather: Weather;
	cachedAt: number;
}
const memoryCache = new Map<string, MemoryEntry>();
const MAX_MEMORY_ENTRIES = 64;

function remember(key: string, entry: MemoryEntry) {
	memoryCache.delete(key);
	memoryCache.set(key, entry);
	if (memoryCache.size > MAX_MEMORY_ENTRIES) memoryCache.delete(memoryCache.keys().next().value!);
}

function weatherPoints(resortId: string): WeatherPoint[] | null {
	if (WEATHER_POINTS[resortId]) return WEATHER_POINTS[resortId];
	const resort = findResort(resortId);
	if (!resort?.built) return null;
	const [lon, lat] = resort.center;
	const [low, high] = resort.ele;
	return [
		{ lat, lon, ele: low },
		{ lat, lon, ele: Math.round((low + high) / 2) },
		{ lat, lon, ele: high }
	];
}

const cacheControl = (maxAge: number) =>
	`public, max-age=${maxAge}, stale-while-revalidate=${STALE_SECONDS}`;

async function fetchForecast(points: WeatherPoint[], resort: string): Promise<Weather> {
	const res = await fetch(openMeteoUrl(points, OPEN_METEO_API_KEY || undefined), {
		headers: { accept: 'application/json', 'user-agent': APP_USER_AGENT }
	});
	if (!res.ok) throw new Error(`Open-Meteo answered ${res.status}`);
	return parseOpenMeteo(resort, points, await res.json());
}

export const GET: RequestHandler = async ({ params, url }) => {
	const points = weatherPoints(params.resort);
	if (!points) error(404, 'Unknown resort');

	const memoryKey = openMeteoCacheKey(points);
	const cacheKey = new Request(
		`${url.origin}/api/weather/${params.resort}?${new URL(memoryKey).searchParams}`
	);
	const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
	const hit = await cache?.match(cacheKey).catch(() => undefined);
	const now = Date.now();

	if (hit) {
		const age = now - Number(hit.headers.get(CACHED_AT_HEADER) || 0);
		if (age < FRESH_SECONDS * 1000) {
			const fresh = new Response(hit.body, hit);
			const remaining = Math.round((FRESH_SECONDS * 1000 - age) / 1000);
			fresh.headers.set(
				'cache-control',
				`public, max-age=${Math.max(MIN_MAX_AGE_SECONDS, remaining)}`
			);
			return fresh;
		}
	} else {
		const entry = memoryCache.get(memoryKey);
		if (entry && now - entry.cachedAt < FRESH_SECONDS * 1000) {
			return json(entry.weather, {
				headers: {
					'cache-control': cacheControl(FRESH_SECONDS),
					[CACHED_AT_HEADER]: String(entry.cachedAt)
				}
			});
		}
	}

	let weather: Weather;
	try {
		weather = await fetchForecast(points, params.resort);
	} catch (err) {
		console.warn('open_meteo_failed', { resort: params.resort, reason: (err as Error).message });
		const retryAt = now - (FRESH_SECONDS - RETRY_AFTER_FAILURE_SECONDS) * 1000;
		const headers = {
			'content-type': 'application/json; charset=utf-8',
			'cache-control': cacheControl(RETRY_AFTER_FAILURE_SECONDS),
			[CACHED_AT_HEADER]: String(retryAt)
		};
		if (hit) {
			const body = await hit.text();
			await cache
				?.put(
					cacheKey,
					new Response(body, {
						headers: { ...headers, 'cache-control': `public, max-age=${STALE_SECONDS}` }
					})
				)
				.catch(() => undefined);
			return new Response(body, { headers });
		}
		const entry = memoryCache.get(memoryKey);
		if (entry) {
			entry.cachedAt = retryAt;
			return json(entry.weather, { headers });
		}
		error(502, 'The weather forecast is unavailable right now.');
	}

	remember(memoryKey, { weather, cachedAt: now });
	await cache
		?.put(
			cacheKey,
			json(weather, {
				headers: {
					'cache-control': `public, max-age=${STALE_SECONDS}`,
					[CACHED_AT_HEADER]: String(now)
				}
			})
		)
		.catch((err: Error) => console.warn('weather_cache_put_failed', err.message));
	return json(weather, {
		headers: { 'cache-control': cacheControl(FRESH_SECONDS), [CACHED_AT_HEADER]: String(now) }
	});
};
