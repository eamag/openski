import { getPosition } from 'suncalc';
import { t } from '../i18n/index.ts';
import type { Resort } from '../resort/model.ts';
import { EDGE_UNGROOMED } from '../resort/types.ts';
import { HORIZON_STEPS_PER_DEGREE, type TerrainData } from './terrain-types.ts';
import type { Weather } from './weather.ts';

export const SURFACES = ['powder', 'packed', 'firm', 'icy', 'soft', 'slush'] as const;
export type Surface = (typeof SURFACES)[number];
export const LIGHTS = ['sun', 'shade', 'flat', 'fog', 'glare'] as const;
export type Light = (typeof LIGHTS)[number];

export const DAY_START = 8;
export const DAY_END = 16;
const MORNING_GROOMING_HOUR = 5;
const MAX_FELT_WIND_KMH = 250;
const TEMP_ENCODING_OFFSET = 100;
const HOURLY_SUN_SAMPLE_MINUTES = [10, 30, 50];

export interface ForecastHour {
	t: number;
	day: number;
	hour: number;
	sunAlt: number;
	sunAz: number;
	score: number;
	sunShare: number;
	low: { ele: number; temp: number; wind: number };
	high: { ele: number; temp: number; wind: number };
	windDir: number;
	cloud: number;
	snowfall: number;
	code: number;
}

export interface Forecast {
	version: string;
	fetched: number;
	hours: ForecastHour[];
	score: Uint8Array[];
	snow: Uint8Array[];
	light: Uint8Array[];
	wind: Uint8Array[];
	surface: Uint8Array[];
	lightKind: Uint8Array[];
	windKmh: Uint8Array[];
	temp: Uint8Array[];
}

export const NONE = 255;

const RAD = Math.PI / 180;
const clamp = (v: number, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function curve(x: number, points: [number, number][]): number {
	if (x <= points[0][0]) return points[0][1];
	for (let i = 1; i < points.length; i++) {
		if (x <= points[i][0]) {
			const [x0, y0] = points[i - 1];
			const [x1, y1] = points[i];
			return lerp(y0, y1, (x - x0) / (x1 - x0));
		}
	}
	return points[points.length - 1][1];
}

function levelMix(eles: number[], z: number): [lower: number, upper: number, t: number] {
	if (z <= eles[0]) return [0, 0, 0];
	for (let i = 1; i < eles.length; i++) {
		if (z <= eles[i]) return [i - 1, i, (z - eles[i - 1]) / (eles[i] - eles[i - 1])];
	}
	return [eles.length - 1, eles.length - 1, 0];
}

function angleBetween(a: number, b: number): number {
	const d = Math.abs(a - b) % 360;
	return d > 180 ? 360 - d : d;
}

export function windChill(temp: number, kmh: number): number {
	if (temp > 10 || kmh < 5) return temp;
	const v = kmh ** 0.16;
	return 13.12 + 0.6215 * temp - 11.37 * v + 0.3965 * temp * v;
}

export function computeForecast(
	resort: Resort,
	terrain: TerrainData,
	weather: Weather,
	now = Date.now()
): Forecast {
	const { edges, nodes, center } = resort.data;
	const n = edges.length;
	const bins = terrain.bins;
	const binWidth = 360 / bins;
	const offsetMs = weather.utcOffset * 1000;
	const localDay = (t: number) => Math.floor((t + offsetMs) / 86_400_000);
	const today = localDay(now);

	const sun = Array.from({ length: weather.count }, (_, i) =>
		HOURLY_SUN_SAMPLE_MINUTES.map((minute) => {
			const p = getPosition(
				new Date(weather.start + i * 3_600_000 + minute * 60_000),
				center[1],
				center[0]
			);
			return { alt: p.altitude, az: p.azimuth };
		})
	);

	const levelEles = weather.levels.map((l) => l.ele);
	const upperEles = weather.upper.map((u) => u.ele);

	const kept: number[] = [];
	const hours: ForecastHour[] = [];
	for (let i = 0; i < weather.count; i++) {
		const t = weather.start + i * 3_600_000;
		const day = localDay(t) - today;
		const hour = new Date(t + offsetMs).getUTCHours();
		if (day < 0 || hour < DAY_START || hour > DAY_END) continue;
		const top = weather.levels[weather.levels.length - 1];
		const bottom = weather.levels[0];
		const mid = weather.levels[Math.floor(weather.levels.length / 2)];
		kept.push(i);
		hours.push({
			t,
			day,
			hour,
			sunAlt: sun[i][1].alt,
			sunAz: sun[i][1].az,
			score: 0,
			sunShare: 0,
			low: { ele: bottom.ele, temp: bottom.temp[i], wind: bottom.wind[i] },
			high: {
				ele: top.ele,
				temp: top.temp[i],
				wind: Math.max(top.wind[i], weather.upper[weather.upper.length - 1].speed[i])
			},
			windDir: weather.upper[weather.upper.length - 1].dir[i],
			cloud: mid.cloud[i],
			snowfall: mid.snowfall[i],
			code: mid.code[i]
		});
	}
	const slot = new Int32Array(weather.count).fill(-1);
	kept.forEach((i, k) => (slot[i] = k));

	const make = () => hours.map(() => new Uint8Array(n).fill(NONE));
	const out: Forecast = {
		version: resort.data.version,
		fetched: weather.fetched,
		hours,
		score: make(),
		snow: make(),
		light: make(),
		wind: make(),
		surface: make(),
		lightKind: make(),
		windKmh: make(),
		temp: make()
	};
	const sumScore = new Float64Array(hours.length);
	const sumSun = new Float64Array(hours.length);
	let sumLen = 0;

	const horizonAt = (edge: number, az: number): number => {
		const f = (((az % 360) + 360) % 360) / binWidth;
		const b0 = Math.floor(f) % bins;
		const b1 = (b0 + 1) % bins;
		const base = edge * bins;
		return (
			lerp(terrain.horizon[base + b0], terrain.horizon[base + b1], f - Math.floor(f)) /
			HORIZON_STEPS_PER_DEGREE
		);
	};

	for (let e = 0; e < n; e++) {
		const edge = edges[e];
		if (edge.k !== 'p' || terrain.slope[e] < 0) continue;
		const z = (nodes[edge.a][2] + nodes[edge.b][2]) / 2;
		const xy = resort.xy[e];
		const bearing =
			(Math.atan2(xy[xy.length - 2] - xy[0], xy[xy.length - 1] - xy[1]) / RAD + 360) % 360;
		const slope = terrain.slope[e];
		const aspect = terrain.aspect[e];
		const sinSlope = Math.sin(slope * RAD);
		const cosSlope = Math.cos(slope * RAD);
		const groomed = !((edge.f ?? 0) & EDGE_UNGROOMED) && edge.d !== 'freeride';
		const ridge = clamp(0.5 + terrain.tpi[e] / 60);
		const [la, lb, lt] = levelMix(levelEles, z);
		const [ua, ub, ut] = levelMix(upperEles, z);
		const at = (
			key: 'temp' | 'cloud' | 'precip' | 'snowfall' | 'vis' | 'dni' | 'wind' | 'gust',
			i: number
		) => lerp(weather.levels[la][key][i], weather.levels[lb][key][i], lt);
		sumLen += edge.len;

		let wet = 0;
		let ice = 0.12;
		let fresh = 0;

		for (let i = 0; i < weather.count; i++) {
			const t = weather.start + i * 3_600_000;
			const hour = new Date(t + offsetMs).getUTCHours();
			const temp = at('temp', i);
			const dni = at('dni', Math.min(i + 1, weather.count - 1));
			const snowfall = at('snowfall', i);
			const rain = temp > 0.5 ? Math.max(0, at('precip', i) - snowfall * 0.7) : 0;
			const clear = clamp(dni / 350);

			let lit = 0;
			for (const s of sun[i]) if (s.alt > horizonAt(e, s.az) + 0.3) lit++;
			const sunShare = lit / HOURLY_SUN_SAMPLE_MINUTES.length;
			const { alt, az } = sun[i][1];
			const incidence =
				Math.sin(alt * RAD) * cosSlope +
				Math.cos(alt * RAD) * sinSlope * Math.cos((az - aspect) * RAD);
			const onSlope = alt > 0 ? dni * Math.max(0, incidence) * sunShare : 0;

			const drive =
				temp + 0.006 * onSlope - (alt <= 0 && clear + (1 - at('cloud', i) / 100) > 0.6 ? 1.5 : 0);
			if (drive > 0) {
				wet = clamp(wet + drive * 0.05 + rain * 0.25);
				ice = clamp(ice - drive * 0.12);
			} else {
				const frozen = Math.min(wet, -drive * 0.1);
				wet -= frozen;
				ice = clamp(ice + frozen * 0.9);
			}
			if (snowfall > 0 && temp <= 0.5) fresh += snowfall;
			if (wet > 0.3) fresh *= 0.6;
			fresh *= 0.98;
			const isMorningGrooming = groomed && hour === MORNING_GROOMING_HOUR;
			if (isMorningGrooming) {
				ice *= fresh > 2 ? 0.3 : 0.6;
				fresh *= 0.25;
			}

			const k = slot[i];
			if (k < 0) continue;

			const cover = clamp(fresh / 6);
			const hard = ice * (1 - cover);
			let snow = 88 - 60 * hard;
			if (wet <= 0.45) snow += hard < 0.3 ? 8 * Math.sin((clamp(wet / 0.35) * Math.PI) / 2) : 0;
			else snow -= ((wet - 0.45) / 0.55) * 45;
			snow += Math.min(12, fresh * 1.5);
			const afternoonScrapeFactor = clamp((hour - 10) / 6);
			const steepnessScrapeFactor = clamp((slope - 18) / 15);
			const drySnowFactor = 1 - clamp(wet / 0.3);
			const unprotectedHardLayer = 1 - cover;
			const steepSlopeScrapeLoss =
				12 * afternoonScrapeFactor * steepnessScrapeFactor * drySnowFactor * unprotectedHardLayer;
			snow -= steepSlopeScrapeLoss;
			snow -= 25 * clamp(rain);
			snow = clamp(snow, 0, 100);
			const surface: Surface =
				fresh >= 3 && wet < 0.3
					? 'powder'
					: wet > 0.55
						? 'slush'
						: wet > 0.15
							? 'soft'
							: hard > 0.5
								? 'icy'
								: hard > 0.25
									? 'firm'
									: 'packed';

			const fog = clamp(
				Math.max((3000 - at('vis', i)) / 2500, snowfall > 0.3 ? 0.35 + snowfall * 0.25 : 0)
			);
			const flat = (1 - clear) * 0.65 + clear * (1 - sunShare) * 0.3;
			const sunElevationAboveHorizon = alt - Math.max(0, horizonAt(e, az));
			const isLowSun = clamp((16 - sunElevationAboveHorizon) / 10);
			const isFacingSun = clamp((45 - angleBetween(bearing, az)) / 25);
			const glare = clear * sunShare * isLowSun * isFacingSun;
			const light = clamp(100 * (1 - Math.max(fog * 0.95, flat)) - 35 * glare, 0, 100);
			const lightKind: Light =
				fog > 0.5
					? 'fog'
					: glare > 0.5
						? 'glare'
						: clear < 0.5
							? 'flat'
							: sunShare >= 0.5
								? 'sun'
								: 'shade';

			const free = lerp(weather.upper[ua].speed[i], weather.upper[ub].speed[i], ut);
			const freeDir = weather.upper[ut > 0.5 ? ub : ua].dir[i];
			const shelter = clamp(horizonAt(e, freeDir) / 14);
			const exposure = clamp(ridge * (1 - 0.75 * shelter) + 0.15);
			const surfaceWind = at('wind', i);
			const felt = lerp(
				0.5 * Math.min(surfaceWind, free),
				Math.max(free, 0.8 * at('gust', i)),
				exposure
			);
			const chill = windChill(temp, felt);
			const wind = clamp(
				curve(felt, [
					[10, 100],
					[25, 78],
					[40, 48],
					[60, 18],
					[80, 0]
				]) - clamp((-12 - chill) * 2.5, 0, 35),
				0,
				100
			);

			const weightedConditionsScore = 0.45 * snow + 0.33 * light + 0.22 * wind;
			const worstFactorScore = Math.min(snow, light, wind);
			const worstFactorCap = worstFactorScore + 22;
			const total = Math.min(weightedConditionsScore, worstFactorCap);

			out.score[k][e] = Math.round(total);
			out.snow[k][e] = Math.round(snow);
			out.light[k][e] = Math.round(light);
			out.wind[k][e] = Math.round(wind);
			out.surface[k][e] = SURFACES.indexOf(surface);
			out.lightKind[k][e] = LIGHTS.indexOf(lightKind);
			out.windKmh[k][e] = Math.min(MAX_FELT_WIND_KMH, Math.round(felt));
			out.temp[k][e] = clamp(Math.round(temp) + TEMP_ENCODING_OFFSET, 0, 254);
			sumScore[k] += total * edge.len;
			sumSun[k] += sunShare * clear * edge.len;
		}
	}

	hours.forEach((h, k) => {
		h.score = sumLen ? Math.round(sumScore[k] / sumLen) : 0;
		h.sunShare = sumLen ? sumSun[k] / sumLen : 0;
	});
	return out;
}

export interface PisteConditions {
	score: number;
	snow: number;
	light: number;
	wind: number;
	surface: Surface;
	lightKind: Light;
	windKmh: number;
	temp: number;
}

export function summarise(
	resort: Resort,
	forecast: Forecast,
	edgeList: number[],
	k: number
): PisteConditions | null {
	let len = 0;
	let score = 0;
	let snow = 0;
	let light = 0;
	let wind = 0;
	let kmh = 0;
	let temp = 0;
	const surfaces = new Float64Array(SURFACES.length);
	const lights = new Float64Array(LIGHTS.length);
	for (const e of edgeList) {
		if (forecast.score[k][e] === NONE) continue;
		const l = resort.data.edges[e].len;
		len += l;
		score += forecast.score[k][e] * l;
		snow += forecast.snow[k][e] * l;
		light += forecast.light[k][e] * l;
		wind += forecast.wind[k][e] * l;
		kmh += forecast.windKmh[k][e] * l;
		temp += (forecast.temp[k][e] - TEMP_ENCODING_OFFSET) * l;
		surfaces[forecast.surface[k][e]] += l;
		lights[forecast.lightKind[k][e]] += l;
	}
	if (!len) return null;
	const top = (a: Float64Array) => a.indexOf(Math.max(...a));
	return {
		score: Math.round(score / len),
		snow: Math.round(snow / len),
		light: Math.round(light / len),
		wind: Math.round(wind / len),
		surface: SURFACES[top(surfaces)],
		lightKind: LIGHTS[top(lights)],
		windKmh: Math.round(kmh / len),
		temp: Math.round(temp / len)
	};
}

export const SCORE_STOPS: [number, string][] = [
	[0, '#c62f2f'],
	[45, '#f08c2e'],
	[65, '#e9c62b'],
	[85, '#3fae5a'],
	[100, '#12804a']
];

export function scoreColor(score: number): string {
	const hex = (c: string, i: number) => parseInt(c.slice(1 + i * 2, 3 + i * 2), 16);
	for (let i = 1; i < SCORE_STOPS.length; i++) {
		if (score <= SCORE_STOPS[i][0]) {
			const [x0, c0] = SCORE_STOPS[i - 1];
			const [x1, c1] = SCORE_STOPS[i];
			const t = clamp((score - x0) / (x1 - x0));
			return `rgb(${[0, 1, 2].map((ch) => Math.round(lerp(hex(c0, ch), hex(c1, ch), t))).join(' ')})`;
		}
	}
	return SCORE_STOPS[SCORE_STOPS.length - 1][1];
}

export function scoreWord(score: number): string {
	return score >= 85
		? t.conditions.score.great
		: score >= 70
			? t.conditions.score.good
			: score >= 55
				? t.conditions.score.fair
				: score >= 40
					? t.conditions.score.poor
					: t.conditions.score.bad;
}
