import { formatNumber, t } from './i18n/index.ts';
import type { IconName } from './ui/Icon.svelte';
import { DRAG_LIFTS, type Lift, type LiftType } from './resort/types.ts';

export function liftTypeLabel(l: Pick<Lift, 'type' | 'occupancy'>): string {
	const name = t.lifts.type[l.type];
	return l.occupancy && l.type !== 'magic_carpet' ? t.lifts.withSeats(l.occupancy, name) : name;
}

export function liftIcon(type: LiftType): IconName {
	if (type === 'gondola' || type === 'cable_car' || type === 'mixed_lift') return 'gondola';
	return DRAG_LIFTS.has(type) || type === 'magic_carpet' ? 'drag' : 'chair';
}

export const kmh = (ms: number) => Math.round(ms * 3.6);

/** Stopwatch time, "1:05:09" or "5:09". */
export function clock(seconds: number): string {
	const s = Math.max(0, Math.floor(seconds));
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const pad = (n: number) => String(n).padStart(2, '0');
	return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

/** Kilometres without the unit, in the reader's number format: "3.5" ("3,5" in German). */
export const km = (m: number, digits = 1) => formatNumber(m / 1000, digits);
