import { error } from '@sveltejs/kit';
import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { getDb } from '#lib/server/db/index.ts';
import { snapshot } from '#lib/server/db/schema.ts';
import { SNAPSHOT_KEEP_MS } from '#lib/server/snapshot.ts';
import type { RequestHandler } from './$types';

const MAX_CACHE_SECONDS = 86_400;
const MILLISECONDS_PER_SECOND = 1000;

export const GET: RequestHandler = async ({ params, platform }) => {
	if (!/^[A-Za-z0-9]{6,20}$/.test(params.id)) error(404, 'No such snapshot.');
	const d1 = (env as Partial<Env>).DB;
	if (!d1) error(503, 'Snapshots are not available here.');
	const db = getDb(d1);
	const [snapshotRow] = await db.select().from(snapshot).where(eq(snapshot.id, params.id)).limit(1);
	if (!snapshotRow) error(404, 'This snapshot has expired or never existed.');

	const ageMs = Date.now() - snapshotRow.createdAt.getTime();
	const isExpired = !Number.isFinite(ageMs) || ageMs >= SNAPSHOT_KEEP_MS;
	if (isExpired) {
		platform?.ctx.waitUntil(
			db
				.delete(snapshot)
				.where(eq(snapshot.id, params.id))
				.catch(() => undefined)
		);
		error(404, 'This snapshot has expired or never existed.');
	}

	const remainingTtlSeconds = Math.max(
		0,
		Math.floor((SNAPSHOT_KEEP_MS - ageMs) / MILLISECONDS_PER_SECOND)
	);
	const cacheMaxAgeSeconds = Math.min(MAX_CACHE_SECONDS, remainingTtlSeconds);

	return new Response(snapshotRow.markdown, {
		headers: {
			'content-type': 'text/plain; charset=utf-8',
			'cache-control': `public, max-age=${cacheMaxAgeSeconds}`,
			'x-robots-tag': 'noindex'
		}
	});
};
