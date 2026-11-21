import { error } from '@sveltejs/kit';
import { env } from 'cloudflare:workers';
import { and, eq } from 'drizzle-orm';
import type { CameraSource, QueueCamera } from '#lib/queues/types.ts';
import { getDb } from '#lib/server/db/index.ts';
import { enforce } from '#lib/server/rate-limit.ts';
import { queueRegion, webcam } from '#lib/server/db/schema.ts';
import { isAllowedUpstream, safeFetch } from '#lib/server/upstream.ts';
import type { RequestHandler } from './$types';

const queueCamerasByFile = import.meta.glob<QueueCamera[]>('/static/data/*-queues.json', {
	eager: true,
	import: 'default'
});

const CONTRIBUTED_CAMERA_PREFIX = 'c-';
const EDGE_CACHE_MAX_AGE_SECONDS = 120;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const RATE_LIMIT_MAX_REQUESTS = 120;
const RATE_LIMIT_WINDOW_MS = 60_000;
const UPSTREAM_FETCH_TIMEOUT_MS = 10_000;

async function confirmedContributedSource(
	resort: string,
	webcamId: string
): Promise<CameraSource | undefined> {
	const d1 = (env as Partial<Env>).DB;
	if (!d1) return undefined;
	const [confirmedWebcam] = await getDb(d1)
		.select({ source: webcam.source })
		.from(webcam)
		.innerJoin(queueRegion, eq(queueRegion.webcamId, webcam.id))
		.where(
			and(eq(webcam.id, webcamId), eq(webcam.resort, resort), eq(queueRegion.status, 'confirmed'))
		)
		.limit(1);
	return confirmedWebcam?.source;
}

export const GET: RequestHandler = async ({ params, request }) => {
	enforce(request, 'webcam-image', RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS);

	if (!/^[a-z0-9-]{1,80}$/.test(params.resort) || !/^[\w-]{1,80}$/.test(params.camera)) {
		error(404, 'Unknown webcam');
	}
	const isContributed = params.camera.startsWith(CONTRIBUTED_CAMERA_PREFIX);
	const source = isContributed
		? await confirmedContributedSource(
				params.resort,
				params.camera.slice(CONTRIBUTED_CAMERA_PREFIX.length)
			)
		: queueCamerasByFile[`/static/data/${params.resort}-queues.json`]?.find(
				(queueCamera) => queueCamera.camera === params.camera
			)?.source;

	const isProxyableStillImage = source?.kind === 'still' && source.proxy;
	if (!source || !isProxyableStillImage) error(404, 'Unknown webcam');

	let pictureUrl: URL;
	try {
		pictureUrl = new URL(source.url);
	} catch {
		error(502, 'The webcam is not answering.');
	}
	if (!isAllowedUpstream(pictureUrl)) {
		console.warn('webcam_image_host_blocked', { host: pictureUrl.hostname });
		error(502, 'The webcam is not answering.');
	}

	const edgeCache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
	const cacheKey = new Request(
		new URL(request.url).origin + `/api/webcam/${params.resort}/${params.camera}`
	);
	const cachedResponse = await edgeCache?.match(cacheKey);
	if (cachedResponse) return cachedResponse;

	let upstreamResponse: Response;
	try {
		upstreamResponse = await safeFetch(
			pictureUrl.href,
			{ headers: { accept: 'image/*' } },
			{ maxBytes: MAX_IMAGE_BYTES, timeoutMs: UPSTREAM_FETCH_TIMEOUT_MS, imageOnly: true }
		);
	} catch (upstreamError) {
		console.warn('webcam_image_failed', {
			camera: params.camera,
			reason: (upstreamError as Error).message
		});
		error(502, 'The webcam is not answering.');
	}

	const responseHeaders = new Headers({
		'content-type': upstreamResponse.headers.get('content-type') as string,
		'cache-control': `public, max-age=${EDGE_CACHE_MAX_AGE_SECONDS}`
	});
	const lastModified = upstreamResponse.headers.get('last-modified');
	if (lastModified) responseHeaders.set('last-modified', lastModified);
	const response = new Response(upstreamResponse.body, { headers: responseHeaders });
	await edgeCache?.put(cacheKey, response.clone());
	return response;
};
