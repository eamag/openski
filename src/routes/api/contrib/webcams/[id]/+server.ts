import { error, json } from '@sveltejs/kit';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { queueRegion, webcam } from '#lib/server/db/schema.ts';
import { readJsonBody } from '#lib/server/body.ts';
import { enforce } from '#lib/server/rate-limit.ts';
import {
	_database,
	_parseRegions,
	_pictureSize,
	_regionRows,
	_sameRegion,
	_webcamJson,
	_WRITE_LIMIT
} from '../+server.ts';
import type { RequestHandler } from './$types';

async function ownWebcam(id: string, user: { id: string } | undefined) {
	if (!user) error(401, 'Sign in with OpenStreetMap first.');
	const db = _database();
	const [row] = await db.select().from(webcam).where(eq(webcam.id, id));
	if (!row) error(404, 'No such webcam.');
	const isOwner = row.createdBy === user.id;
	if (!isOwner) error(403, 'Only the person who saved this webcam can change it.');
	return { db, row, user };
}

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	const { db, row, user } = await ownWebcam(params.id, locals.user);
	enforce(request, 'contrib-write', _WRITE_LIMIT.requests, _WRITE_LIMIT.windowMs);

	const body: unknown = await readJsonBody(request);
	if (typeof body !== 'object' || body === null) error(400, 'The body must be a JSON object.');
	const regions = _parseRegions((body as { regions?: unknown }).regions, _pictureSize(row.source));

	const existing = await db.select().from(queueRegion).where(eq(queueRegion.webcamId, row.id));
	const confirmed = existing.filter((r) => r.status === 'confirmed');
	const confirmedById = new Map(confirmed.map((r) => [r.id, r]));
	const unmatched = new Set(confirmedById.keys());
	const newRegions: typeof regions = [];

	for (const region of regions) {
		const match = [...unmatched].find((id) => _sameRegion(region, confirmedById.get(id)!));
		if (match) unmatched.delete(match);
		else newRegions.push(region);
	}
	const unconfirmedIds = existing.filter((r) => r.status !== 'confirmed').map((r) => r.id);

	const updated = { ...row, updatedAt: new Date() };
	const writes: Array<Parameters<typeof db.batch>[0][number]> = [];
	if (unconfirmedIds.length)
		writes.push(db.delete(queueRegion).where(inArray(queueRegion.id, unconfirmedIds)));
	writes.push(db.update(webcam).set({ updatedAt: updated.updatedAt }).where(eq(webcam.id, row.id)));
	const pending = _regionRows(row.id, user.id, newRegions, 'suggested');
	if (pending.length) writes.push(db.insert(queueRegion).values(pending));
	await db.batch(writes as unknown as Parameters<typeof db.batch>[0]);

	console.info('webcam_regions_saved', {
		id: row.id,
		preserved: confirmed.length,
		pending: pending.length
	});
	const saved = await db
		.select()
		.from(queueRegion)
		.where(eq(queueRegion.webcamId, row.id))
		.orderBy(asc(queueRegion.createdAt));
	return json(_webcamJson(updated, saved, user.id));
};

export const POST: RequestHandler = async ({ params, request, locals }) => {
	const { db, row, user } = await ownWebcam(params.id, locals.user);
	enforce(request, 'contrib-write', _WRITE_LIMIT.requests, _WRITE_LIMIT.windowMs);

	await db
		.update(queueRegion)
		.set({ status: 'confirmed' })
		.where(and(eq(queueRegion.webcamId, row.id), eq(queueRegion.status, 'suggested')));
	console.info('webcam_regions_published', { id: row.id });

	const saved = await db
		.select()
		.from(queueRegion)
		.where(eq(queueRegion.webcamId, row.id))
		.orderBy(asc(queueRegion.createdAt));
	return json(_webcamJson(row, saved, user.id));
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const { db, row } = await ownWebcam(params.id, locals.user);
	await db.batch([
		db.delete(queueRegion).where(eq(queueRegion.webcamId, row.id)),
		db.delete(webcam).where(eq(webcam.id, row.id))
	]);
	return new Response(null, { status: 204 });
};
