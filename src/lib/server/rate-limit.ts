import { error } from '@sveltejs/kit';

interface Bucket {
	count: number;
	resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 5_000;

function evictExpiredOrOldestBuckets(now: number): void {
	for (const [key, bucket] of buckets) {
		if (bucket.resetAt <= now) buckets.delete(key);
	}
	if (buckets.size >= MAX_KEYS) {
		const oldestInsertedKey = buckets.keys().next().value;
		if (oldestInsertedKey !== undefined) buckets.delete(oldestInsertedKey);
	}
}

export function clientIp(request: Request): string {
	return (
		request.headers.get('cf-connecting-ip') ||
		request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
		'unknown'
	);
}

export interface LimitResult {
	ok: boolean;
	remaining: number;
	retryAfter: number;
}

export function take(key: string, limit: number, windowMs: number, now = Date.now()): LimitResult {
	if (buckets.size >= MAX_KEYS) {
		evictExpiredOrOldestBuckets(now);
	}

	const bucket = buckets.get(key);
	if (!bucket || bucket.resetAt <= now) {
		buckets.set(key, { count: 1, resetAt: now + windowMs });
		return { ok: true, remaining: limit - 1, retryAfter: 0 };
	}
	if (bucket.count >= limit) {
		const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
		return {
			ok: false,
			remaining: 0,
			retryAfter: retryAfterSeconds
		};
	}
	bucket.count += 1;
	return { ok: true, remaining: limit - bucket.count, retryAfter: 0 };
}

export function enforce(
	request: Request,
	endpointNamespace: string,
	limit: number,
	windowMs: number
): void {
	const ip = clientIp(request);
	const scopedKey = `${endpointNamespace}:${ip}`;
	const result = take(scopedKey, limit, windowMs);
	if (!result.ok) {
		console.warn('rate_limit_rejected', {
			route: endpointNamespace,
			retryAfter: result.retryAfter
		});
		error(429, `Too many requests. Try again in ${result.retryAfter} seconds.`);
	}
}
