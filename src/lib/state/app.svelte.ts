import { asset } from '$app/paths';
import { readStored, readStoredJson, writeStored } from '#lib/browser-storage.ts';
import { t } from '#lib/i18n/index.ts';
import { Resort } from '#lib/resort/model.ts';
import type { LngLat } from '#lib/geo.ts';
import type { ResortData } from '#lib/resort/types.ts';
import { catalogResort, catalogResortSync } from './catalog.ts';
import { conditions } from './conditions.svelte.ts';
import { progress } from './progress.svelte.ts';
import { queues } from './queues.svelte.ts';
import { route } from './route.svelte.ts';
import { status } from './status.svelte.ts';

export type Selection =
	| { kind: 'piste'; index: number }
	| { kind: 'lift'; index: number }
	| { kind: 'poi'; index: number };

export type MapMode = 'pistes' | 'progress' | 'conditions';
type MapOption = 'dimClosed' | 'dimDone' | 'slopes';

const OPTIONS = 'map-options';
export const LAST_RESORT = 'last-resort';
const DEFAULT_FALLBACK_RESORT = 'soelden';

class AppState {
	resort = $state.raw<Resort | null>(null);
	country = $state<string | undefined>(undefined);
	loadError = $state<string | null>(null);
	selection = $state.raw<Selection | null>(null);
	mode = $state<MapMode>('pistes');
	terrain = $state(false);
	follow = $state(false);
	picking = $state<'from' | 'to' | null>(null);
	sheetHeight = $state(0);
	dimClosed = $state(true);
	dimDone = $state(false);
	slopes = $state(false);
	cursor = $state.raw<LngLat | null>(null);

	private loadingId: string | null = null;

	restoreOptions(): void {
		const saved = readStoredJson<Partial<Record<MapOption, unknown>>>(OPTIONS, {});
		if (typeof saved.dimClosed === 'boolean') this.dimClosed = saved.dimClosed;
		if (typeof saved.dimDone === 'boolean') this.dimDone = saved.dimDone;
		if (typeof saved.slopes === 'boolean') this.slopes = saved.slopes;
	}

	setOption(name: MapOption, on: boolean): void {
		this[name] = on;
		writeStored(
			OPTIONS,
			JSON.stringify({ dimClosed: this.dimClosed, dimDone: this.dimDone, slopes: this.slopes })
		);
	}

	get lastResort(): string {
		return this.openedBefore ?? DEFAULT_FALLBACK_RESORT;
	}

	get openedBefore(): string | null {
		return readStored(LAST_RESORT);
	}

	private resetPerResortState(): void {
		this.selection = null;
		this.picking = null;
		this.country = undefined;
		route.clear();
		conditions.reset();
		queues.reset();
		status.reset();
		progress.reset();
	}

	async load(id: string): Promise<void> {
		if (this.resort?.id === id || this.loadingId === id) return;
		this.loadingId = id;

		this.resetPerResortState();

		try {
			const res = await fetch(asset(`data/${id}.json` as never));
			if (res.status === 404) throw new Error(t.map.errorNotFound);
			if (!res.ok) throw new Error(t.map.errorStatus(res.status));
			this.resort = new Resort((await res.json()) as ResortData);
			this.country = catalogResortSync(id)?.country;
			void catalogResort(id).then((entry) => {
				if (this.resort?.id === id && entry?.country) {
					this.country = entry.country;
				}
			});
			this.loadError = null;
			writeStored(LAST_RESORT, id);
		} catch (err) {
			this.resort = null;
			this.loadError = err instanceof TypeError ? t.map.errorNetwork : (err as Error).message;
		} finally {
			this.loadingId = null;
		}
	}
}

export const app = new AppState();
