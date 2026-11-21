import type { LngLat } from '../geo.ts';

export type Difficulty =
	'novice' | 'easy' | 'intermediate' | 'advanced' | 'expert' | 'freeride' | 'unknown';

export type LiftType =
	| 'cable_car'
	| 'gondola'
	| 'mixed_lift'
	| 'chair_lift'
	| 't-bar'
	| 'j-bar'
	| 'platter'
	| 'drag_lift'
	| 'rope_tow'
	| 'magic_carpet';

export const DRAG_LIFTS: ReadonlySet<LiftType> = new Set([
	't-bar',
	'j-bar',
	'platter',
	'drag_lift',
	'rope_tow'
]);

export const DIFFICULTY_RANK: Record<Difficulty, number> = {
	novice: 0,
	easy: 1,
	intermediate: 2,
	advanced: 3,
	expert: 4,
	freeride: 4,
	unknown: 3
};

export type EdgeKind = 'p' | 'l' | 'c';

export const EDGE_TUNNEL = 1;
export const EDGE_LIT = 2;
export const EDGE_UNGROOMED = 4;

export interface EdgeData {
	a: number;
	b: number;
	k: EdgeKind;
	o: number;
	o2?: number[];
	d?: Difficulty;
	bi?: 1;
	len: number;
	g?: number[];
	f?: number;
}

export interface Piste {
	id: string;
	ref: string;
	title?: string;
	difficulty: Difficulty;
	length: number;
	top: number;
	bottom: number;
	label: LngLat;
	counted: boolean;
	ways?: number[];
}

export interface Lift {
	id: string;
	name: string;
	ref?: string;
	type: LiftType;
	capacity?: number;
	occupancy?: number;
	duration: number;
	length: number;
	bottom: number;
	top: number;
	bubble?: boolean;
	heated?: boolean;
	stations: number[];
	coords: LngLat[];
}

export interface PisteArea {
	piste: number;
	difficulty: Difficulty;
	rings: LngLat[][];
}

export type PoiType = 'restaurant' | 'hut' | 'cafe' | 'bar' | 'toilets' | 'viewpoint' | 'first_aid';

export interface Poi {
	name: string;
	type: PoiType;
	lon: number;
	lat: number;
	ele: number;
	node: number;
}

export interface ResortData {
	id: string;
	name: string;
	version: string;
	timezone: string;
	bbox: [west: number, south: number, east: number, north: number];
	center: LngLat;
	nodes: [lon: number, lat: number, ele: number][];
	edges: EdgeData[];
	pistes: Piste[];
	lifts: Lift[];
	areas: PisteArea[];
	pois: Poi[];
	attribution: string;
}
