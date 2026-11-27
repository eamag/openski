/// <reference lib="webworker" />
import { version } from '$app/env';
import { assets, immutable, prerendered } from '$app/manifest';
import {
	isOpenFreeMapUrl,
	MAX_OFM_BYTES,
	MAX_OFM_TILES,
	PARALLEL_DOWNLOADS,
	tileKey,
	toOfflineTileProxyUrl
} from './lib/offline-config.ts';

const sw = self as unknown as ServiceWorkerGlobalScope;

const APP_CACHE = `app-${version}`;
const TILES_CACHE = 'tiles-v1';
const API_CACHE = 'api-v1';
const MODELS_CACHE = 'models-v1';
const DATA_CACHE = 'data-v1';
const MAX_CACHED_TILES = 15000;
const FROM_CACHE_HEADER = 'x-from-cache';

const isDetectorAsset = (path: string) => path.includes('models/') || path.includes('ort-wasm');
const isResortDataFile = (path: string) =>
	/^\/?data\//.test(path) && !path.endsWith('data/resorts.json');
const isLinkPreviewImage = (path: string) => /^\/?og(?:-apartment)?\.png$/.test(path);
const isSourceMap = (path: string) => path.endsWith('.map');
// For crawlers only; the sitemap alone is ~700 KB and would slow the install.
const isCrawlerFile = (path: string) => /^\/?(sitemap\.xml|robots\.txt|llms\.txt)$/.test(path);

const RESERVED_ROUTES = new Set([
	'',
	'resorts',
	'track',
	'route',
	'progress',
	'now',
	'login',
	'logout',
	'about',
	'edit',
	'questions',
	's',
	'api',
	'dev',
	'contribute'
]);

const SHELL = [
	...immutable.map((f) => f.path),
	...prerendered.map((f) => f.path),
	...assets.map((f) => f.path)
]
	.filter(
		(p) =>
			!isDetectorAsset(p) &&
			!isResortDataFile(p) &&
			!isLinkPreviewImage(p) &&
			!isSourceMap(p) &&
			!isCrawlerFile(p)
	)
	.map((p) => (p.startsWith('/') ? p : `/${p}`));

sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(APP_CACHE)
			.then((cache) => cache.addAll(SHELL))
			.then(() => sw.skipWaiting())
	);
});

async function cacheResortForClient(pathname: string): Promise<void> {
	const match = pathname.match(/^\/([a-z0-9-]+)(?:\/|$)/);
	if (match && !RESERVED_ROUTES.has(match[1])) {
		// The page fetched these before the worker took control on a first visit; keep them offline.
		const cache = await caches.open(DATA_CACHE);
		for (const dataUrl of [`/data/${match[1]}.json`, `/data/${match[1]}-terrain.json`]) {
			if (await cache.match(dataUrl, { ignoreVary: true })) continue;
			const res = await fetch(dataUrl).catch(() => null);
			if (res?.ok) await cache.put(dataUrl, res);
		}
	}
}

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) {
				if (key.startsWith('app-') && key !== APP_CACHE) await caches.delete(key);
			}
			await sw.clients.claim();
			try {
				const clients = await sw.clients.matchAll({ type: 'window' });
				for (const client of clients) {
					await cacheResortForClient(new URL(client.url).pathname);
				}
			} catch (err) {
				void err;
			}
		})()
	);
});

async function cacheFirst(event: FetchEvent, cacheName: string, key: string): Promise<Response> {
	const cache = await caches.open(cacheName);
	const hit =
		(await cache.match(key, { ignoreVary: true })) ??
		(await cache.match(event.request, { ignoreVary: true }));
	if (hit) return hit;
	const res = await fetch(event.request);
	if (res.ok) event.waitUntil(cache.put(key, res.clone()).catch(() => {}));
	return res;
}

async function networkFirst(cacheName: string, request: Request): Promise<Response> {
	const cache = await caches.open(cacheName);
	try {
		const res = await fetch(request);
		if (res.ok) void cache.put(request, res.clone());
		return res;
	} catch (err) {
		const hit =
			(await cache.match(request, { ignoreVary: true })) ??
			(await cache.match(request.url, { ignoreVary: true })) ??
			(await cache.match(new URL(request.url).pathname, { ignoreVary: true }));
		if (hit) {
			const headers = new Headers(hit.headers);
			headers.set(FROM_CACHE_HEADER, '1');
			return new Response(hit.body, { status: hit.status, statusText: hit.statusText, headers });
		}
		throw err;
	}
}

sw.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;
	const url = new URL(request.url);

	if (url.origin === sw.location.origin) {
		const isUserSessionOrContributionApi = /^\/api\/(auth|me|contrib)(\/|$)/.test(url.pathname);
		if (isUserSessionOrContributionApi) return;
		const isDynamicDataApi = url.pathname.startsWith('/api/');
		if (isDynamicDataApi) {
			event.respondWith(networkFirst(API_CACHE, request));
			return;
		}
		if (isDetectorAsset(url.pathname)) {
			event.respondWith(cacheFirst(event, MODELS_CACHE, url.pathname));
			return;
		}
		if (url.pathname.includes('/_app/immutable/')) {
			event.respondWith(cacheFirst(event, APP_CACHE, url.pathname));
			return;
		}
		if (isResortDataFile(url.pathname)) {
			event.respondWith(networkFirst(DATA_CACHE, request));
			return;
		}
		if (SHELL.includes(url.pathname)) {
			event.respondWith(networkFirst(APP_CACHE, request));
			return;
		}
		if (request.mode === 'navigate') {
			event.waitUntil(cacheResortForClient(url.pathname));
			event.respondWith(
				fetch(request).catch(async () => {
					const cache = await caches.open(APP_CACHE);
					return (
						(await cache.match(url.pathname, { ignoreVary: true })) ??
						(await cache.match('/', { ignoreVary: true })) ??
						(await cache.match('/index.html', { ignoreVary: true })) ??
						Response.error()
					);
				})
			);
			return;
		}
		return;
	}

	const key = tileKey(url);
	if (key) {
		event.respondWith(cacheFirst(event, TILES_CACHE, key));
		return;
	}
	if (url.href === 'https://tiles.openfreemap.org/planet') {
		event.respondWith(networkFirst(TILES_CACHE, request));
	}
});

interface ActiveDownloadJob {
	id: string;
	done: number;
	total: number;
	failed: number;
}
const activeDownloads = new Map<string, ActiveDownloadJob>();

sw.addEventListener('message', (event) => {
	const data = event.data as { type?: string; urls?: string[]; id?: string } | undefined;
	if (data?.type === 'forget-resort' && data.id) {
		event.waitUntil(
			(async () => {
				for (const name of [DATA_CACHE, API_CACHE]) {
					const cache = await caches.open(name);
					for (const request of await cache.keys()) {
						const path = new URL(request.url).pathname;
						if (path.startsWith(`/data/${data.id}`) || path === `/api/weather/${data.id}`)
							await cache.delete(request);
					}
				}
			})()
		);
		return;
	}
	if (data?.type !== 'download-tiles' || !data.urls || !data.id) return;
	const urls = data.urls;
	const resortId = data.id;
	const source = event.source as Client | null;

	const existingJob = activeDownloads.get(resortId);
	if (existingJob) {
		source?.postMessage({
			type: 'download-progress',
			id: resortId,
			done: existingJob.done,
			total: existingJob.total,
			failed: existingJob.failed
		});
		return;
	}

	const job: ActiveDownloadJob = {
		id: resortId,
		done: 0,
		total: urls.length,
		failed: 0
	};
	activeDownloads.set(resortId, job);

	const broadcastProgress = async () => {
		const message = {
			type: 'download-progress',
			id: resortId,
			done: job.done,
			total: job.total,
			failed: job.failed
		};
		source?.postMessage(message);
		const clients = await sw.clients.matchAll({ type: 'window' });
		for (const client of clients) {
			if (client.id !== source?.id) client.postMessage(message);
		}
	};

	event.waitUntil(
		(async () => {
			const tilesCache = await caches.open(TILES_CACHE);
			const appCache = await caches.open(APP_CACHE);
			const dataCache = await caches.open(DATA_CACHE);
			const apiCache = await caches.open(API_CACHE);

			let next = 0;
			let ofmTilesDownloaded = 0;
			let ofmBytesDownloaded = 0;

			const worker = async () => {
				while (next < urls.length) {
					const href = urls[next++];
					const targetUrl = new URL(href, sw.location.origin);
					const isOfm = isOpenFreeMapUrl(targetUrl);
					const isOriginLocal = targetUrl.origin === sw.location.origin;
					const isApiEndpoint = isOriginLocal && targetUrl.pathname.startsWith('/api/');
					const targetCache = !isOriginLocal
						? tilesCache
						: isApiEndpoint
							? apiCache
							: isResortDataFile(targetUrl.pathname)
								? dataCache
								: appCache;
					const key = isOriginLocal ? targetUrl.pathname : (tileKey(targetUrl) ?? href);

					try {
						const existing = await targetCache.match(key, { ignoreVary: true });
						if (!existing) {
							if (
								isOfm &&
								(ofmTilesDownloaded >= MAX_OFM_TILES || ofmBytesDownloaded >= MAX_OFM_BYTES)
							) {
								job.failed++;
							} else {
								const fetchUrl = isOfm ? toOfflineTileProxyUrl(href) : href;
								const res = await fetch(fetchUrl);
								if (res.ok) {
									const blob = await res.blob();
									if (isOfm) {
										ofmTilesDownloaded++;
										ofmBytesDownloaded += blob.size;
									}
									const cachedRes = new Response(blob, {
										status: res.status,
										statusText: res.statusText,
										headers: res.headers
									});
									await targetCache.put(key, cachedRes);
								} else if (res.status !== 404 && res.status !== 204) {
									job.failed++;
								}
							}
						}
					} catch {
						job.failed++;
					}

					job.done++;
					if (job.done % 10 === 0 || job.done === urls.length) {
						await broadcastProgress();
					}
				}
			};

			try {
				await Promise.all(Array.from({ length: PARALLEL_DOWNLOADS }, worker));
				const keys = await tilesCache.keys();
				for (const tileCacheKey of keys.slice(0, Math.max(0, keys.length - MAX_CACHED_TILES))) {
					await tilesCache.delete(tileCacheKey);
				}
			} finally {
				activeDownloads.delete(resortId);
				await broadcastProgress();
			}
		})()
	);
});
