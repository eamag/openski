import { error, json } from '@sveltejs/kit';
import { env } from 'cloudflare:workers';
import { and, asc, eq, inArray, ne, or } from 'drizzle-orm';
import type { CameraSource } from '#lib/queues/types.ts';
import { readJsonBody } from '#lib/server/body.ts';
import { findResort } from '#lib/server/catalog.ts';
import { getDb } from '#lib/server/db/index.ts';
import { enforce } from '#lib/server/rate-limit.ts';
import { queueRegion, webcam } from '#lib/server/db/schema.ts';
import type { ResolvedWebcam } from '#lib/webcams/types.ts';
import type { RequestHandler } from './$types';

type WebcamRow = typeof webcam.$inferSelect;
type RegionRow = typeof queueRegion.$inferSelect;
type Box = [number, number, number, number];

export const _WRITE_LIMIT = { requests: 20, windowMs: 60_000 };
const MAX_REGIONS_PER_CAMERA = 20;
const MAX_REGION_LABEL_LENGTH = 80;
const MAX_LIFT_NAME_LENGTH = 120;
const MAX_CAMERA_NAME_LENGTH = 120;
const MIN_UPSCALE_FACTOR = 1;
const MAX_UPSCALE_FACTOR = 4;
const RESORT_VICINITY_MARGIN_DEG = 0.2;
const MAX_RESOLVE_ATTEMPTS = 3;
const MIN_ELEVATION_METERS = -500;
const MAX_ELEVATION_METERS = 9000;
const MIN_DIRECTION_DEGREES = 0;
const MAX_DIRECTION_DEGREES = 360;
const MIN_FOV_DEGREES = 1;
const MAX_FOV_DEGREES = 360;

export interface RegionInput {
	liftOsm: string | null;
	liftName: string | null;
	label: string;
	box: Box;
	upscale: number;
}

export function _database() {
	const d1 = (env as Partial<Env>).DB;
	if (!d1) error(503, 'Accounts are not set up on this deployment.');
	return getDb(d1);
}

const isObject = (v: unknown): v is Record<string, unknown> =>
	typeof v === 'object' && v !== null && !Array.isArray(v);

function optionalInt(value: unknown, name: string, min: number, max: number): number | null {
	if (value === undefined || value === null) return null;
	if (typeof value !== 'number' || !Number.isFinite(value)) error(422, `${name} must be a number`);
	const n = Math.round(value);
	if (n < min || n > max) error(422, `${name} must be between ${min} and ${max}`);
	return n;
}

export function _pictureSize(source: CameraSource): { width: number; height: number } {
	return source.kind === 'panomax'
		? source.composite
		: { width: source.width, height: source.height };
}

export function _parseRegions(
	input: unknown,
	picture: { width: number; height: number }
): RegionInput[] {
	if (!Array.isArray(input)) error(422, 'regions must be a list');
	if (input.length > MAX_REGIONS_PER_CAMERA)
		error(422, `at most ${MAX_REGIONS_PER_CAMERA} regions per camera`);
	return input.map((raw, i): RegionInput => {
		const at = `regions[${i}]`;
		if (!isObject(raw)) error(422, `${at} must be an object`);

		const label = typeof raw.label === 'string' ? raw.label.trim() : '';
		if (!label || label.length > MAX_REGION_LABEL_LENGTH)
			error(422, `${at}.label must be 1 to ${MAX_REGION_LABEL_LENGTH} characters`);

		const liftOsm = raw.liftOsm ?? null;
		const liftName = raw.liftName ?? null;
		if (liftOsm !== null && (typeof liftOsm !== 'string' || !/^(way|relation)\/\d+$/.test(liftOsm)))
			error(422, `${at}.liftOsm must look like way/123`);
		if (
			liftName !== null &&
			(typeof liftName !== 'string' || !liftName.trim() || liftName.length > MAX_LIFT_NAME_LENGTH)
		)
			error(422, `${at}.liftName must be 1 to ${MAX_LIFT_NAME_LENGTH} characters`);
		if (liftOsm !== null && liftName === null) error(422, `${at}.liftName is needed with liftOsm`);

		const { box } = raw;
		if (!Array.isArray(box) || box.length !== 4 || !box.every((n) => Number.isInteger(n)))
			error(422, `${at}.box must be [x0, y0, x1, y1] in whole pixels`);
		const [x0, y0, x1, y1] = box as Box;
		if (!(x0 >= 0 && y0 >= 0 && x1 > x0 && y1 > y0 && x1 <= picture.width && y1 <= picture.height))
			error(422, `${at}.box must lie inside the ${picture.width}x${picture.height} picture`);

		const { upscale } = raw;
		if (
			typeof upscale !== 'number' ||
			!Number.isInteger(upscale) ||
			upscale < MIN_UPSCALE_FACTOR ||
			upscale > MAX_UPSCALE_FACTOR
		)
			error(
				422,
				`${at}.upscale must be a whole number from ${MIN_UPSCALE_FACTOR} to ${MAX_UPSCALE_FACTOR}`
			);

		return {
			liftOsm: liftOsm as string | null,
			liftName: liftName === null ? null : (liftName as string).trim(),
			label,
			box: [x0, y0, x1, y1],
			upscale
		};
	});
}

export function _regionRows(
	webcamId: string,
	userId: string,
	regions: RegionInput[],
	status: 'suggested' | 'confirmed' = 'confirmed'
) {
	const now = Date.now();
	return regions.map((r, i) => ({
		id: crypto.randomUUID(),
		webcamId,
		liftOsm: r.liftOsm,
		liftName: r.liftName,
		label: r.label,
		box: r.box,
		upscale: r.upscale,
		status,
		createdBy: userId,
		createdAt: new Date(now + i)
	}));
}

export function _sameRegion(
	a: RegionInput,
	b: {
		liftOsm: string | null;
		liftName: string | null;
		label: string;
		box: number[];
		upscale: number;
	}
): boolean {
	return (
		a.liftOsm === b.liftOsm &&
		a.liftName === b.liftName &&
		a.label === b.label &&
		a.upscale === b.upscale &&
		a.box.every((n, i) => n === b.box[i])
	);
}

export function _webcamJson(row: WebcamRow, regions: RegionRow[], userId?: string) {
	return {
		id: row.id,
		resort: row.resort,
		pageUrl: row.pageUrl,
		provider: row.provider,
		cameraId: row.cameraId,
		name: row.name,
		lat: row.lat,
		lon: row.lon,
		elevation: row.elevation,
		direction: row.direction,
		fov: row.fov,
		source: row.source,
		osmNode: row.osmNode,
		mine: userId !== undefined && row.createdBy === userId,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		regions: regions.map((r) => ({
			id: r.id,
			liftOsm: r.liftOsm,
			liftName: r.liftName,
			label: r.label,
			box: r.box,
			upscale: r.upscale,
			status: r.status
		}))
	};
}

export const GET: RequestHandler = async ({ url, locals }) => {
	const resort = url.searchParams.get('resort') ?? '';
	if (!/^[a-z0-9-]+$/.test(resort)) error(400, 'resort must be a resort slug');
	const db = _database();

	const rows = await db
		.select()
		.from(webcam)
		.where(eq(webcam.resort, resort))
		.orderBy(asc(webcam.createdAt), asc(webcam.id));
	const regions = await db
		.select({ region: queueRegion })
		.from(queueRegion)
		.innerJoin(webcam, eq(queueRegion.webcamId, webcam.id))
		.where(and(eq(webcam.resort, resort), ne(queueRegion.status, 'rejected')))
		.orderBy(asc(queueRegion.createdAt), asc(queueRegion.id));

	const byWebcam = Map.groupBy(
		regions.map((r) => r.region),
		(r) => r.webcamId
	);
	return json(
		{ webcams: rows.map((w) => _webcamJson(w, byWebcam.get(w.id) ?? [], locals.user?.id)) },
		{ headers: { 'cache-control': 'private, no-store' } }
	);
};

function sourceFrom(resolved: ResolvedWebcam): CameraSource {
	if (resolved.provider === 'panomax') {
		const layout = resolved.tileLayout;
		if (!layout) error(502, 'Panomax did not say how this panorama is tiled; try again later.');
		return {
			kind: 'panomax',
			panomaxId: Number.parseInt(resolved.cameraId, 10),
			resolution: 'full',
			tile: {
				width: layout.tileWidth,
				height: layout.tileHeight,
				rows: layout.rows,
				cols: layout.cols
			},
			composite: { width: layout.compositeWidth, height: layout.compositeHeight }
		};
	}
	if (!(resolved.width > 0 && resolved.height > 0))
		error(502, 'The webcam did not report its picture size.');
	return {
		kind: 'still',
		url: resolved.imageUrl,
		width: resolved.width,
		height: resolved.height,
		proxy: resolved.cors !== '*',
		rotates: false
	};
}

export const POST: RequestHandler = async ({ request, locals, fetch }) => {
	const user = locals.user;
	if (!user) error(401, 'Sign in with OpenStreetMap to save a webcam.');
	enforce(request, 'contrib-write', _WRITE_LIMIT.requests, _WRITE_LIMIT.windowMs);

	const body: unknown = await readJsonBody(request);
	if (!isObject(body)) error(400, 'The body must be a JSON object.');

	const { resort, pageUrl } = body;
	if (typeof resort !== 'string' || !/^[a-z0-9-]+$/.test(resort))
		error(422, 'resort must be a resort slug');
	if (typeof pageUrl !== 'string') error(422, 'pageUrl must be a web address');
	let page: URL;
	try {
		page = new URL(pageUrl);
	} catch {
		error(422, 'pageUrl must be a web address');
	}
	if (page.protocol !== 'https:') error(422, 'pageUrl must be an https address');

	const { lat, lon } = body;
	if (typeof lat !== 'number' || !(lat >= -90 && lat <= 90)) error(422, 'lat must be a latitude');
	if (typeof lon !== 'number' || !(lon >= -180 && lon <= 180))
		error(422, 'lon must be a longitude');

	const entry = findResort(resort);
	if (!entry) error(422, `Unknown resort "${resort}"`);
	const [west, south, east, north] = entry.bbox;
	if (
		lat < south - RESORT_VICINITY_MARGIN_DEG ||
		lat > north + RESORT_VICINITY_MARGIN_DEG ||
		lon < west - RESORT_VICINITY_MARGIN_DEG ||
		lon > east + RESORT_VICINITY_MARGIN_DEG
	)
		error(422, `The camera position is not near ${resort}`);

	let resolveRes: Response;
	for (let attempt = 1; ; attempt++) {
		resolveRes = await fetch(`/api/webcam-resolve?url=${encodeURIComponent(page.href)}`);
		if (resolveRes.status < 500 || attempt === MAX_RESOLVE_ATTEMPTS) break;
	}
	if (!resolveRes.ok) {
		const detail = ((await resolveRes.json().catch(() => null)) as { message?: string } | null)
			?.message;
		error(
			resolveRes.status === 400 || resolveRes.status === 422 ? 422 : 502,
			detail ?? 'The webcam page could not be read.'
		);
	}
	const resolved = (await resolveRes.json()) as ResolvedWebcam;
	const source = sourceFrom(resolved);

	const elevation = body.elevation === undefined ? resolved.elevation : body.elevation;
	const direction = body.direction === undefined ? resolved.viewingDirection : body.direction;
	const fov = body.fov === undefined ? resolved.fieldOfView : body.fov;
	const regions = _parseRegions(body.regions ?? [], _pictureSize(source));
	const requestedName =
		typeof body.name === 'string' ? body.name.trim().slice(0, MAX_CAMERA_NAME_LENGTH) : '';

	const pageUrlToSave =
		resolved.provider === 'other' ? page.href : resolved.canonicalPageUrl || page.href;
	const db = _database();
	const sameCamera =
		resolved.provider === 'other'
			? undefined
			: and(eq(webcam.provider, resolved.provider), eq(webcam.cameraId, resolved.cameraId));
	const [existing] = await db
		.select({ id: webcam.id })
		.from(webcam)
		.where(or(inArray(webcam.pageUrl, [...new Set([page.href, pageUrlToSave])]), sameCamera))
		.limit(1);
	if (existing)
		return json(
			{ message: 'This webcam page is already saved.', id: existing.id },
			{ status: 409 }
		);

	const id = crypto.randomUUID();
	const now = new Date();
	const row: WebcamRow = {
		id,
		resort,
		pageUrl: pageUrlToSave,
		provider: resolved.provider,
		cameraId: resolved.cameraId,
		name: requestedName || resolved.name.trim() || `${resolved.provider} ${resolved.cameraId}`,
		lat,
		lon,
		elevation: optionalInt(elevation, 'elevation', MIN_ELEVATION_METERS, MAX_ELEVATION_METERS),
		direction: optionalInt(direction, 'direction', MIN_DIRECTION_DEGREES, MAX_DIRECTION_DEGREES),
		fov: optionalInt(fov, 'fov', MIN_FOV_DEGREES, MAX_FOV_DEGREES),
		resolved,
		source,
		osmNode: null,
		createdBy: user.id,
		createdAt: now,
		updatedAt: now
	};
	const regionRows = _regionRows(id, user.id, regions);

	try {
		const insertWebcam = db.insert(webcam).values(row);
		if (regionRows.length)
			await db.batch([insertWebcam, db.insert(queueRegion).values(regionRows)]);
		else await insertWebcam;
	} catch (err) {
		const text = `${err instanceof Error ? err.message : err} ${(err as { cause?: Error })?.cause?.message ?? ''}`;
		if (/UNIQUE/i.test(text))
			return json({ message: 'This webcam page is already saved.' }, { status: 409 });
		throw err;
	}

	const saved = await db
		.select()
		.from(queueRegion)
		.where(eq(queueRegion.webcamId, id))
		.orderBy(asc(queueRegion.createdAt));
	return json(_webcamJson(row, saved, user.id), { status: 201 });
};
