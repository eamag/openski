import { locale } from '#lib/i18n/intl.ts';

type EventName =
	'page_view' | 'route_calculated' | 'offline_saved' | 'queue_checked' | 'osm_edit' | 'vitals';

interface EventPayload {
	event: EventName;
	route?: string;
	resort?: string;
	referrer?: string;
	utmSource?: string;
	utmCampaign?: string;
	viewport?: string;
	locale?: string;
	detail?: string;
	flag?: number;
	v1?: number;
	v2?: number;
	v3?: number;
	v4?: number;
}

const ENDPOINT = '/api/event';

let initialized = false;
let landingSent = false;
let initialReferrer = 'direct';
let initialUtmSource = '';
let initialUtmCampaign = '';
let lastPageKey = '';
let lastRouteKey = '';

let fcpMs = 0;
let lcpMs = 0;
let clsScore = 0;
let timeToMapMs = 0;
let initialRouteId = '';
let initialResort = '';
let vitalsSent = false;
let vitalsInitialized = false;

function captureLandingContext(): void {
	if (initialized || typeof window === 'undefined') return;
	initialized = true;
	try {
		if (document.referrer) {
			const ref = new URL(document.referrer);
			if (ref.hostname && ref.hostname !== location.hostname) {
				initialReferrer = ref.hostname;
			}
		}
		const params = new URLSearchParams(location.search);
		initialUtmSource = (params.get('utm_source') ?? '').trim().slice(0, 60);
		const medium = (params.get('utm_medium') ?? '').trim();
		const campaign = (params.get('utm_campaign') ?? '').trim();
		initialUtmCampaign = [medium, campaign].filter(Boolean).join('/').slice(0, 80);
	} catch {
		// Ignore malformed referrer or URLs.
	}
}

function viewportKind(): 'mobile' | 'desktop' {
	return typeof window !== 'undefined' && window.innerWidth < 768 ? 'mobile' : 'desktop';
}

function send(payload: EventPayload): void {
	if (typeof window === 'undefined') return;
	try {
		const body = JSON.stringify({
			...payload,
			viewport: viewportKind(),
			locale
		});
		if (navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: 'application/json' }))) return;
		void fetch(ENDPOINT, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body,
			keepalive: true
		}).catch(() => undefined);
	} catch {
		// Never surface analytics failures.
	}
}

export function trackPageView(params: { routeId: string; path: string; resort?: string }): void {
	captureLandingContext();
	const key = `${params.routeId}:${params.path}`;
	if (key === lastPageKey) return;
	lastPageKey = key;

	const isLanding = !landingSent;
	if (isLanding) {
		landingSent = true;
		initialRouteId = params.routeId;
		initialResort = params.resort ?? '';
	}

	send({
		event: 'page_view',
		route: params.routeId,
		resort: params.resort ?? '',
		referrer: isLanding ? initialReferrer : '',
		utmSource: isLanding ? initialUtmSource : '',
		utmCampaign: isLanding ? initialUtmCampaign : '',
		detail: params.path.slice(0, 160),
		flag: isLanding ? 1 : 0
	});
}

export function trackRouteCalculated(params: {
	resort: string;
	key: string;
	fromKind: string;
	toKind: string;
	maxDifficulty: string;
	durationS: number;
	lengthM: number;
	steps: number;
}): void {
	captureLandingContext();
	if (!params.key || params.key === lastRouteKey) return;
	lastRouteKey = params.key;

	send({
		event: 'route_calculated',
		route: '/(app)/[resort]/route',
		resort: params.resort,
		referrer: initialReferrer,
		utmSource: initialUtmSource,
		utmCampaign: initialUtmCampaign,
		detail: `${params.fromKind}->${params.toKind}|${params.maxDifficulty}`,
		flag: 1,
		v1: Math.round(params.durationS),
		v2: Math.round(params.lengthM),
		v3: params.steps
	});
}

export function trackEvent(
	event: Exclude<EventName, 'page_view' | 'route_calculated' | 'vitals'>,
	params: { resort?: string; routeId?: string; detail?: string } = {}
): void {
	captureLandingContext();
	send({
		event,
		route: params.routeId ?? '',
		resort: params.resort ?? '',
		referrer: initialReferrer,
		utmSource: initialUtmSource,
		utmCampaign: initialUtmCampaign,
		detail: params.detail ?? '',
		flag: 1
	});
}

export function markTimeToMap(ms: number): void {
	if (!timeToMapMs && Number.isFinite(ms) && ms > 0) {
		timeToMapMs = Math.round(ms);
	}
}

function flushVitals(): void {
	if (vitalsSent) return;
	if (!fcpMs && !lcpMs && !timeToMapMs) return;
	vitalsSent = true;
	send({
		event: 'vitals',
		route: initialRouteId,
		resort: initialResort,
		referrer: initialReferrer,
		detail: 'cwv',
		flag: 1,
		v1: Math.round(lcpMs),
		v2: Math.round(fcpMs),
		v3: Math.round(clsScore * 1000),
		v4: Math.round(timeToMapMs)
	});
}

export function initVitalsTracking(): () => void {
	if (
		vitalsInitialized ||
		typeof window === 'undefined' ||
		typeof PerformanceObserver === 'undefined'
	) {
		return () => {};
	}
	vitalsInitialized = true;
	const observers: PerformanceObserver[] = [];

	const observe = (type: string, onEntry: (entries: PerformanceEntry[]) => void) => {
		try {
			const observer = new PerformanceObserver((list) => onEntry(list.getEntries()));
			observer.observe({ type, buffered: true } as PerformanceObserverInit);
			observers.push(observer);
		} catch {
			// Unsupported entryType in this browser.
		}
	};

	observe('paint', (entries) => {
		for (const entry of entries) {
			if (entry.name === 'first-contentful-paint') fcpMs = entry.startTime;
		}
	});
	observe('largest-contentful-paint', (entries) => {
		const last = entries[entries.length - 1];
		if (last) lcpMs = last.startTime;
	});
	observe('layout-shift', (entries) => {
		for (const entry of entries as (PerformanceEntry & {
			value?: number;
			hadRecentInput?: boolean;
		})[]) {
			if (!entry.hadRecentInput && typeof entry.value === 'number') clsScore += entry.value;
		}
	});

	const onVisibility = () => {
		if (document.visibilityState === 'hidden') flushVitals();
	};
	document.addEventListener('visibilitychange', onVisibility);
	window.addEventListener('pagehide', flushVitals);

	return () => {
		for (const observer of observers) observer.disconnect();
		document.removeEventListener('visibilitychange', onVisibility);
		window.removeEventListener('pagehide', flushVitals);
	};
}
