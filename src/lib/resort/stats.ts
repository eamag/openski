import type { TerrainData } from '../conditions/terrain-types.ts';
import { pisteProfile } from './profile.ts';
import type { Resort } from './model.ts';
import type { Difficulty, LiftType } from './types.ts';

export const COLOURS = [
	'novice',
	'easy',
	'intermediate',
	'advanced',
	'freeride',
	'unknown'
] as const;
export type Colour = (typeof COLOURS)[number];

const colourOf = (d: Difficulty): Colour => (d === 'expert' ? 'advanced' : d);

export interface PisteRank {
	index: number;
	length: number;
	pct: number;
}

export interface ResortStats {
	byColour: Record<Colour, number>;
	pisteKm: number;
	pistes: number;
	byLift: { type: LiftType; count: number; length: number }[];
	lifts: number;
	low: number;
	high: number;
	longest: PisteRank[];
	steepest: PisteRank[];
}

const MIN_PISTE_LENGTH_FOR_STEEPEST_METERS = 300;
const TOP_RANKS_COUNT = 3;
const EIGHT_COMPASS_SECTORS = 8;
const DEGREES_PER_SECTOR = 45;

export function resortStats(resort: Resort): ResortStats {
	const { edges, pistes, lifts } = resort.data;
	const byColour = Object.fromEntries(COLOURS.map((c) => [c, 0])) as Record<Colour, number>;
	for (const e of edges) if (e.k === 'p') byColour[colourOf(pistes[e.o].difficulty)] += e.len;

	const types = new Map<LiftType, { count: number; length: number }>();
	for (const l of lifts) {
		const t = types.get(l.type) ?? { count: 0, length: 0 };
		t.count++;
		t.length += l.length;
		types.set(l.type, t);
	}

	const ranks: PisteRank[] = [];
	pistes.forEach((p, index) => {
		if (!p.counted) return;
		const profile = pisteProfile(resort, index);
		ranks.push({ index, length: p.length, pct: profile?.steepest.pct ?? 0 });
	});

	return {
		byColour,
		pisteKm: Object.values(byColour).reduce((a, b) => a + b, 0) / 1000,
		pistes: pistes.filter((p) => p.counted).length,
		byLift: [...types].map(([type, v]) => ({ type, ...v })).sort((a, b) => b.length - a.length),
		lifts: lifts.length,
		low: Math.min(...pistes.map((p) => p.bottom)),
		high: Math.max(...pistes.map((p) => p.top)),
		longest: [...ranks].sort((a, b) => b.length - a.length).slice(0, TOP_RANKS_COUNT),
		steepest: ranks
			.filter((r) => r.length >= MIN_PISTE_LENGTH_FOR_STEEPEST_METERS)
			.sort((a, b) => b.pct - a.pct)
			.slice(0, TOP_RANKS_COUNT)
	};
}

export function aspectRose(resort: Resort, terrain: TerrainData): number[] {
	const rose = new Array<number>(EIGHT_COMPASS_SECTORS).fill(0);
	resort.data.edges.forEach((edge, edgeIndex) => {
		const aspectDegrees = terrain.aspect[edgeIndex];
		if (edge.k !== 'p' || aspectDegrees == null || aspectDegrees < 0) return;
		const normalizedAspect = ((aspectDegrees % 360) + 360) % 360;
		const sectorIndex = Math.round(normalizedAspect / DEGREES_PER_SECTOR) % EIGHT_COMPASS_SECTORS;
		rose[sectorIndex] += edge.len;
	});
	return rose;
}

export const COMPASS = [
	'north',
	'north-east',
	'east',
	'south-east',
	'south',
	'south-west',
	'west',
	'north-west'
] as const;
