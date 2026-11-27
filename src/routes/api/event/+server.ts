import { env } from 'cloudflare:workers';
import { readJsonBody } from '#lib/server/body.ts';
import { clientIp, take } from '#lib/server/rate-limit.ts';
import type { RequestHandler } from './$types';

const MAX_EVENT_BODY_BYTES = 2048;
const RATE_LIMIT_MAX_EVENTS = 120;
const RATE_LIMIT_WINDOW_MS = 60_000;
const BOT_USER_AGENT = /(bot|crawl|spider|slurp|cloudflare-ai-search)/i;
const ALLOWED_EVENTS = new Set([
	'page_view',
	'route_calculated',
	'offline_saved',
	'queue_checked',
	'osm_edit',
	'vitals'
]);

const cleanString = (value: unknown, maxLen: number): string =>
	typeof value === 'string' ? value.trim().slice(0, maxLen) : '';

const cleanNumber = (value: unknown): number =>
	typeof value === 'number' && Number.isFinite(value) ? value : 0;

export const POST: RequestHandler = async ({ request, platform }) => {
	const userAgent = request.headers.get('user-agent') ?? '';
	if (BOT_USER_AGENT.test(userAgent)) {
		return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
	}

	if (!take(`event:${clientIp(request)}`, RATE_LIMIT_MAX_EVENTS, RATE_LIMIT_WINDOW_MS).ok) {
		return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
	}

	let body: unknown;
	try {
		body = await readJsonBody(request, MAX_EVENT_BODY_BYTES);
	} catch {
		return new Response(null, { status: 400, headers: { 'cache-control': 'no-store' } });
	}
	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		return new Response(null, { status: 400, headers: { 'cache-control': 'no-store' } });
	}

	const payload = body as Record<string, unknown>;
	const event = cleanString(payload.event, 32);
	if (!ALLOWED_EVENTS.has(event)) {
		return new Response(null, { status: 400, headers: { 'cache-control': 'no-store' } });
	}

	const analytics = (env as Partial<Env>).ANALYTICS;
	if (analytics) {
		const route = cleanString(payload.route, 80);
		const resort = cleanString(payload.resort, 80);
		const referrer = cleanString(payload.referrer, 120) || 'direct';
		const utmSource = cleanString(payload.utmSource, 60);
		const utmCampaign = cleanString(payload.utmCampaign, 80);
		const viewport = cleanString(payload.viewport, 16);
		const locale = cleanString(payload.locale, 12);
		const detail = cleanString(payload.detail, 160);
		const country = typeof platform?.cf?.country === 'string' ? platform.cf.country : '';
		const indexKey = (resort ? `${event}:${resort}` : event).slice(0, 96);

		try {
			analytics.writeDataPoint({
				indexes: [indexKey],
				blobs: [
					event,
					route,
					resort,
					referrer,
					utmSource,
					utmCampaign,
					viewport,
					locale,
					detail,
					country
				],
				doubles: [
					cleanNumber(payload.flag),
					cleanNumber(payload.v1),
					cleanNumber(payload.v2),
					cleanNumber(payload.v3),
					cleanNumber(payload.v4)
				]
			});
		} catch {
			// Analytics never interrupts the response.
		}
	}

	return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
};
