import { error, json } from '@sveltejs/kit';
import { and, asc, eq } from 'drizzle-orm';
import type { ContributedCamera } from '#lib/queues/types.ts';
import { queueRegion, webcam } from '#lib/server/db/schema.ts';
import { _database } from '../../webcams/+server.ts';
import type { RequestHandler } from './$types';

const SHORT_CACHE_MAX_AGE_SECONDS = 60;

export const GET: RequestHandler = async ({ params }) => {
	const isSafeResortSlug = /^[a-z0-9-]+$/.test(params.resort);
	if (!isSafeResortSlug) error(400, 'Not a resort');
	const db = _database();
	const rows = await db
		.select({ webcam, region: queueRegion })
		.from(queueRegion)
		.innerJoin(webcam, eq(queueRegion.webcamId, webcam.id))
		.where(and(eq(webcam.resort, params.resort), eq(queueRegion.status, 'confirmed')))
		.orderBy(asc(webcam.createdAt), asc(queueRegion.createdAt), asc(queueRegion.id));

	const cameras = new Map<string, ContributedCamera>();
	for (const { webcam: webcamRow, region: regionRow } of rows) {
		const contributedCameraId = `c-${webcamRow.id}`;
		let cam = cameras.get(contributedCameraId);
		if (!cam) {
			cam = {
				camera: contributedCameraId,
				name: webcamRow.name,
				pageUrl: webcamRow.pageUrl,
				source: webcamRow.source,
				regions: []
			};
			cameras.set(contributedCameraId, cam);
		}
		cam.regions.push({
			id: `${contributedCameraId}:${regionRow.id}`,
			liftOsm: regionRow.liftOsm,
			liftName: regionRow.liftName,
			label: regionRow.label,
			box: regionRow.box,
			upscale: regionRow.upscale
		});
	}
	return json([...cameras.values()], {
		headers: { 'cache-control': `public, max-age=${SHORT_CACHE_MAX_AGE_SECONDS}` }
	});
};
