import { APP_USER_AGENT } from '#lib/identity.ts';
import { measureCors } from './jpeg.ts';
import type { ResolvedWebcam, WebcamAdapter } from './types.ts';

const DEFAULT_UPDATE_INTERVAL_MS = 600_000;
const MS_PER_MINUTE = 60_000;
const SECONDS_TO_MS = 1_000;

interface RoundshotSettings {
	id?: number;
	name?: string;
	url?: string;
	position?: {
		latitude?: number;
		longitude?: number;
		altitude?: number;
		north?: number;
		angle?: number;
	};
	interval?: number;
}

interface RoundshotImageStructure {
	w?: number;
	h?: number;
	x?: number;
	y?: number;
	url_full?: string;
	url_tile?: string;
}

interface RoundshotStructureResponse {
	camera?: string;
	images?: {
		id?: number;
		datetime?: number;
		tile?: { w?: number; h?: number };
		structure?: {
			full3?: RoundshotImageStructure;
			full2?: RoundshotImageStructure;
			full?: RoundshotImageStructure;
			half?: RoundshotImageStructure;
		};
	}[];
}

function extractCameraBaseUrl(url: URL): string {
	const pathnameWithoutTrailingSlash = url.pathname.replace(/\/+$/, '');
	const pathSegments = pathnameWithoutTrailingSlash.split('/').filter(Boolean);
	const cameraBasePath = pathSegments.length > 0 ? `/${pathSegments[0]}/` : '/';
	return `${url.origin}${cameraBasePath}`;
}

function extractArchiveUrlPattern(imageUrl: string): string | null {
	const archiveTimestampPattern =
		/\/\d{4}-\d{2}-\d{2}\/\d{2}-\d{2}-\d{2}\/\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}_/;
	const parameterizedArchiveTemplate =
		'/{yyyy}-{mm}-{dd}/{hh}-{mi}-00/{yyyy}-{mm}-{dd}-{hh}-{mi}-00_';
	const archiveUrlPattern = imageUrl.replace(archiveTimestampPattern, parameterizedArchiveTemplate);
	return archiveUrlPattern !== imageUrl ? archiveUrlPattern : null;
}

export const roundshotAdapter: WebcamAdapter = {
	name: 'roundshot',

	match(url: URL): boolean {
		return url.hostname.endsWith('roundshot.com');
	},

	async resolve(url: URL, fetchFn: typeof fetch = fetch): Promise<ResolvedWebcam> {
		const baseUrl = extractCameraBaseUrl(url);
		const pathSegments = url.pathname.replace(/\/+$/, '').split('/').filter(Boolean);

		const [settingsRes, structureRes] = await Promise.all([
			fetchFn(`${baseUrl}settings.json`, { headers: { 'User-Agent': APP_USER_AGENT } }),
			fetchFn(`${baseUrl}structure.json`, { headers: { 'User-Agent': APP_USER_AGENT } })
		]);

		if (!settingsRes.ok || !structureRes.ok) {
			throw new Error(`Failed to load Roundshot metadata from ${baseUrl}`);
		}

		const settings = (await settingsRes.json()) as RoundshotSettings;
		const structure = (await structureRes.json()) as RoundshotStructureResponse;

		const camId =
			settings.id != null ? String(settings.id) : pathSegments[0] || url.hostname.split('.')[0];
		const name = settings.name || structure.camera || camId;

		const latest = structure.images?.[0];
		const struct = latest?.structure?.full3 || latest?.structure?.full2 || latest?.structure?.full;
		const imageUrl = struct?.url_full || latest?.structure?.half?.url_full || '';

		const width = struct?.w || latest?.structure?.half?.w || 0;
		const height = struct?.h || latest?.structure?.half?.h || 0;

		let tileLayout: ResolvedWebcam['tileLayout'] = null;
		if (struct && struct.x && struct.y && latest?.tile?.w && latest?.tile?.h) {
			const cols = struct.x;
			const rows = struct.y;
			const tileWidth = latest.tile.w;
			const tileHeight = latest.tile.h;
			tileLayout = {
				rows,
				cols,
				tileWidth,
				tileHeight,
				compositeWidth: width,
				compositeHeight: height,
				urlPattern: struct.url_tile
			};
		}

		const archiveUrlPattern = imageUrl ? extractArchiveUrlPattern(imageUrl) : null;

		const intervalMs = settings.interval || DEFAULT_UPDATE_INTERVAL_MS;
		const updateIntervalMin = Math.max(1, Math.round(intervalMs / MS_PER_MINUTE));

		const newestPictureTime = latest?.datetime
			? new Date(latest.datetime * SECONDS_TO_MS).toISOString()
			: null;

		const cors = imageUrl ? await measureCors(imageUrl, fetchFn) : 'none';

		const lat = settings.position?.latitude ?? null;
		const lon = settings.position?.longitude ?? null;
		const ele = settings.position?.altitude ?? null;
		const viewingDirection = settings.position?.north ?? null;
		const fieldOfView = settings.position?.angle ?? null;

		return {
			provider: 'roundshot',
			cameraId: camId,
			canonicalPageUrl: settings.url || baseUrl,
			name,
			imageUrl,
			archiveUrlPattern,
			archiveTimeStepMin: updateIntervalMin,
			archiveHistoryDays: null,
			width,
			height,
			panorama: true,
			tileLayout,
			position: lat != null && lon != null ? { lat, lon } : null,
			elevation: ele,
			viewingDirection,
			fieldOfView,
			cors,
			updateIntervalMin,
			newestPictureTime
		};
	}
};
