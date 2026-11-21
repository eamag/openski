import { error, json } from '@sveltejs/kit';
import { env } from 'cloudflare:workers';
import { lt } from 'drizzle-orm';
import type { ResortData } from '#lib/resort/types.ts';
import { getDb } from '#lib/server/db/index.ts';
import { snapshot } from '#lib/server/db/schema.ts';
import { readJsonBody } from '#lib/server/body.ts';
import { enforce } from '#lib/server/rate-limit.ts';
import { parseSnapshot, renderSnapshot, SNAPSHOT_KEEP_MS } from '#lib/server/snapshot.ts';
import type { RequestHandler } from './$types';

const MAX_SNAPSHOT_BYTES = 400_000;
const SNAPSHOT_ID_LENGTH = 10;
const UNAMBIGUOUS_ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const RATE_LIMIT_MAX_REQUESTS = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

function generateSnapshotId(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(SNAPSHOT_ID_LENGTH));
	return Array.from(bytes, (b) => UNAMBIGUOUS_ALPHABET[b % UNAMBIGUOUS_ALPHABET.length]).join('');
}

export const POST: RequestHandler = async ({ request, url }) => {
	enforce(request, 'snapshot-create', RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS);

	const body = await readJsonBody(request, MAX_SNAPSHOT_BYTES);
	const resortId = (body as { resort?: unknown })?.resort;
	if (typeof resortId !== 'string' || !/^[a-z0-9-]{1,80}$/.test(resortId))
		error(422, 'Unknown resort.');

	const bindings = env as Partial<Env>;
	if (!bindings.DB || !bindings.ASSETS) error(503, 'Snapshots are not available here.');
	const res = await bindings.ASSETS.fetch(new Request(`${url.origin}/data/${resortId}.json`));
	if (!res.ok) error(422, 'Unknown resort.');
	const data = (await res.json()) as ResortData;

	const isLocalHost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
	const origin = isLocalHost ? url.origin : `https://${url.host}`;
	let markdown: string;
	try {
		markdown = renderSnapshot(data, parseSnapshot(body, data), origin);
	} catch (err) {
		error(422, `The snapshot is not valid (${(err as Error).message}).`);
	}

	const db = getDb(bindings.DB);
	const id = generateSnapshotId();
	await db.insert(snapshot).values({ id, resort: resortId, markdown });
	console.info('snapshot_created', { resort: resortId });
	await db.delete(snapshot).where(lt(snapshot.createdAt, new Date(Date.now() - SNAPSHOT_KEEP_MS)));
	return json({ id, url: `${origin}/s/${id}` });
};
