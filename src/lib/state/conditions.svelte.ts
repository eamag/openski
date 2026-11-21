import { asset, resolve } from '$app/paths';
import { t } from '#lib/i18n/index.ts';
import {
	computeForecast,
	DAY_END,
	DAY_START,
	NONE,
	summarise,
	type Forecast,
	type PisteConditions
} from '#lib/conditions/model.ts';
import type { TerrainData } from '#lib/conditions/terrain-types.ts';
import {
	openMeteoUrl,
	parseOpenMeteo,
	WEATHER_POINTS,
	type Weather
} from '#lib/conditions/weather.ts';
import { app } from './app.svelte.ts';

const WEATHER_REFRESH_AFTER_MS = 20 * 60_000;

async function fetchWeather(resort: string): Promise<Weather> {
	const proxied = await fetch(resolve('/api/weather/[resort]', { resort })).catch(() => null);
	if (proxied?.ok) return (await proxied.json()) as Weather;
	let points = WEATHER_POINTS[resort];
	if (!points && app.resort?.id === resort) {
		const nodes = app.resort.data.nodes;
		let low = Infinity;
		let high = -Infinity;
		for (const n of nodes) {
			if (n[2] < low) low = n[2];
			if (n[2] > high) high = n[2];
		}
		if (!Number.isFinite(low)) {
			low = 1000;
			high = 2500;
		}
		const [lon, lat] = app.resort.data.center;
		points = [
			{ lat, lon, ele: low },
			{ lat, lon, ele: Math.round((low + high) / 2) },
			{ lat, lon, ele: high }
		];
	}
	if (!points) throw new Error(t.conditions.error.noForecastForArea);
	const res = await fetch(openMeteoUrl(points));
	if (!res.ok) throw new Error(t.conditions.error.forecastNotAnswering);
	return parseOpenMeteo(resort, points, await res.json());
}

class ConditionsState {
	terrain = $state.raw<TerrainData | null>(null);
	weather = $state.raw<Weather | null>(null);
	loading = $state(false);
	error = $state<string | null>(null);
	at = $state<number | null>(null);

	private loadedFor: string | null = null;

	forecast = $derived.by((): Forecast | null => {
		const resort = app.resort;
		if (!resort || !this.terrain || !this.weather) return null;
		const isTerrainMatchingResort = this.terrain.version === resort.data.version;
		const isWeatherMatchingResort = this.weather.resort === resort.id;
		if (!isTerrainMatchingResort || !isWeatherMatchingResort) return null;
		return computeForecast(resort, this.terrain, this.weather);
	});

	private defaultIndex = $derived.by(() => {
		const hours = this.forecast?.hours ?? [];
		const now = Date.now();
		const current = hours.findIndex((h) => now >= h.t && now < h.t + 3_600_000);
		if (current >= 0) return current;
		const next = hours.findIndex((h) => h.t > now && h.hour >= DAY_START + 1);
		return next >= 0 ? next : Math.max(0, hours.length - 1);
	});

	index = $derived.by(() => {
		const hours = this.forecast?.hours ?? [];
		const chosen = this.at === null ? -1 : hours.findIndex((h) => h.t === this.at);
		return chosen >= 0 ? chosen : this.defaultIndex;
	});

	hour = $derived(this.forecast?.hours[this.index] ?? null);

	scores = $derived.by((): (number | null)[] | null => {
		const f = this.forecast;
		if (!f || !f.hours.length) return null;
		return Array.from(f.score[this.index], (v) => (v === NONE ? null : v));
	});

	pistes = $derived.by((): (PisteConditions | null)[] => {
		const resort = app.resort;
		const f = this.forecast;
		if (!resort || !f || !f.hours.length) return [];
		return resort.pisteEdges.map((edges) => summarise(resort, f, edges, this.index));
	});

	pisteDay(piste: number, day: number): { index: number; hour: number; score: number | null }[] {
		const resort = app.resort;
		const f = this.forecast;
		if (!resort || !f) return [];
		return f.hours.flatMap((h, k) =>
			h.day === day
				? [
						{
							index: k,
							hour: h.hour,
							score: summarise(resort, f, resort.pisteEdges[piste], k)?.score ?? null
						}
					]
				: []
		);
	}

	select(index: number) {
		const h = this.forecast?.hours[index];
		if (h) this.at = h.t;
	}

	edgeFactor = $derived.by((): ((edge: number) => number) | undefined => {
		const f = this.forecast;
		if (!f || !f.hours.length) return undefined;
		const scores = f.score[this.defaultIndex];
		return (edge) => {
			const s = scores[edge];
			return s === NONE ? 1 : Math.min(1.7, Math.max(0.85, 1 + (72 - s) / 60));
		};
	});

	reset(): void {
		this.terrain = null;
		this.weather = null;
		this.loadedFor = null;
		this.error = null;
		this.at = null;
		this.loading = false;
	}

	async load(force = false): Promise<void> {
		const resort = app.resort;
		if (!resort || this.loading) return;
		const fresh = this.weather && Date.now() - this.weather.fetched < WEATHER_REFRESH_AFTER_MS;
		if (this.loadedFor === resort.id && fresh && !force) return;
		this.loading = true;
		try {
			if (this.loadedFor !== resort.id || !this.terrain) {
				const res = await fetch(asset(`data/${resort.id}-terrain.json` as never));
				if (!res.ok) throw new Error(t.conditions.error.pisteConditionsNotAvailable);
				const terrain = (await res.json()) as TerrainData;
				if (terrain.version !== resort.data.version)
					throw new Error(t.conditions.error.pisteConditionsRebuilding);
				this.terrain = terrain;
			}
			this.weather = await fetchWeather(resort.id);
			this.loadedFor = resort.id;
			this.error = null;
		} catch (err) {
			this.error =
				err instanceof TypeError ? t.conditions.error.forecastDidNotLoad : (err as Error).message;
		} finally {
			this.loading = false;
		}
	}
}

export const conditions = new ConditionsState();
export { DAY_END, DAY_START };
