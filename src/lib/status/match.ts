import type { Lift, Piste } from '../resort/types.ts';
import { DRAG_LIFTS } from '../resort/types.ts';
import type { LiftKind, ResortStatus } from './intermaps.ts';

const LIFT_STOP = new Set([
	'de',
	'du',
	'des',
	'le',
	'la',
	'les',
	'et',
	'd',
	'l',
	'mit',
	'di',
	'del',
	'della',
	'er'
]);
const LIFT_GENERIC =
	/^(?:(?:zweier|dreier|vierer|sechser|achter|doppel|einer)?(?:sessel|schlepp|teller|gondel|kabinen|luftseil|standseil|seil)|tele(?:siege|ski|cabine|pherique|mix)|funitel|seggiovia|cabinovia|funivia|sciovia|bubbles?|express|xpress|sektion|section|\d+er|ts[dfk]?\d*|t[ck]d?|tph|eub|sb|sk|ksb|dsb|gb|cld)$/;
const LIFT_CODE =
	/^(?:\d*(?:TSD|TSF|TS|TKD|TK|TCD|TC|TD|TPH|TMX|SL|SB|SK|EUB|GUB|KSB|DSB|GB|KB)\d*|[A-Z]{1,2}\d{1,3}[a-z]?|\d{1,3}(?:er)?)$/;
const ROMAN: Record<string, string> = { i: '1', ii: '2', iii: '3', iv: '4', v: '5' };
const SECTION = /^(?:i{1,3}|iv|v|[1-9])$/;

export interface LiftKey {
	core: string;
	tokens: string[];
	section: string | null;
}

export function liftKey(name: string): LiftKey {
	const tokensOf = (raw: string, generic: boolean) => {
		let s = raw.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
		s = s.replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue');
		s = s
			.normalize('NFD')
			.replace(/\p{M}/gu, '')
			.toLowerCase()
			.replace(/bahn|lift/g, '');
		return s
			.split(/[^a-z0-9]+/)
			.filter(Boolean)
			.filter((t) => !LIFT_STOP.has(t) && !(generic && LIFT_GENERIC.test(t)));
	};
	name = name
		.replace(/&([a-zA-Z])(?:acute|grave|circ|uml|tilde|cedil|ring);/g, '$1')
		.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
		.replace(/&amp;/g, '&')
		.replace(/&[a-z]+;/g, ' ');
	const words = name.trim().split(/\s+/);
	while (words.length > 1) {
		const w = words[0].replace(/\.$/, '');
		const isSectionPrefix = words[0].endsWith('.') && /^(?:sektion|section)/i.test(words[1]);
		const code = LIFT_CODE.test(w) && !isSectionPrefix;
		const isShortAllCapsCode = /^\d*[A-Z]{1,4}$/.test(w);
		const hasSubsequentMixedCaseWords = /[a-z]/.test(words.slice(1).join(' '));
		const caps = isShortAllCapsCode && hasSubsequentMixedCaseWords;
		if (!code && !caps) break;
		words.shift();
	}
	const s = words.join(' ');
	let tokens = tokensOf(s, true);
	if (!tokens.length) tokens = tokensOf(s, false);
	if (!tokens.length) tokens = tokensOf(name, false);
	let section: string | null = null;
	const marks = tokens.filter((t) => SECTION.test(t));
	if (marks.length && marks.length < tokens.length) {
		const all = new Set(marks.map((t) => ROMAN[t] ?? t));
		if (all.size === 1) section = [...all][0];
		tokens = tokens.filter((t) => !SECTION.test(t));
	}
	return { core: tokens.join(''), tokens, section };
}

function editDistance(a: string, b: string): number {
	let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
	for (let i = 1; i <= a.length; i++) {
		const row = [i];
		for (let j = 1; j <= b.length; j++)
			row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
		prev = row;
	}
	return prev[b.length];
}

function partOf(short: LiftKey, long: LiftKey): boolean {
	const at = long.core.indexOf(short.core);
	if (short.core.length < 5 || at < 0) return false;
	const end = at + short.core.length;
	let pos = 0;
	let first = -1;
	let last = -1;
	const starts: number[] = [];
	const ends: number[] = [];
	long.tokens.forEach((t, i) => {
		starts.push(pos);
		pos += t.length;
		ends.push(pos);
		if (first < 0 && at < pos) first = i;
		if (last < 0 && end <= pos) last = i;
	});
	if (starts.includes(at) && ends.includes(end))
		return short.core.length / long.core.length >= 0.35;
	return first === last && short.core.length >= 7;
}

function nameLikeness(a: LiftKey, b: LiftKey): number {
	if (a.core === b.core) return 1;
	const [short, long] = a.core.length <= b.core.length ? [a, b] : [b, a];
	if (partOf(short, long)) return 0.8 + 0.2 * (short.core.length / long.core.length);
	return 1 - editDistance(a.core, b.core) / long.core.length;
}

const UNNAMED = new Set([
	'Cable car',
	'Gondola',
	'Lift',
	'Chairlift',
	'T-bar',
	'J-bar',
	'Platter lift',
	'Drag lift',
	'Rope tow',
	'Magic carpet'
]);

const LIFT_MATCH = 0.8;

function kindOf(lift: Lift): LiftKind {
	if (lift.type === 'gondola' || lift.type === 'cable_car' || lift.type === 'mixed_lift')
		return 'gondola';
	if (lift.type === 'chair_lift') return 'chair';
	return DRAG_LIFTS.has(lift.type) || lift.type === 'magic_carpet' ? 'drag' : 'other';
}

export function pisteNameKey(name: string): string {
	let s = name.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
	s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
	s = s.toLowerCase();
	const stop = new Set([
		'de',
		'du',
		'des',
		'le',
		'la',
		'les',
		'et',
		'd',
		'l',
		'a',
		'au',
		'aux',
		'en',
		'sur',
		'sous',
		'the'
	]);
	const tokens = s
		.split(/[^a-z0-9]+/)
		.filter(Boolean)
		.filter((t) => !stop.has(t));
	return tokens.join('');
}

function isNumRef(s: string): boolean {
	return /^\d+[a-z]?$/i.test(s.trim());
}

export function matchStatus(
	lifts: Lift[],
	pistes: Piste[],
	status: ResortStatus
): {
	lifts: (boolean | null)[];
	pistes: (boolean | null)[];
	liftFeedMatched: boolean[];
	pisteFeedMatched: boolean[];
} {
	const feed = status.lifts.map((l) => liftKey(l.name));
	const mine = lifts.map((l) => liftKey(l.name));
	const pairs: { m: number; f: number; score: number }[] = [];
	mine.forEach((a, m) => {
		if (!a.core || UNNAMED.has(lifts[m].name)) return;
		const kind = kindOf(lifts[m]);
		const mineAll: typeof pairs = [];
		feed.forEach((b, f) => {
			if (!b.core || (a.section && b.section && a.section !== b.section)) return;
			let score = nameLikeness(a, b);
			if (a.section !== b.section) score *= 0.95;
			const other = status.lifts[f].kind;
			if (other !== kind && other !== 'other' && kind !== 'other') score *= 0.85;
			if (score >= LIFT_MATCH) mineAll.push({ m, f, score });
		});
		mineAll.sort((x, y) => y.score - x.score);
		const [best, next] = mineAll;
		const isAmbiguousCandidateMatch =
			best &&
			next &&
			best.score < 1 &&
			next.score > best.score - 0.06 &&
			feed[next.f].core !== feed[best.f].core;
		if (isAmbiguousCandidateMatch) return;
		pairs.push(...mineAll);
	});
	pairs.sort((x, y) => y.score - x.score);
	const claimedBy = new Map<number, number>();
	const chosen = new Map<number, { f: number[]; score: number }>();
	const sameLift = (m1: number, m2: number, f: number) =>
		mine[m1].core === mine[m2].core && (mine[m1].section === mine[m2].section || !feed[f].section);
	for (const { m, f, score } of pairs) {
		const got = chosen.get(m);
		const owner = claimedBy.get(f);
		if (owner !== undefined && owner !== m && !sameLift(owner, m, f)) continue;
		if (got) {
			const isEquallyGoodAlternativeSection =
				score > got.score - 0.01 && feed[got.f[0]].core === feed[f].core;
			if (isEquallyGoodAlternativeSection) got.f.push(f);
			continue;
		}
		chosen.set(m, { f: [f], score });
		if (owner === undefined) claimedBy.set(f, m);
	}
	const liftFeedMatched = new Array(status.lifts.length).fill(false);
	const liftOpen = lifts.map((_, m) => {
		const got = chosen.get(m);
		if (!got) return null;
		for (const f of got.f) liftFeedMatched[f] = true;
		return got.f.every((f) => status.lifts[f].open);
	});

	const byNum = new Map<string, boolean>();
	const byName = new Map<string, boolean>();
	for (const p of status.pistes) {
		const r = (p.ref ?? '').trim();
		if (isNumRef(r)) {
			const k = r.toLowerCase();
			byNum.set(k, (byNum.get(k) ?? false) || p.open);
		} else if (r) {
			const k = pisteNameKey(r);
			if (k) byName.set(k, (byName.get(k) ?? false) || p.open);
		}
	}

	const pisteFeedMatched = new Array(status.pistes.length).fill(false);
	const pisteOpen = pistes.map((p) => {
		const ref = (p.ref ?? '').trim();
		if (ref && isNumRef(ref)) {
			const k = ref.toLowerCase();
			if (byNum.has(k)) {
				status.pistes.forEach((fp, i) => {
					if ((fp.ref ?? '').trim().toLowerCase() === k) pisteFeedMatched[i] = true;
				});
				return byNum.get(k) ?? null;
			}
			const base = k.match(/^(\d+)[a-z]$/)?.[1];
			if (base && byNum.get(base) === false) return false;
			if (p.title) {
				const nk = pisteNameKey(p.title);
				if (nk && byName.has(nk)) {
					status.pistes.forEach((fp, i) => {
						const fr = (fp.ref ?? '').trim();
						if (!isNumRef(fr) && pisteNameKey(fr) === nk) pisteFeedMatched[i] = true;
					});
					return byName.get(nk) ?? null;
				}
			}
			return null;
		}
		const name = (p.title || ref || '').trim();
		if (!name) return null;
		const nk = pisteNameKey(name);
		if (!nk || !byName.has(nk)) return null;
		status.pistes.forEach((fp, i) => {
			const fr = (fp.ref ?? '').trim();
			if (!isNumRef(fr) && pisteNameKey(fr) === nk) pisteFeedMatched[i] = true;
		});
		return byName.get(nk) ?? null;
	});

	return { lifts: liftOpen, pistes: pisteOpen, liftFeedMatched, pisteFeedMatched };
}
