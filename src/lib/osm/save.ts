import { closeChangeset, fetchElement, openChangeset, OsmApiError, uploadChange } from './api.ts';
import {
	applyTagChanges,
	changesetTags,
	hasTagOrEquivalent,
	isValidSkiElement,
	osmChangeXml,
	pisteKeyFor,
	tagDiff,
	validateTagChanges
} from './change.ts';
import type {
	Conflict,
	DiffElementResult,
	EditPlan,
	KeyConflict,
	OsmApiConfig,
	OsmElement,
	SaveResult
} from './types.ts';

const HTTP_CONFLICT_STATUS = 409;
const DELETED_MESSAGE = 'This way has been deleted on OpenStreetMap since the map was built.';

export function detectConflict(
	seen: OsmElement,
	live: OsmElement,
	changes: EditPlan['changes'] = []
): Conflict | null {
	if (live.visible === false) {
		return {
			type: 'deleted',
			message: DELETED_MESSAGE,
			elementId: seen.id,
			elementType: seen.type
		};
	}

	if (live.version === seen.version) {
		return null;
	}

	const conflicts: KeyConflict[] = [];

	for (const change of changes) {
		const key = change.key;
		const userValue =
			change.delete || change.value === undefined || change.value === null ? null : change.value;
		const seenValue = seen.tags?.[key] ?? null;
		const liveValue = live.tags?.[key] ?? null;

		if (seenValue !== liveValue) {
			if (liveValue === userValue) {
				continue;
			}
			conflicts.push({
				key,
				userValue,
				upstreamValue: liveValue
			});
		}
	}

	if (conflicts.length > 0) {
		return {
			type: 'modified',
			message: 'Someone changed the same tags on OpenStreetMap after you opened this way.',
			elementId: seen.id,
			elementType: seen.type,
			keys: conflicts
		};
	}

	return null;
}

export async function saveEdit(config: OsmApiConfig, plan: EditPlan): Promise<SaveResult> {
	const { changes = [], creates = [], also = [], fillMissingTags, comment, source, locale } = plan;
	const modified: OsmElement[] = [];

	const targets = [...(plan.seen ? [{ seen: plan.seen, kind: plan.kind, changes }] : []), ...also];
	for (const { seen, kind, changes } of targets) {
		let live: OsmElement;
		try {
			live = await fetchElement(config, seen.type, seen.id);
		} catch (err) {
			if (err instanceof OsmApiError && (err.status === 404 || err.status === 410)) {
				return {
					type: 'deleted',
					message: DELETED_MESSAGE,
					elementId: seen.id,
					elementType: seen.type
				};
			}
			throw err;
		}

		// Survey answers only add what is missing; on a piste that is also a road they go in piste:*.
		const pending = fillMissingTags
			? changes
					.map((c) => (kind === 'piste' ? { ...c, key: pisteKeyFor(c.key, live.tags) } : c))
					.filter(({ key }) => !hasTagOrEquivalent(live.tags, key))
			: changes;
		const conflict = detectConflict(seen, live, pending);
		if (conflict) {
			return conflict;
		}

		// The request was checked against the client's copy; check the way as it is now.
		if (kind && live.visible !== false) {
			const problem = !isValidSkiElement(live, kind)
				? `OpenStreetMap no longer tags ${seen.type} ${seen.id} as a ski ${kind}.`
				: validateTagChanges(pending, kind, live.tags)[0]?.error;
			if (problem) {
				return { type: 'modified', message: problem, elementId: seen.id, elementType: seen.type };
			}
		}

		const updated = applyTagChanges(live, pending);
		if (tagDiff(live.tags, updated.tags).length > 0) modified.push(updated);
	}

	if (!modified.length && !creates.length) return { type: 'unchanged' };

	const tags = changesetTags({ comment, source, locale });
	const changesetId = await openChangeset(config, tags);

	let diffResult: { elements: DiffElementResult[] };

	try {
		const xml = osmChangeXml(changesetId, {
			create: creates,
			modify: modified
		});
		diffResult = await uploadChange(config, changesetId, xml);
	} catch (err) {
		await closeChangeset(config, changesetId).catch(() => undefined);

		if (err instanceof OsmApiError && err.status === HTTP_CONFLICT_STATUS) {
			for (const { seen, changes } of targets) {
				const live = await fetchElement(config, seen.type, seen.id).catch(() => null);
				const conflict = live && detectConflict(seen, live, changes);
				if (conflict) return conflict;
			}
			return {
				type: 'modified',
				message: `OpenStreetMap did not accept the change: ${err.body}`,
				elementId: targets[0]?.seen.id ?? 0,
				elementType: targets[0]?.seen.type ?? 'way'
			};
		}
		throw err;
	}

	await closeChangeset(config, changesetId);
	return { ok: true, changesetId, elements: diffResult.elements };
}
