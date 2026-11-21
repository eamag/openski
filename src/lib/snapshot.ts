import { LIGHTS, SURFACES } from '#lib/conditions/model.ts';

export interface SnapshotWeather {
	ele: number;
	temp: number;
	wind: number;
}

export interface SnapshotInput {
	resort: string;
	date: string;
	time: string;
	/** OSM grade words, so the text means the same in every region. */
	level: 'all' | 'easy' | 'intermediate' | 'advanced';
	hours: SnapshotHour[];
	now: number;
	pistes: SnapshotPiste[];
	lifts: SnapshotLift[];
}

export interface SnapshotHour {
	hour: number;
	score: number;
	low: SnapshotWeather;
	high: SnapshotWeather;
	windDir: number;
	cloud: number;
	snowfall: number;
	code: number;
}

export interface SnapshotPiste {
	i: number;
	open: boolean | null;
	score: number;
	surface: (typeof SURFACES)[number];
	light: (typeof LIGHTS)[number];
	windKmh: number;
	temp: number;
	day: (number | null)[];
}

export interface SnapshotLift {
	i: number;
	open: boolean | null;
	people?: number;
	waitS?: number;
	frame?: string;
}
