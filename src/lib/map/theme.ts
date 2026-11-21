import type { Difficulty } from '../resort/types.ts';
import { getPisteColors } from '../resort/difficulty.ts';

export { getPisteColors };

export interface MapTheme {
	dark: boolean;
	snow: string;
	glacier: string;
	forest: string;
	water: string;
	road: string;
	building: string;
	contour: string;
	contourLabel: string;
	shade: string;
	highlight: string;
	label: string;
	labelSoft: string;
	halo: string;
	lift: string;
	casing: string;
	route: string;
	selection: string;
	piste: Record<Difficulty, string>;
}

export const PISTE_COLORS: Record<Difficulty, string> = getPisteColors(undefined, false);

export const ACCENT = '#7c3aed';

const LIGHT_THEME_SELECTION_HALO = '#cdb9fb';
const DARK_THEME_SELECTION_HALO = '#5a3fae';

export const LIGHT: MapTheme = {
	dark: false,
	snow: '#f4f7fa',
	glacier: '#e3effa',
	forest: '#dde8dc',
	water: '#b9d7ee',
	road: '#d3d9e1',
	building: '#dfe3e9',
	contour: '#b5c1d2',
	contourLabel: '#8a98ad',
	shade: '#5d6f8f',
	highlight: '#ffffff',
	label: '#3b4453',
	labelSoft: '#7b8594',
	halo: '#ffffff',
	lift: '#2a303b',
	casing: '#ffffff',
	route: ACCENT,
	selection: LIGHT_THEME_SELECTION_HALO,
	piste: PISTE_COLORS
};

const DARK_THEME_PISTE_COLORS: Record<Difficulty, string> = getPisteColors(undefined, true);

export const DARK: MapTheme = {
	dark: true,
	snow: '#161b22',
	glacier: '#1a2633',
	forest: '#17221c',
	water: '#12283a',
	road: '#2a323d',
	building: '#232a33',
	contour: '#2c3644',
	contourLabel: '#5b6878',
	shade: '#05070a',
	highlight: '#3a4656',
	label: '#c9d1dc',
	labelSoft: '#8793a3',
	halo: '#10141a',
	lift: '#d6dce5',
	casing: '#10141a',
	route: '#a78bfa',
	selection: DARK_THEME_SELECTION_HALO,
	piste: DARK_THEME_PISTE_COLORS
};
