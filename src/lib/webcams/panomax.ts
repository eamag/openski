import { APP_USER_AGENT } from '#lib/identity.ts';
import { measureCors } from './jpeg.ts';
import type { ResolvedWebcam, WebcamAdapter } from './types.ts';

interface PanomaxConfig {
	instance?: {
		id?: number;
		name?: string;
		cam?: {
			id?: number;
			latitude?: number;
			longitude?: number;
			zeroDirection?: number;
			viewAngle?: number;
			elevation?: number;
			firstPano?: string;
		};
	};
}

interface PanomaxDaySize {
	resolution: string;
	rows: number;
	cols: number;
	tileWidth: number;
	tileHeight: number;
}

interface PanomaxDayImage {
	time: string;
	available?: boolean;
}

interface PanomaxDayResponse {
	date?: string;
	sizes?: PanomaxDaySize[];
	images?: PanomaxDayImage[];
}

const DEFAULT_UPDATE_INTERVAL_MINUTES = 10;
const MAX_VALID_UPDATE_INTERVAL_MINUTES = 60;
const DEFAULT_PANORAMA_FIELD_OF_VIEW_DEGREES = 360;
const MILLISECONDS_PER_DAY = 1000 * 86_400;

function extractBootstrapInstanceId(html: string): string | null {
	const instanceIdMatch = html.match(/["']?iid["']?\s*:\s*(\d+)/);
	return instanceIdMatch ? instanceIdMatch[1] : null;
}

function extractFallbackCameraId(html: string): string | null {
	const cameraIdMatch =
		html.match(/var\s+camId\s*=\s*["'](\d+)["']/) || html.match(/[/]cams[/](\d+)[/]/);
	return cameraIdMatch ? cameraIdMatch[1] : null;
}

function parseTimeToMinutes(timeString: string): number {
	const [hours, minutes] = timeString.split(':').map(Number);
	return hours * 60 + minutes;
}

export const panomaxAdapter: WebcamAdapter = {
	name: 'panomax',

	match(url: URL): boolean {
		return url.hostname.endsWith('panomax.com');
	},

	async resolve(url: URL, fetchFn: typeof fetch = fetch): Promise<ResolvedWebcam> {
		const pageRes = await fetchFn(url.href, {
			headers: { 'User-Agent': APP_USER_AGENT }
		});
		if (!pageRes.ok) {
			throw new Error(`Failed to load Panomax page ${url.href}: HTTP ${pageRes.status}`);
		}
		const html = await pageRes.text();

		const instanceId = extractBootstrapInstanceId(html);

		let camId: string | null = null;
		let name = '';
		let lat: number | null = null;
		let lon: number | null = null;
		let elevation: number | null = null;
		let zeroDirection: number | null = null;
		let viewAngle: number | null = null;
		let firstPanoramaDate: string | null = null;

		if (instanceId) {
			const configRes = await fetchFn(
				`https://api.panomax.com/1.0/instances/${instanceId}/config/en-gb`,
				{
					headers: { 'User-Agent': APP_USER_AGENT }
				}
			);
			if (configRes.ok) {
				const config = (await configRes.json()) as PanomaxConfig;
				const cam = config.instance?.cam;
				if (cam?.id != null) camId = String(cam.id);
				name = config.instance?.name ?? '';
				lat = cam?.latitude ?? null;
				lon = cam?.longitude ?? null;
				elevation = cam?.elevation ?? null;
				zeroDirection = cam?.zeroDirection ?? null;
				viewAngle = cam?.viewAngle ?? null;
				firstPanoramaDate = cam?.firstPano ?? null;
			}
		}

		if (!camId) {
			camId = extractFallbackCameraId(html);
		}

		if (!camId) {
			throw new Error(`Could not determine Panomax camera ID from ${url.href}`);
		}

		let width = 0;
		let height = 0;
		let tileLayout: ResolvedWebcam['tileLayout'] = null;
		let newestPictureTime: string | null = null;
		let updateIntervalMin = DEFAULT_UPDATE_INTERVAL_MINUTES;

		const dayRes = await fetchFn(`https://api.panomax.com/1.0/cams/${camId}/images/day`, {
			headers: { 'User-Agent': APP_USER_AGENT }
		});

		if (dayRes.ok) {
			const dayResponse = (await dayRes.json()) as PanomaxDayResponse;
			const defaultSize = dayResponse.sizes?.find((size) => size.resolution === 'default');
			const fullSize = dayResponse.sizes?.find((size) => size.resolution === 'full');
			const origSize = dayResponse.sizes?.find((size) => size.resolution === 'original');

			if (defaultSize) {
				width = defaultSize.tileWidth;
				height = defaultSize.tileHeight;
			}

			if (fullSize && origSize) {
				tileLayout = {
					rows: fullSize.rows,
					cols: fullSize.cols,
					tileWidth: fullSize.tileWidth,
					tileHeight: fullSize.tileHeight,
					compositeWidth: origSize.tileWidth,
					compositeHeight: origSize.tileHeight,
					urlPattern: `https://panodata.panomax.com/cams/${camId}/{yyyy}/{mm}/{dd}/{hh}-{mi}-00_full_{col}_{row}.jpg`
				};
			}

			const availableImages = dayResponse.images?.filter((img) => img.available !== false) ?? [];
			if (availableImages.length > 0) {
				const latest = availableImages[availableImages.length - 1];
				newestPictureTime = dayResponse.date ? `${dayResponse.date} ${latest.time}` : latest.time;

				if (availableImages.length >= 2) {
					const previous = availableImages[availableImages.length - 2];
					const minutesDiff = parseTimeToMinutes(latest.time) - parseTimeToMinutes(previous.time);
					if (minutesDiff > 0 && minutesDiff <= MAX_VALID_UPDATE_INTERVAL_MINUTES) {
						updateIntervalMin = minutesDiff;
					}
				}
			}
		}

		let archiveHistoryDays: number | null = null;
		if (firstPanoramaDate) {
			const firstTimestampMs = new Date(firstPanoramaDate.replace(' ', 'T')).getTime();
			if (!Number.isNaN(firstTimestampMs)) {
				archiveHistoryDays = Math.max(
					0,
					Math.floor((Date.now() - firstTimestampMs) / MILLISECONDS_PER_DAY)
				);
			}
		}

		const imageUrl = `https://panodata.panomax.com/cams/${camId}/recent_default.jpg`;
		const archiveUrlPattern = `https://panodata.panomax.com/cams/${camId}/{yyyy}/{mm}/{dd}/{hh}-{mi}-00_default.jpg`;
		const cors = await measureCors(imageUrl, fetchFn);

		const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
		const htmlTitle = titleMatch?.[1]?.trim();

		return {
			provider: 'panomax',
			cameraId: camId,
			canonicalPageUrl: url.origin + url.pathname,
			name: name || htmlTitle || `Panomax ${camId}`,
			imageUrl,
			archiveUrlPattern,
			archiveTimeStepMin: updateIntervalMin,
			archiveHistoryDays,
			width,
			height,
			panorama: true,
			tileLayout,
			position: lat != null && lon != null ? { lat, lon } : null,
			elevation,
			viewingDirection: zeroDirection,
			fieldOfView: viewAngle ?? DEFAULT_PANORAMA_FIELD_OF_VIEW_DEGREES,
			cors,
			updateIntervalMin,
			newestPictureTime
		};
	}
};
