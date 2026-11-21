import { t } from '../i18n/index.ts';

export interface WeatherLevel {
	ele: number;
	temp: number[];
	cloud: number[];
	precip: number[];
	snowfall: number[];
	vis: number[];
	dni: number[];
	wind: number[];
	gust: number[];
	windDir: number[];
	code: number[];
}

export interface Weather {
	resort: string;
	fetched: number;
	utcOffset: number;
	start: number;
	count: number;
	levels: WeatherLevel[];
	upper: { ele: number; speed: number[]; dir: number[] }[];
}

export interface WeatherPoint {
	lat: number;
	lon: number;
	ele: number;
}

export const WEATHER_POINTS: Record<string, WeatherPoint[]> = {
	soelden: [
		{ lat: 46.955, lon: 11.006, ele: 1400 },
		{ lat: 46.931, lon: 10.979, ele: 2300 },
		{ lat: 46.935, lon: 10.938, ele: 3100 }
	]
};

const HOURLY = [
	'temperature_2m',
	'cloud_cover',
	'precipitation',
	'snowfall',
	'visibility',
	'direct_normal_irradiance',
	'wind_speed_10m',
	'wind_gusts_10m',
	'wind_direction_10m',
	'weather_code'
];
const PRESSURE = [
	{ hpa: 850, ele: 1450 },
	{ hpa: 800, ele: 1950 },
	{ hpa: 700, ele: 3000 }
];

const OPEN_METEO_CUSTOMER_HOST = 'customer-api.open-meteo.com';
const OPEN_METEO_PUBLIC_HOST = 'api.open-meteo.com';
const PAST_DAYS_FOR_SNOWPACK_HISTORY = '3';
const FORECAST_DAYS = '3';
const COORD_DECIMAL_ROUNDING = 1000;

export function openMeteoUrl(points: WeatherPoint[], apiKey?: string): string {
	const host = apiKey ? OPEN_METEO_CUSTOMER_HOST : OPEN_METEO_PUBLIC_HOST;
	const q = new URLSearchParams({
		latitude: points
			.map((p) => Math.round(p.lat * COORD_DECIMAL_ROUNDING) / COORD_DECIMAL_ROUNDING)
			.join(','),
		longitude: points
			.map((p) => Math.round(p.lon * COORD_DECIMAL_ROUNDING) / COORD_DECIMAL_ROUNDING)
			.join(','),
		elevation: points.map((p) => Math.round(p.ele)).join(','),
		hourly: [
			...HOURLY,
			...PRESSURE.flatMap((p) => [`wind_speed_${p.hpa}hPa`, `wind_direction_${p.hpa}hPa`])
		].join(','),
		past_days: PAST_DAYS_FOR_SNOWPACK_HISTORY,
		forecast_days: FORECAST_DAYS,
		timeformat: 'unixtime',
		timezone: 'auto',
		wind_speed_unit: 'kmh'
	});
	if (apiKey) {
		q.set('apikey', apiKey);
	}
	return `https://${host}/v1/forecast?${q}`;
}

export function openMeteoCacheKey(points: WeatherPoint[]): string {
	return openMeteoUrl(points);
}

interface OpenMeteoLocation {
	utc_offset_seconds: number;
	hourly: Record<string, (number | null)[]>;
}

function fillMissingWithLastKnown(
	values: (number | null)[] | undefined,
	count: number,
	fallback: number
): number[] {
	const out = new Array<number>(count);
	let last = fallback;
	for (let i = 0; i < count; i++) {
		const v = values?.[i];
		if (typeof v === 'number' && Number.isFinite(v)) last = v;
		out[i] = last;
	}
	return out;
}

const round1 = (list: number[]) => list.map((v) => Math.round(v * 10) / 10);

export function parseOpenMeteo(resort: string, points: WeatherPoint[], body: unknown): Weather {
	const list = (Array.isArray(body) ? body : [body]) as OpenMeteoLocation[];
	const time = list[0]?.hourly?.time;
	if (!time?.length || list.length !== points.length) throw new Error('Unexpected forecast format');
	const count = time.length;
	const middle = list[Math.floor(list.length / 2)].hourly;
	return {
		resort,
		fetched: Date.now(),
		utcOffset: list[0].utc_offset_seconds,
		start: (time[0] as number) * 1000,
		count,
		levels: list.map((loc, i) => {
			const h = loc.hourly;
			return {
				ele: points[i].ele,
				temp: round1(fillMissingWithLastKnown(h.temperature_2m, count, 0)),
				cloud: fillMissingWithLastKnown(h.cloud_cover, count, 50),
				precip: round1(fillMissingWithLastKnown(h.precipitation, count, 0)),
				snowfall: round1(fillMissingWithLastKnown(h.snowfall, count, 0)),
				vis: fillMissingWithLastKnown(h.visibility, count, 20000).map(Math.round),
				dni: fillMissingWithLastKnown(h.direct_normal_irradiance, count, 0).map(Math.round),
				wind: fillMissingWithLastKnown(h.wind_speed_10m, count, 0).map(Math.round),
				gust: fillMissingWithLastKnown(h.wind_gusts_10m, count, 0).map(Math.round),
				windDir: fillMissingWithLastKnown(h.wind_direction_10m, count, 0),
				code: fillMissingWithLastKnown(h.weather_code, count, 0)
			};
		}),
		upper: PRESSURE.map((p) => ({
			ele: p.ele,
			speed: fillMissingWithLastKnown(middle[`wind_speed_${p.hpa}hPa`], count, 0).map(Math.round),
			dir: fillMissingWithLastKnown(middle[`wind_direction_${p.hpa}hPa`], count, 0)
		}))
	};
}

export function describeCode(wmoCode: number): string {
	if (wmoCode === 0) return t.conditions.weather.clear;
	if (wmoCode <= 2) return t.conditions.weather.mostlySunny;
	if (wmoCode === 3) return t.conditions.weather.overcast;
	if (wmoCode <= 48) return t.conditions.weather.fog;
	if (wmoCode <= 57) return t.conditions.weather.drizzle;
	if (wmoCode <= 67) return t.conditions.weather.rain;
	if (wmoCode <= 77) return t.conditions.weather.snow;
	if (wmoCode <= 82) return t.conditions.weather.showers;
	if (wmoCode <= 86) return t.conditions.weather.snowShowers;
	return t.conditions.weather.thunderstorm;
}
