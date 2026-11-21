import type { Difficulty } from './types.ts';

export interface CatalogResort {
	id: string;
	name: string;
	country: string;
	region?: string;
	center: [lon: number, lat: number];
	bbox: [west: number, south: number, east: number, north: number];
	ele: [lowest: number, highest: number];
	lifts: number;
	km: number;
	pisteKm?: Partial<Record<Difficulty, number>>;
	built: boolean;
	cams?: boolean;
	webcams?: number;
	skimap?: number;
	web?: string;
	osk: string;
}

export interface Catalog {
	built: string;
	resorts: CatalogResort[];
}
