import { APP_USER_AGENT } from '#lib/identity.ts';
import { probeImage } from './image.ts';
import type { ResolvedWebcam, WebcamAdapter } from './types.ts';

const ORIGIN = 'https://app.webcam-hd.com';
const STANDARD_PANORAMA_SIZE = '1080';
const FULL_PANORAMA_SIZE = 'mega';
const MIN_PANORAMA_ASPECT_RATIO = 2.5;

interface WebcamHdPageInitialData {
	group?: { webcam_display_id?: string | number };
	config?: {
		id_cam?: string;
		id_app?: string | number;
		label_site?: string;
		label_place?: string;
		latitude?: string | number;
		longitude?: string | number;
		altitude?: string | number;
		altitude_unit?: string;
		resolutionX?: number;
		resolutionY?: number;
	};
	live?: { capturedAt?: string } | null;
}

const finite = (v: unknown): number | null => {
	const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
	return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

function parseNextJsFlightData(html: string): string {
	let flightDataAccumulator = '';
	for (const match of html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)) {
		try {
			flightDataAccumulator += JSON.parse(match[1]) as string;
		} catch {
			continue;
		}
	}
	return flightDataAccumulator;
}

function findJsonObjectFollowingMarker(text: string, marker: string): unknown {
	const start = text.indexOf(marker);
	if (start < 0) return null;
	const open = start + marker.length;
	if (text[open] !== '{') return null;
	let depth = 0;
	let inString = false;
	for (let i = open; i < text.length; i++) {
		const c = text[i];
		if (inString) {
			if (c === '\\') i++;
			else if (c === '"') inString = false;
		} else if (c === '"') inString = true;
		else if (c === '{') depth++;
		else if (c === '}' && --depth === 0) {
			try {
				return JSON.parse(text.slice(open, i + 1));
			} catch {
				return null;
			}
		}
	}
	return null;
}

export const webcamHdAdapter: WebcamAdapter = {
	name: 'webcam-hd',

	match(url: URL): boolean {
		const host = url.hostname.toLowerCase();
		return (
			(host === 'webcam-hd.com' || host.endsWith('.webcam-hd.com')) &&
			url.pathname.split('/').filter(Boolean).length >= 2
		);
	},

	async resolve(url: URL, fetchFn: typeof fetch = fetch): Promise<ResolvedWebcam> {
		const [location, webcamId] = url.pathname.split('/').filter(Boolean);
		const page = `${ORIGIN}/${location}/${webcamId}`;
		const pageRes = await fetchFn(page, { headers: { 'User-Agent': APP_USER_AGENT } });
		if (!pageRes.ok)
			throw new Error(`Failed to load webcam-hd.com page ${page}: HTTP ${pageRes.status}`);
		const html = await pageRes.text();

		const initialData = findJsonObjectFollowingMarker(
			parseNextJsFlightData(html),
			'"initialData":'
		) as WebcamHdPageInitialData | null;
		const config = initialData?.config;
		if (!config) throw new Error(`No camera data on webcam-hd.com page ${page}`);
		const ogImageRegex =
			/\/api\/webcam-image\/panorama\/([^/"\\]+)\/mega_[^"\\?/]+\.jpg\?config=(\d+)/;
		const ogImageMatch = html.match(ogImageRegex);
		const pictureServiceCamId = ogImageMatch?.[1] ?? config.id_cam;
		const pictureServiceAppId =
			ogImageMatch?.[2] ?? config.id_app ?? initialData?.group?.webcam_display_id;
		if (!pictureServiceCamId || pictureServiceAppId === undefined)
			throw new Error(`No picture address on webcam-hd.com page ${page}`);

		const picture = (size: string) =>
			`${ORIGIN}/api/webcam-image/panorama/${pictureServiceCamId}/${size}_${pictureServiceCamId}.jpg?config=${pictureServiceAppId}`;
		let imageUrl = picture(STANDARD_PANORAMA_SIZE);
		let probe;
		try {
			probe = await probeImage(imageUrl, fetchFn, { head: false });
		} catch (standardResolutionError) {
			imageUrl = picture(FULL_PANORAMA_SIZE);
			try {
				probe = await probeImage(imageUrl, fetchFn, { head: false });
			} catch {
				throw standardResolutionError;
			}
		}

		const lat = finite(config?.latitude);
		const lon = finite(config?.longitude);
		const altitude = finite(config?.altitude);
		const fullWidth = finite(config?.resolutionX);
		const fullHeight = finite(config?.resolutionY);
		const captured = initialData?.live?.capturedAt ? new Date(initialData.live.capturedAt) : null;
		const title = [config?.label_site, config?.label_place].filter(Boolean).join(' - ');

		return {
			provider: 'webcam-hd',
			cameraId: String(pictureServiceCamId),
			canonicalPageUrl: page,
			name:
				title || html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() || String(pictureServiceCamId),
			imageUrl,
			archiveUrlPattern: null,
			archiveTimeStepMin: null,
			archiveHistoryDays: null,
			width: probe.width,
			height: probe.height,
			panorama: probe.height > 0 && probe.width / probe.height >= MIN_PANORAMA_ASPECT_RATIO,
			tileLayout: null,
			position: lat !== null && lon !== null ? { lat, lon } : null,
			elevation: altitude !== null && (config?.altitude_unit ?? 'm') === 'm' ? altitude : null,
			viewingDirection: null,
			fieldOfView: null,
			cors: probe.cors,
			updateIntervalMin: null,
			newestPictureTime:
				captured && !Number.isNaN(captured.getTime()) ? captured.toISOString() : probe.lastModified,
			fullImageUrl: picture(FULL_PANORAMA_SIZE),
			fullWidth,
			fullHeight
		};
	}
};
