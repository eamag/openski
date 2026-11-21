import { LIGHTS, scoreWord, SURFACES } from '#lib/conditions/model.ts';
import { en } from '#lib/i18n/en/index.ts';
import { describeCode } from '#lib/conditions/weather.ts';
import type { ResortData } from '#lib/resort/types.ts';
import type { SnapshotHour, SnapshotInput, SnapshotLift, SnapshotPiste } from '#lib/snapshot.ts';

export const SNAPSHOT_KEEP_MS = 7 * 24 * 3600_000;

const isObject = (v: unknown): v is Record<string, unknown> =>
	typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, lo: number, hi: number): number => {
	if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi)
		throw new Error('a number is out of range');
	return Math.round(v * 10) / 10;
};
const bool = (v: unknown): boolean | null => (v === true ? true : v === false ? false : null);

export function parseSnapshot(body: unknown, data: ResortData): SnapshotInput {
	if (!isObject(body)) throw new Error('the body must be an object');
	if (body.resort !== data.id) throw new Error('wrong resort');
	if (typeof body.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.date))
		throw new Error('date');
	if (typeof body.time !== 'string' || !/^\d{2}:\d{2}$/.test(body.time)) throw new Error('time');
	// Older clients sent European colours.
	const legacy: Record<string, SnapshotInput['level']> = {
		blue: 'easy',
		red: 'intermediate',
		black: 'advanced'
	};
	const level =
		(['all', 'easy', 'intermediate', 'advanced'] as const).find((l) => l === body.level) ??
		legacy[String(body.level)] ??
		'all';
	if (!Array.isArray(body.hours) || body.hours.length > 24) throw new Error('hours');
	const hours: SnapshotHour[] = body.hours.map((h: unknown) => {
		if (!isObject(h) || !isObject(h.low) || !isObject(h.high)) throw new Error('hour');
		const level = (x: Record<string, unknown>) => ({
			ele: num(x.ele, -500, 9000),
			temp: num(x.temp, -80, 60),
			wind: num(x.wind, 0, 400)
		});
		return {
			hour: num(h.hour, 0, 23),
			score: num(h.score, 0, 100),
			low: level(h.low),
			high: level(h.high),
			windDir: num(h.windDir, 0, 360),
			cloud: num(h.cloud, 0, 100),
			snowfall: num(h.snowfall, 0, 500),
			code: num(h.code, 0, 99)
		};
	});
	const now = num(body.now, 0, Math.max(0, hours.length - 1));
	if (!Array.isArray(body.pistes) || body.pistes.length > data.pistes.length)
		throw new Error('pistes');
	const pistes: SnapshotPiste[] = body.pistes.map((p: unknown) => {
		if (!isObject(p)) throw new Error('piste');
		const i = num(p.i, 0, data.pistes.length - 1);
		const surface = SURFACES.find((s) => s === p.surface);
		const light = LIGHTS.find((s) => s === p.light);
		if (!surface || !light) throw new Error('surface or light');
		if (!Array.isArray(p.day) || p.day.length !== hours.length) throw new Error('piste day');
		return {
			i,
			open: bool(p.open),
			score: num(p.score, 0, 100),
			surface,
			light,
			windKmh: num(p.windKmh, 0, 400),
			temp: num(p.temp, -80, 60),
			day: p.day.map((s: unknown) => (s === null ? null : num(s, 0, 100)))
		};
	});
	if (!Array.isArray(body.lifts) || body.lifts.length > data.lifts.length) throw new Error('lifts');
	const lifts: SnapshotLift[] = body.lifts.map((l: unknown) => {
		if (!isObject(l)) throw new Error('lift');
		const out: SnapshotLift = { i: num(l.i, 0, data.lifts.length - 1), open: bool(l.open) };
		if (l.people !== undefined) out.people = num(l.people, 0, 5000);
		if (l.waitS !== undefined) out.waitS = num(l.waitS, 0, 36000);
		if (typeof l.frame === 'string' && /^\d{2}:\d{2}$/.test(l.frame)) out.frame = l.frame;
		return out;
	});
	return { resort: data.id, date: body.date, time: body.time, level, hours, now, pistes, lifts };
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const COLOUR: Record<string, string> = {
	novice: 'beginner',
	easy: 'blue',
	intermediate: 'red',
	advanced: 'black',
	expert: 'black',
	freeride: 'ski route'
};
const LEVEL_RANKS: Record<SnapshotInput['level'], string[]> = {
	all: [],
	easy: ['novice', 'easy'],
	intermediate: ['intermediate'],
	advanced: ['advanced', 'expert', 'freeride']
};
const cell = (s: string) => s.replace(/\|/g, '/').replace(/\s+/g, ' ').trim();
const MAX_PISTES_IN_ASSISTANT_REPORT = 80;
const NEAR_PEAK_SCORE_THRESHOLD = 4;
const minutes = (s: number) => (s < 90 ? 'under 2 min' : `about ${Math.round(s / 60)} min`);

export function renderSnapshot(data: ResortData, s: SnapshotInput, origin: string): string {
	const app = `${origin}/${data.id}`;
	const pisteLink = (i: number) => `${app}?piste=${encodeURIComponent(data.pistes[i].id)}`;
	const liftLink = (i: number) => `${app}?lift=${encodeURIComponent(data.lifts[i].id)}`;
	const pisteName = (i: number) => {
		const p = data.pistes[i];
		return p.ref && p.title
			? `${p.ref} · ${p.title}`
			: p.ref
				? `Piste ${p.ref}`
				: (p.title ?? 'Unnamed piste');
	};
	const at = s.hours[s.now];
	const out: string[] = [];
	out.push(`# ${data.name} at ${s.time} on ${s.date}`);
	out.push('');
	out.push(
		`A snapshot from openski.org (${app}), made by a rider looking at the resort. Piste conditions are estimates ` +
			`from the weather forecast, the sun and the terrain (0 = poor, 100 = great); open and closed come from the ` +
			`resort's live status feed; lift queues were counted on webcams.`
	);
	out.push('');
	out.push(
		`**For AI assistants:** suggest what to ski for the rest of the day from the tables below (which pistes when, ` +
			`which lifts to take, what to avoid and why). Never suggest a piste or lift marked closed. Whenever you name a ` +
			`piste or lift, link it with the link from its row, so the rider can open it on the map. The live version of ` +
			`these numbers is ${app}/now.`
	);
	if (s.level !== 'all') {
		out.push('');
		out.push(`The rider was looking at ${s.level} pistes.`);
	}

	if (s.hours.length) {
		out.push('', '## Weather', '');
		const low = s.hours[0].low.ele;
		const high = s.hours[0].high.ele;
		out.push(
			`| Hour | ${low} m | ${high} m | Wind at ${high} m | Cloud | New snow | Sky | All pistes |`
		);
		out.push('|---|---|---|---|---|---|---|---|');
		for (const h of s.hours) {
			out.push(
				`| ${String(h.hour).padStart(2, '0')}:00${h === at ? ' (now)' : ''} | ${Math.round(h.low.temp)} °C | ` +
					`${Math.round(h.high.temp)} °C | ${Math.round(h.high.wind)} km/h ${COMPASS[Math.round(h.windDir / 45) % 8]} | ` +
					`${Math.round(h.cloud)} % | ${h.snowfall} cm | ${cell(describeCode(h.code))} | ${Math.round(h.score)} |`
			);
		}
	}

	const rank = (p: SnapshotPiste) => p.score;
	const shown = s.pistes.filter((p) => p.open !== false);
	const wanted = LEVEL_RANKS[s.level];
	const order = [...shown].sort(
		(a, b) =>
			Number(wanted.length > 0 && !wanted.includes(data.pistes[a.i].difficulty)) -
				Number(wanted.length > 0 && !wanted.includes(data.pistes[b.i].difficulty)) ||
			rank(b) - rank(a)
	);
	out.push(
		'',
		`## Pistes not reported closed, best ${at ? `at ${String(at.hour).padStart(2, '0')}:00` : 'now'} first`,
		''
	);
	out.push('| Piste | Colour | Score | Snow | Light | Wind | Best hours | Open | Link |');
	out.push('|---|---|---|---|---|---|---|---|---|');
	for (const p of order.slice(0, MAX_PISTES_IN_ASSISTANT_REPORT)) {
		const maxScore = Math.max(...p.day.map((x) => x ?? 0));
		const goodHours = s.hours
			.filter((_, k) => (p.day[k] ?? -1) >= maxScore - NEAR_PEAK_SCORE_THRESHOLD)
			.map((h) => h.hour);
		const bestHoursLabel = goodHours.length
			? `${goodHours[0]}–${goodHours[goodHours.length - 1] + 1}h`
			: '';
		out.push(
			`| ${cell(pisteName(p.i))} | ${COLOUR[data.pistes[p.i].difficulty] ?? data.pistes[p.i].difficulty} | ` +
				`${Math.round(p.score)} ${scoreWord(p.score).toLowerCase()} | ${en.conditions.surface[p.surface]} | ${en.conditions.light[p.light]} | ` +
				`${Math.round(p.windKmh)} km/h | ${bestHoursLabel} | ${p.open === true ? 'yes' : 'not reported'} | ${pisteLink(p.i)} |`
		);
	}

	if (order.length > MAX_PISTES_IN_ASSISTANT_REPORT)
		out.push(
			'',
			`(${order.length - MAX_PISTES_IN_ASSISTANT_REPORT} more open pistes scored lower.)`
		);

	out.push('', '## Lifts', '');
	out.push('| Lift | Open | Queue on webcam | Link |');
	out.push('|---|---|---|---|');
	const lifts = [...s.lifts].sort(
		(a, b) =>
			Number(a.open === false) - Number(b.open === false) ||
			Number(b.people != null) - Number(a.people != null)
	);
	for (const l of lifts) {
		const queue =
			l.people != null
				? `${l.people} ${l.people === 1 ? 'person' : 'people'}${l.waitS != null ? `, ${minutes(l.waitS)}` : ''}${l.frame ? ` (${l.frame})` : ''}`
				: '';
		out.push(
			`| ${cell(data.lifts[l.i].name)} | ${l.open === true ? 'yes' : l.open === false ? 'closed' : 'not reported'} | ${queue} | ${liftLink(l.i)} |`
		);
	}

	const closed = s.pistes.filter((p) => p.open === false);
	if (closed.length) {
		out.push('', '## Pistes closed today', '');
		out.push(closed.map((p) => cell(pisteName(p.i))).join(', '));
	}
	out.push('', `Made with openski.org: ${origin}`);
	return out.join('\n') + '\n';
}
