import { error, json } from '@sveltejs/kit';
import { isValidSkiElement, validateTagChanges } from '#lib/osm/change.ts';
import { saveEdit } from '#lib/osm/save.ts';
import type { OsmEditRequest, OsmEditResponse } from '#lib/osm/types.ts';
import {
	isOsmSandbox,
	isOsmWritesEnabled,
	isUserAllowedToWrite,
	osmApi,
	osmProviderId,
	osmWeb
} from '#lib/server/auth.ts';
import type { RequestHandler } from './$types';
import { readJsonBody } from '#lib/server/body.ts';

const MAX_COMMENT_LENGTH = 500;
const MAX_ALSO_WAYS_COUNT = 50;
const MAX_TEST_NOTE_LENGTH = 255;

const isObject = (v: unknown): v is Record<string, unknown> =>
	typeof v === 'object' && v !== null && !Array.isArray(v);

function parseRequest(body: unknown): OsmEditRequest {
	if (!isObject(body)) error(400, 'The body must be a JSON object.');
	if (body.kind !== 'lift' && body.kind !== 'piste') error(422, 'kind must be lift or piste');
	if (typeof body.wayId !== 'number' || !Number.isSafeInteger(body.wayId) || body.wayId <= 0)
		error(422, 'wayId must be a positive integer');
	const el = body.element;
	if (!isObject(el) || (el.type !== 'way' && el.type !== 'node' && el.type !== 'relation'))
		error(422, 'element must be an OSM element');
	if (typeof el.id !== 'number' || typeof el.version !== 'number' || !isObject(el.tags))
		error(422, 'element needs an id, version and tags');
	if (el.type === 'way' && el.id !== body.wayId) error(422, 'element must be the way being edited');
	if (!Array.isArray(body.changes)) error(422, 'changes must be a list');
	const changes = body.changes.map((c: unknown) => {
		if (
			!isObject(c) ||
			typeof c.key !== 'string' ||
			(typeof c.value !== 'string' && c.value !== null)
		)
			error(422, 'each change needs a key and a string value (or null)');
		return { key: c.key as string, value: c.value as string | null, delete: c.delete === true };
	});
	if (!isObject(body.tags)) error(422, 'tags must be an object');
	const tags: Record<string, string> = {};
	for (const [k, v] of Object.entries(body.tags)) {
		if (typeof v !== 'string') error(422, `tag ${k} must be a string`);
		tags[k] = v;
	}
	if (
		typeof body.comment !== 'string' ||
		!body.comment.trim() ||
		body.comment.length > MAX_COMMENT_LENGTH
	)
		error(422, 'comment must be a short, non-empty string');
	if (typeof body.lat !== 'number' || !(body.lat >= -90 && body.lat <= 90))
		error(422, 'lat must be a latitude');
	if (typeof body.lon !== 'number' || !(body.lon >= -180 && body.lon <= 180))
		error(422, 'lon must be a longitude');

	const also: NonNullable<OsmEditRequest['also']> = [];
	if (body.also !== undefined) {
		if (!Array.isArray(body.also) || body.also.length > MAX_ALSO_WAYS_COUNT)
			error(422, 'also must be a list of at most 50 ways');
		for (const a of body.also as unknown[]) {
			if (
				!isObject(a) ||
				typeof a.wayId !== 'number' ||
				!Number.isSafeInteger(a.wayId) ||
				a.wayId <= 0
			)
				error(422, 'each also entry needs a positive integer wayId');
			const kind = a.kind ?? body.kind;
			if (kind !== 'lift' && kind !== 'piste') error(422, 'kind must be lift or piste');
			const e = a.element;
			if (
				!isObject(e) ||
				e.type !== 'way' ||
				e.id !== a.wayId ||
				typeof e.version !== 'number' ||
				!isObject(e.tags)
			)
				error(422, 'each also entry needs the way element as last seen');
			if (!Array.isArray(a.changes)) error(422, 'each also entry needs changes');
			const alsoChanges = (a.changes as unknown[]).map((c) => {
				if (
					!isObject(c) ||
					typeof c.key !== 'string' ||
					(typeof c.value !== 'string' && c.value !== null)
				)
					error(422, 'each change in also needs a key and a string value (or null)');
				return { key: c.key as string, value: c.value as string | null, delete: c.delete === true };
			});
			also.push({
				wayId: a.wayId as number,
				kind,
				element: {
					type: 'way',
					id: e.id as number,
					version: e.version as number,
					tags: e.tags as Record<string, string>
				},
				changes: alsoChanges
			});
		}
	}

	const fillMissingTags = body.fillMissingTags === true;
	const wayIds = [body.wayId, ...also.map((a) => a.wayId)];
	if (new Set(wayIds).size !== wayIds.length) error(422, 'each way may appear only once');
	if (also.length && !fillMissingTags) error(422, 'only survey answers may change several ways');

	let surveyWayIds: number[] | undefined;
	if (fillMissingTags) {
		const ids = body.surveyWayIds;
		if (
			!Array.isArray(ids) ||
			!ids.every((id) => typeof id === 'number' && Number.isSafeInteger(id) && id > 0)
		)
			error(422, 'Update the app: survey answers need the list of reviewed ways.');
		surveyWayIds = ids as number[];
		const reviewed = new Set(surveyWayIds);
		if (
			reviewed.size !== surveyWayIds.length ||
			reviewed.size !== wayIds.length ||
			!wayIds.every((id) => reviewed.has(id))
		)
			error(422, 'The answers must change exactly the ways you reviewed.');
	} else if (body.surveyWayIds !== undefined) {
		error(422, 'surveyWayIds is only for survey answers');
	}

	const req: OsmEditRequest = {
		kind: body.kind,
		wayId: body.wayId,
		element: {
			type: el.type as 'node' | 'way' | 'relation',
			id: el.id as number,
			version: el.version as number,
			tags: el.tags as Record<string, string>
		},
		changes,
		tags,
		fillMissingTags,
		comment: body.comment.trim(),
		source: typeof body.source === 'string' ? body.source : undefined,
		lat: body.lat,
		lon: body.lon,
		surveyWayIds,
		also
	};

	if (!isValidSkiElement(req.element, req.kind)) {
		error(422, `Target element ${req.element.id} is not a validated ski ${req.kind}`);
	}
	const tagErrors = validateTagChanges(req.changes, req.kind, req.element.tags);
	if (tagErrors.length > 0) {
		error(422, `Invalid tag change: ${tagErrors[0].error}`);
	}

	for (const a of also) {
		const kind = a.kind ?? req.kind;
		if (!isValidSkiElement(a.element, kind)) {
			error(422, `Multi-way element ${a.element.id} is not a validated ski ${kind}`);
		}
		const alsoTagErrors = validateTagChanges(a.changes, kind, a.element.tags);
		if (alsoTagErrors.length > 0) {
			error(422, `Invalid tag change on way ${a.wayId}: ${alsoTagErrors[0].error}`);
		}
	}

	return req;
}

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!isOsmWritesEnabled()) {
		error(403, 'Saving to OpenStreetMap is turned off on this deployment.');
	}

	if (!locals.user || !locals.auth) {
		error(401, 'Sign in with OpenStreetMap to save an edit.');
	}

	const accounts = await locals.auth.api.listUserAccounts({ headers: request.headers });
	const osmAccount = accounts.find((a) => a.providerId === osmProviderId);
	if (!osmAccount) {
		error(401, 'Sign in with OpenStreetMap again to save.');
	}

	if (!isUserAllowedToWrite(locals.user, osmAccount.accountId)) {
		error(403, 'Saving to OpenStreetMap is open to invited mappers only for now.');
	}

	if (!osmAccount.scopes?.includes('write_api')) {
		error(403, 'You signed in without edit permission. Grant edit permission to save.');
	}

	const tokens = await locals.auth.api.getAccessToken({
		body: { accountId: osmAccount.id },
		headers: request.headers
	});
	if (!tokens.accessToken) {
		error(401, 'Sign in with OpenStreetMap again to save.');
	}

	const input = parseRequest(await readJsonBody(request));
	const config = { base: osmApi, token: tokens.accessToken };
	const metadata = { comment: input.comment, source: input.source };

	const result = await saveEdit(config, {
		seen: input.element,
		kind: input.kind,
		changes: input.changes,
		also: input.also?.map((a) => ({
			seen: a.element,
			kind: a.kind ?? input.kind,
			changes: a.changes
		})),
		fillMissingTags: input.fillMissingTags,
		...metadata
	});

	if ('ok' in result) {
		const response: OsmEditResponse = {
			ok: true,
			changesetId: result.changesetId,
			url: `${osmWeb}/changeset/${result.changesetId}`,
			server: osmWeb,
			action: 'modify'
		};
		return json(response);
	}

	if (result.type === 'unchanged') {
		const response: OsmEditResponse = {
			unchanged: true,
			message: input.fillMissingTags
				? 'OpenStreetMap already has values for these tags.'
				: 'OpenStreetMap already has the requested tags.'
		};
		return json(response);
	}

	if (isOsmSandbox && result.type === 'deleted') {
		const wayList = [input.wayId, ...(input.also ?? []).map((a) => a.wayId)]
			.map((id) => `way/${id}`)
			.join(', ');
		const fallbackResult = await saveEdit(config, {
			creates: [
				{
					lat: input.lat,
					lon: input.lon,
					tags: {
						...input.tags,
						note: `openski.org test of ${wayList} on openstreetmap.org`.slice(
							0,
							MAX_TEST_NOTE_LENGTH
						)
					}
				}
			],
			...metadata
		});
		if ('ok' in fallbackResult) {
			const response: OsmEditResponse = {
				ok: true,
				changesetId: fallbackResult.changesetId,
				url: `${osmWeb}/changeset/${fallbackResult.changesetId}`,
				server: osmWeb,
				action: 'create'
			};
			return json(response);
		}
	}

	const response: OsmEditResponse = {
		error: 'conflict',
		message: result.message,
		conflict: result
	};
	return json(response, { status: 409 });
};
