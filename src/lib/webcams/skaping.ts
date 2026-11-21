import { APP_USER_AGENT } from '#lib/identity.ts';
import { fetchJpegDimensions, measureCors } from './jpeg.ts';
import type { ResolvedWebcam, WebcamAdapter } from './types.ts';

const SKAPING_ARCHIVE_TIME_STEP_MINUTES = 10;
const SKAPING_UPDATE_INTERVAL_MINUTES = 10;
const MIN_PANORAMA_ASPECT_RATIO = 2.5;

const INITIAL_IMAGE_MEDIA_CONSTRUCTOR_PATTERN =
	/new ImageMedia\(([^,]+),\s*"([^"]+)",\s*DateUtil\.dbDateToDate\("([^"]+)"\)/;
const LAUNCHER_START_CAMERA_ID_PATTERN = /Launcher\.start\([^,]+,\s*['"](\d+)['"]/;
const HTML_TITLE_PATTERN = /<title>([^<]+)<\/title>/i;
const ELEVATION_METERS_FALLBACK_PATTERN = /(\d{3,4})\s*m\b/;
const DATED_ARCHIVE_IMAGE_PATH_PATTERN = /\/\d{4}\/\d{2}\/\d{2}\/\d{2}-\d{2}\.jpg$/;
const ARCHIVE_URL_DATE_TEMPLATE = '/{yyyy}/{mm}/{dd}/{hh}-{mi}.jpg';

interface SkapingConfig {
	camera?: {
		latitude?: string | number;
		longitude?: string | number;
		elevation?: number;
		fov?: number;
	};
	orientation?: number;
	infos?: {
		elevation?: number;
	};
}

function parseInlineLauncherConfig(html: string): SkapingConfig | null {
	const configStart = html.indexOf('Launcher.start(');
	if (configStart === -1) return null;
	const jsonStart = html.indexOf('{', configStart);
	const jsonEnd = html.lastIndexOf('});');
	if (jsonStart === -1 || jsonEnd === -1) return null;
	try {
		return JSON.parse(html.slice(jsonStart, jsonEnd + 1)) as SkapingConfig;
	} catch {
		return null;
	}
}

function extractElevationFallback(name: string, html: string): number | null {
	const elevationMatch =
		name.match(ELEVATION_METERS_FALLBACK_PATTERN) || html.match(ELEVATION_METERS_FALLBACK_PATTERN);
	return elevationMatch ? Number.parseInt(elevationMatch[1], 10) : null;
}

export const skapingAdapter: WebcamAdapter = {
	name: 'skaping',

	match(url: URL): boolean {
		return url.hostname.endsWith('skaping.com');
	},

	async resolve(url: URL, fetchFn: typeof fetch = fetch): Promise<ResolvedWebcam> {
		const pageRes = await fetchFn(url.href, {
			headers: { 'User-Agent': APP_USER_AGENT }
		});
		if (!pageRes.ok) {
			throw new Error(`Failed to load Skaping page ${url.href}: HTTP ${pageRes.status}`);
		}
		const html = await pageRes.text();

		const imageMatch = html.match(INITIAL_IMAGE_MEDIA_CONSTRUCTOR_PATTERN);
		if (!imageMatch) {
			throw new Error(`Could not find current image data on Skaping page ${url.href}`);
		}

		const rawUrl = imageMatch[2];
		const imageUrl = rawUrl.startsWith('//') ? `https:${rawUrl}` : rawUrl;
		const captureTimeString = imageMatch[3];

		const camIdMatch = html.match(LAUNCHER_START_CAMERA_ID_PATTERN);
		const camId = camIdMatch ? camIdMatch[1] : url.pathname.split('/').filter(Boolean).join('-');

		const titleMatch = html.match(HTML_TITLE_PATTERN);
		const name = titleMatch
			? titleMatch[1].replace(/^Webcam\s*-\s*/i, '').trim()
			: `Skaping ${camId}`;

		let lat: number | null = null;
		let lon: number | null = null;
		let ele: number | null = null;
		let viewingDirection: number | null = null;
		let fieldOfView: number | null = null;

		const config = parseInlineLauncherConfig(html);
		if (config) {
			if (config.camera?.latitude != null && config.camera?.longitude != null) {
				lat = Number.parseFloat(String(config.camera.latitude));
				lon = Number.parseFloat(String(config.camera.longitude));
			}
			if (config.camera?.elevation != null) {
				ele = config.camera.elevation;
			} else if (config.infos?.elevation != null) {
				ele = config.infos.elevation;
			}
			if (config.orientation != null) {
				viewingDirection = config.orientation;
			}
			if (config.camera?.fov != null) {
				fieldOfView = config.camera.fov;
			}
		}

		if (ele == null) {
			ele = extractElevationFallback(name, html);
		}

		const [cors, dims] = await Promise.all([
			measureCors(imageUrl, fetchFn),
			fetchJpegDimensions(imageUrl, fetchFn)
		]);

		let archiveUrlPattern: string | null = null;
		if (imageUrl.match(DATED_ARCHIVE_IMAGE_PATH_PATTERN)) {
			archiveUrlPattern = imageUrl.replace(
				DATED_ARCHIVE_IMAGE_PATH_PATTERN,
				ARCHIVE_URL_DATE_TEMPLATE
			);
		}

		const isPanorama =
			dims.width > 0 && dims.height > 0 && dims.width / dims.height >= MIN_PANORAMA_ASPECT_RATIO;

		return {
			provider: 'skaping',
			cameraId: camId,
			canonicalPageUrl: url.origin + url.pathname,
			name,
			imageUrl,
			archiveUrlPattern,
			archiveTimeStepMin: SKAPING_ARCHIVE_TIME_STEP_MINUTES,
			archiveHistoryDays: null,
			width: dims.width,
			height: dims.height,
			panorama: isPanorama,
			tileLayout: null,
			position: lat != null && lon != null ? { lat, lon } : null,
			elevation: ele,
			viewingDirection,
			fieldOfView,
			cors,
			updateIntervalMin: SKAPING_UPDATE_INTERVAL_MINUTES,
			newestPictureTime: new Date(captureTimeString.replace(' ', 'T')).toISOString()
		};
	}
};
