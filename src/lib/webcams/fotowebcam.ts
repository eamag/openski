import { APP_USER_AGENT } from '#lib/identity.ts';
import { probeImage } from './image.ts';
import type { ResolvedWebcam, WebcamAdapter } from './types.ts';

const ORIGIN = 'https://www.foto-webcam.eu';
const SECONDS_PER_MINUTE = 60;
const PANORAMA_MIN_ASPECT_RATIO = 2.5;

interface PreloadData {
	image?: string;
	hdimg?: string;
	fhdimg?: string;
	uhdimg?: string;
	hugeimg?: string;
	hugeWidth?: string | number;
	hugeHeight?: string | number;
	title?: string;
}

interface CamMeta {
	id?: string;
	name?: string;
	offline?: boolean;
	latitude?: number;
	longitude?: number;
	elevation?: number;
	direction?: number;
	captureInterval?: number;
}

function jsonAfter(html: string, marker: string): unknown {
	const start = html.indexOf(marker);
	if (start < 0) return null;
	const open = html.indexOf('{', start + marker.length - 1);
	if (open < 0) return null;
	let depth = 0;
	let inString = false;
	for (let i = open; i < html.length; i++) {
		const c = html[i];
		if (inString) {
			if (c === '\\') i++;
			else if (c === '"') inString = false;
		} else if (c === '"') inString = true;
		else if (c === '{') depth++;
		else if (c === '}' && --depth === 0) {
			try {
				return JSON.parse(html.slice(open, i + 1));
			} catch {
				return null;
			}
		}
	}
	return null;
}

const num = (v: unknown): number | null => {
	const n = typeof v === 'string' ? Number(v) : v;
	return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null;
};

export const fotoWebcamAdapter: WebcamAdapter = {
	name: 'foto-webcam',

	match(url: URL): boolean {
		const host = url.hostname.toLowerCase();
		return (
			(host === 'foto-webcam.eu' || host.endsWith('.foto-webcam.eu')) &&
			/^\/webcam\/[^/]+/.test(url.pathname)
		);
	},

	async resolve(url: URL, fetchFn: typeof fetch = fetch): Promise<ResolvedWebcam> {
		const id = url.pathname.split('/')[2];
		const page = `${ORIGIN}/webcam/${id}/`;
		const pageRes = await fetchFn(page, { headers: { 'User-Agent': APP_USER_AGENT } });
		if (!pageRes.ok)
			throw new Error(`Failed to load foto-webcam.eu page ${page}: HTTP ${pageRes.status}`);
		const html = await pageRes.text();

		const data = jsonAfter(html, 'wcmain.preloadData= new Object(') as PreloadData | null;
		if (!data?.image) throw new Error(`No picture data on foto-webcam.eu page ${page}`);
		const listed =
			(jsonAfter(html, 'var metadata= new Object(') as { cams?: CamMeta[] } | null)?.cams ?? [];
		const meta = listed.find((c) => c.id === id);
		const isCameraNoLongerListed = listed.length > 0 && !meta;
		if (isCameraNoLongerListed) throw new Error(`foto-webcam.eu camera ${id} is no longer listed`);
		const isCameraOffline = Boolean(meta?.offline);
		if (isCameraOffline) throw new Error(`foto-webcam.eu camera ${id} is offline`);

		const hasLm = !!data.hdimg;
		const sizeName = hasLm ? '1200' : '816';
		const imageUrl = `${ORIGIN}/webcam/${id}/current/${sizeName}.jpg`;
		const frameSuffix = hasLm ? 'lm' : 'la';
		const archiveUrlPattern = `${ORIGIN}/webcam/${id}/{yyyy}/{mm}/{dd}/{hh}{mi}_${frameSuffix}.jpg`;

		const probe = await probeImage(imageUrl, fetchFn, { head: false });

		const aspect = probe.width > 0 ? probe.height / probe.width : 0;
		const fullChoices: [string | undefined, string, number, number][] = [
			[data.hugeimg, 'hu', num(data.hugeWidth) ?? 0, num(data.hugeHeight) ?? 0],
			[data.uhdimg, 'uh', 3840, Math.round(3840 * aspect)],
			[data.fhdimg, 'hd', 1920, Math.round(1920 * aspect)]
		];
		const full = fullChoices.find(([file, , w, h]) => file && w > 0 && h > 0);

		const interval = num(meta?.captureInterval);
		const stepMin = interval ? Math.round(interval / SECONDS_PER_MINUTE) : null;
		const title =
			data.title?.trim() ||
			html.match(/<title>([^<]+?)(?:\s*-\s*Foto-Webcam\.eu)?\s*<\/title>/i)?.[1];

		return {
			provider: 'foto-webcam',
			cameraId: id,
			canonicalPageUrl: page,
			name: title || meta?.name || id,
			imageUrl,
			archiveUrlPattern,
			archiveTimeStepMin: stepMin,
			archiveHistoryDays: null,
			width: probe.width,
			height: probe.height,
			panorama: probe.height > 0 && probe.width / probe.height >= PANORAMA_MIN_ASPECT_RATIO,
			tileLayout: null,
			position:
				typeof meta?.latitude === 'number' && typeof meta.longitude === 'number'
					? { lat: meta.latitude, lon: meta.longitude }
					: null,
			elevation: num(meta?.elevation),
			viewingDirection: typeof meta?.direction === 'number' ? meta.direction : null,
			fieldOfView: null,
			cors: probe.cors,
			updateIntervalMin: stepMin,
			newestPictureTime: probe.lastModified,
			fullImageUrl: full ? `${ORIGIN}/webcam/${id}/${full[0]}` : null,
			fullWidth: full ? full[2] : null,
			fullHeight: full ? full[3] : null,
			fullArchiveUrlPattern: full
				? `${ORIGIN}/webcam/${id}/{yyyy}/{mm}/{dd}/{hh}{mi}_${full[1]}.jpg`
				: null
		};
	}
};
