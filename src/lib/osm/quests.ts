import type { ResortData } from '#lib/resort/types.ts';
import type { OsmElement } from './types.ts';
import { getDifficultyLongLabel } from '#lib/resort/difficulty.ts';
import { isRoadWay, pisteKeyFor, ROAD_SHARED_KEYS } from './change.ts';
import { t } from '#lib/i18n/index.ts';

export type QuestKind = 'lift' | 'piste';

export interface QuestAnswer {
	label: string;
	value: string;
	tone?: 'novice' | 'easy' | 'intermediate' | 'advanced' | 'expert' | 'freeride';
}

export interface QuestType {
	id: string;
	kind: QuestKind;
	key: string;
	alternateKeys?: string[];
	question: (name: string) => string;
	hint?: string;
	applies: (tags: Record<string, string>) => boolean;
	answers?: (tags: Record<string, string>, country?: string) => QuestAnswer[];
	input?: 'text' | 'number';
	priority: number;
}

const yesNoAnswers = (): QuestAnswer[] => [
	{ label: t.common.yes, value: 'yes' },
	{ label: t.common.no, value: 'no' }
];

const isChair = (tTags: Record<string, string>) => tTags.aerialway === 'chair_lift';
const hasCabins = (tTags: Record<string, string>) =>
	['chair_lift', 'gondola', 'mixed_lift', 'cable_car'].includes(tTags.aerialway ?? '');
const isDownhill = (tTags: Record<string, string>) => tTags['piste:type'] === 'downhill';

export const QUEST_TYPES: QuestType[] = [
	{
		id: 'lift-occupancy',
		kind: 'lift',
		key: 'aerialway:occupancy',
		question: (n) => t.osm.quests.liftOccupancy.question(n),
		get hint() {
			return t.osm.quests.liftOccupancy.hint;
		},
		applies: hasCabins,
		answers: (tTags) =>
			(tTags.aerialway === 'chair_lift'
				? [1, 2, 3, 4, 6, 8]
				: tTags.aerialway === 'cable_car'
					? []
					: [4, 6, 8, 10, 15]
			).map((n) => ({ label: String(n), value: String(n) })),
		input: 'number',
		priority: 1
	},
	{
		id: 'lift-bubble',
		kind: 'lift',
		key: 'aerialway:bubble',
		question: (n) => t.osm.quests.liftBubble.question(n),
		applies: isChair,
		answers: yesNoAnswers,
		priority: 2
	},
	{
		id: 'lift-heating',
		kind: 'lift',
		key: 'aerialway:heating',
		question: (n) => t.osm.quests.liftHeating.question(n),
		applies: isChair,
		answers: yesNoAnswers,
		priority: 3
	},
	{
		id: 'lift-ref',
		kind: 'lift',
		key: 'ref',
		question: (n) => t.osm.quests.liftRef.question(n),
		get hint() {
			return t.osm.quests.liftRef.hint;
		},
		applies: (tTags) => !!tTags.aerialway,
		input: 'text',
		priority: 6
	},
	{
		id: 'piste-difficulty',
		kind: 'piste',
		key: 'piste:difficulty',
		question: (n) => t.osm.quests.pisteDifficulty.question(n),
		get hint() {
			return t.osm.quests.pisteDifficulty.hint;
		},
		applies: isDownhill,
		// Labelled the way the resort's signs are (a blue square is intermediate in North America).
		answers: (_, country) =>
			(['novice', 'easy', 'intermediate', 'advanced', 'expert', 'freeride'] as const).map(
				(value) => ({ label: getDifficultyLongLabel(value, country), value, tone: value })
			),
		priority: 1
	},
	{
		id: 'piste-grooming',
		kind: 'piste',
		key: 'piste:grooming',
		question: (n) => t.osm.quests.pisteGrooming.question(n),
		get hint() {
			return t.osm.quests.pisteGrooming.hint;
		},
		applies: isDownhill,
		answers: () => [
			{ label: t.osm.quests.pisteGrooming.classic, value: 'classic' },
			{ label: t.osm.quests.pisteGrooming.mogul, value: 'mogul' },
			{ label: t.osm.quests.pisteGrooming.backcountry, value: 'backcountry' }
		],
		priority: 2
	},
	{
		id: 'piste-ref',
		kind: 'piste',
		key: 'ref',
		alternateKeys: ['piste:ref'],
		question: (n) => t.osm.quests.pisteRef.question(n),
		get hint() {
			return t.osm.quests.pisteRef.hint;
		},
		applies: isDownhill,
		input: 'text',
		priority: 3
	},
	{
		id: 'piste-snowmaking',
		kind: 'piste',
		key: 'piste:snowmaking',
		alternateKeys: ['snowmaking'],
		question: (n) => t.osm.quests.pisteSnowmaking.question(n),
		applies: isDownhill,
		answers: yesNoAnswers,
		priority: 4
	},
	{
		id: 'piste-lit',
		kind: 'piste',
		key: 'lit',
		alternateKeys: ['piste:lit'],
		question: (n) => t.osm.quests.pisteLit.question(n),
		get hint() {
			return t.osm.quests.pisteLit.hint;
		},
		applies: isDownhill,
		answers: yesNoAnswers,
		priority: 5
	}
];

export interface Quest {
	id: string;
	type: QuestType;
	kind: QuestKind;
	index: number;
	name: string;
	ways: OsmElement[];
	distance: number | null;
	at: [number, number];
}

export function isQuestOpenOnWay(type: QuestType, way: OsmElement, done: Set<string>): boolean {
	const tags = way.tags ?? {};
	if (!type.applies(tags)) return false;

	const isRoad = isRoadWay(tags);
	const targetKey = isRoad ? pisteKeyFor(type.key, tags) : type.key;
	if (done.has(`${way.id}:${type.key}`) || done.has(`${way.id}:${targetKey}`)) {
		return false;
	}

	if (isRoad && ROAD_SHARED_KEYS.has(type.key)) {
		// On ways that carry a highway=* tag, only the piste: key counts as already set
		return tags[targetKey] === undefined;
	}

	const allKeys = [type.key, ...(type.alternateKeys ?? [])];
	return !allKeys.some((k) => tags[k] !== undefined);
}

export function resortElementsFromData(data: ResortData): Map<number, OsmElement> {
	const elements = new Map<number, OsmElement>();
	for (const lift of data.lifts) {
		const wayId = Number(/^l(\d+)$/.exec(lift.id)?.[1]);
		if (!wayId) continue;
		const tags: Record<string, string> = {
			aerialway: lift.type
		};
		if (lift.name) tags.name = lift.name;
		if (lift.ref) tags.ref = lift.ref;
		if (lift.occupancy) tags['aerialway:occupancy'] = String(lift.occupancy);
		if (lift.capacity) tags['aerialway:capacity'] = String(lift.capacity);
		if (lift.bubble !== undefined) tags['aerialway:bubble'] = lift.bubble ? 'yes' : 'no';
		if (lift.heated !== undefined) tags['aerialway:heating'] = lift.heated ? 'yes' : 'no';
		if (lift.duration) tags['aerialway:duration'] = String(Math.round(lift.duration / 60));
		elements.set(wayId, {
			type: 'way',
			id: wayId,
			version: 1,
			tags
		});
	}

	for (const piste of data.pistes) {
		const ways = piste.ways ?? [];
		if (!ways.length) continue;
		const tags: Record<string, string> = {
			'piste:type': 'downhill'
		};
		if (piste.ref) tags.ref = piste.ref;
		if (piste.title) tags.name = piste.title;
		if (piste.difficulty && piste.difficulty !== 'unknown') {
			tags['piste:difficulty'] = piste.difficulty;
		}
		for (const wId of ways) {
			elements.set(wId, {
				type: 'way',
				id: wId,
				version: 1,
				tags: { ...tags }
			});
		}
	}

	return elements;
}

const metres = (a: [number, number], b: [number, number]) => {
	const dx = (b[0] - a[0]) * 111320 * Math.cos((a[1] * Math.PI) / 180);
	const dy = (b[1] - a[1]) * 110540;
	return Math.hypot(dx, dy);
};

export function nearest(
	points: [number, number][],
	from: [number, number] | null
): { at: [number, number]; d: number | null } {
	if (!from || !points.length) return { at: points[0], d: null };
	let best = points[0];
	let bestD = Infinity;
	for (const p of points) {
		const d = metres(from, p);
		if (d < bestD) [best, bestD] = [p, d];
	}
	return { at: best, d: bestD };
}

/**
 * Pistes a survey may ask about: drawn as one OSM way, or as several ways that join into one line.
 * Builds can group ways that only share a number across a whole ski area; those stay out.
 */
export function surveyablePistes(data: ResortData): Set<number> {
	const edgesOf = new Map<number, [number, number][]>();
	for (const e of data.edges as unknown as { k: string; o: number; a: number; b: number }[]) {
		if (e.k !== 'p') continue;
		const list = edgesOf.get(e.o) ?? [];
		list.push([e.a, e.b]);
		edgesOf.set(e.o, list);
	}
	const out = new Set<number>();
	data.pistes.forEach((p, i) => {
		const n = p.ways?.length ?? 0;
		if (n === 1) out.add(i);
		if (n < 2) return;
		// Join only this piste's own edges: meeting through another piste does not count.
		const parent = new Map<number, number>();
		const find = (a: number): number => {
			while (parent.get(a) !== a) a = parent.get(a)!;
			return a;
		};
		for (const [a, b] of edgesOf.get(i) ?? []) {
			if (!parent.has(a)) parent.set(a, a);
			if (!parent.has(b)) parent.set(b, b);
			parent.set(find(a), find(b));
		}
		if (parent.size && new Set([...parent.keys()].map(find)).size === 1) out.add(i);
	});
	return out;
}

export function openQuests(
	data: ResortData,
	elements: Map<number, OsmElement>,
	from: [number, number] | null,
	done: Set<string>,
	pisteName: (index: number) => string
): Quest[] {
	const out: Quest[] = [];
	const surveyable = surveyablePistes(data);
	const pisteLines = new Map<number, [number, number][]>();
	for (const e of data.edges as unknown as { k: string; o: number; g: number[] }[]) {
		if (e.k !== 'p' || !Array.isArray(e.g)) continue;
		const pts = pisteLines.get(e.o) ?? [];
		for (let i = 0; i + 1 < e.g.length; i += 2) pts.push([e.g[i], e.g[i + 1]]);
		pisteLines.set(e.o, pts);
	}
	const add = (
		kind: QuestKind,
		index: number,
		name: string,
		wayIds: number[],
		points: [number, number][],
		knownRef: boolean
	) => {
		const ways = wayIds.flatMap((id) => elements.get(id) ?? []);
		if (!ways.length) return;
		const { at, d } = nearest(points, from);
		for (const type of QUEST_TYPES) {
			if (type.kind !== kind) continue;
			if (type.key === 'ref' && knownRef && !isRoadWay(ways[0]?.tags ?? {})) continue;
			const lacking = ways.filter((w) => isQuestOpenOnWay(type, w, done));
			if (!lacking.length) continue;
			if (type.answers && !type.input && !type.answers(lacking[0].tags ?? {}).length) continue;
			out.push({
				id: `${type.id}:${kind}${index}`,
				type,
				kind,
				index,
				name,
				ways: lacking,
				distance: d,
				at
			});
		}
	};
	data.lifts.forEach((l, i) => {
		const id = Number(/^l(\d+)$/.exec(l.id)?.[1]);
		if (id) add('lift', i, l.name, [id], l.coords as [number, number][], !!l.ref);
	});
	data.pistes.forEach((p, i) => {
		const pts = pisteLines.get(i) ?? [p.label as [number, number]];
		if (p.ways?.length && surveyable.has(i)) add('piste', i, pisteName(i), p.ways, pts, !!p.ref);
	});
	const DISTANCE_STEP_BUCKET_METERS = 100;
	const distanceBucket = (q: Quest) =>
		q.distance == null ? 0 : Math.round(q.distance / DISTANCE_STEP_BUCKET_METERS);
	const requiresTypingInput = (q: Quest) => (q.type.answers ? 0 : 1);
	return out.sort(
		(a, b) =>
			distanceBucket(a) - distanceBucket(b) ||
			requiresTypingInput(a) - requiresTypingInput(b) ||
			a.kind.localeCompare(b.kind) ||
			a.index - b.index ||
			a.type.priority - b.type.priority
	);
}
