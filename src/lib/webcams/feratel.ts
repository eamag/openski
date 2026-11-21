import { APP_USER_AGENT } from '#lib/identity.ts';
import { fetchJpegDimensions, measureCors } from './jpeg.ts';
import type { ResolvedWebcam, WebcamAdapter } from './types.ts';

const FERATEL_UPDATE_INTERVAL_MIN = 5;

export const feratelAdapter: WebcamAdapter = {
	name: 'feratel',

	match(url: URL): boolean {
		return url.hostname.endsWith('feratel.com');
	},

	async resolve(url: URL, fetchFn: typeof fetch = fetch): Promise<ResolvedWebcam> {
		const pageRes = await fetchFn(url.href, {
			headers: { 'User-Agent': APP_USER_AGENT }
		});
		if (!pageRes.ok) {
			throw new Error(`Failed to load Feratel page ${url.href}: HTTP ${pageRes.status}`);
		}
		const html = await pageRes.text();

		const camId = url.searchParams.get('cam') || html.match(/var\s+cam\s*=\s*["'](\d+)["']/)?.[1];
		if (!camId) {
			throw new Error(`Could not determine Feratel camera ID from ${url.href}`);
		}

		const latMatch = html.match(/latACam\s*=\s*([0-9.]+)/) || html.match(/infolat:\s*([0-9.]+)/);
		const lonMatch = html.match(/longACam\s*=\s*([0-9.]+)/) || html.match(/infolong:\s*([0-9.]+)/);
		const lat = latMatch ? Number.parseFloat(latMatch[1]) : null;
		const lon = lonMatch ? Number.parseFloat(lonMatch[1]) : null;

		const eleMatch =
			html.match(/Elevation:[\s\S]{0,100}?<nobr>(\d+)[\s\u00a0]*m<\/nobr>/i) ||
			html.match(/class="[^"]*standortinfos[^"]*"[^>]*value="<nobr>(\d+)[\s\u00a0]*m<\/nobr>"/i) ||
			html.match(/<nobr>(\d+)[\s\u00a0]*m<\/nobr>/i);
		const ele = eleMatch ? Number.parseInt(eleMatch[1], 10) : null;

		let name = '';
		const titleMatch = html.match(
			/<title>(?:feratel MediaPlayer \| Livecam )?(?:[^-]+ - )?(.*?)(?:-Panoramakamera|-Webcam|,Austria|<\/title>)/i
		);
		if (titleMatch) {
			name = titleMatch[1].trim();
		} else {
			const dataCamMatch = html.match(/data-camname="([^"]+)"/);
			if (dataCamMatch) {
				name = dataCamMatch[1]
					.replace(/Webcam\s*\|\s*/i, '')
					.replace(/360°Cam\s*/i, '')
					.split('|')[0]
					.trim();
			}
		}

		const imageUrl = `https://wtvpict.feratel.com/picture/35/${camId}/${camId}.jpeg`;

		const [cors, dims, headRes] = await Promise.all([
			measureCors(imageUrl, fetchFn),
			fetchJpegDimensions(imageUrl, fetchFn),
			fetchFn(imageUrl, {
				method: 'HEAD',
				headers: { 'User-Agent': APP_USER_AGENT }
			}).catch(() => null)
		]);

		const lastModified = headRes?.headers.get('last-modified');
		const newestPictureTime = lastModified ? new Date(lastModified).toISOString() : null;

		return {
			provider: 'feratel',
			cameraId: camId,
			canonicalPageUrl: `https://webtv.feratel.com/webtv/?cam=${camId}`,
			name: name || `Feratel ${camId}`,
			imageUrl,
			archiveUrlPattern: null,
			archiveTimeStepMin: null,
			archiveHistoryDays: null,
			width: dims.width,
			height: dims.height,
			panorama: false,
			tileLayout: null,
			position: lat != null && lon != null ? { lat, lon } : null,
			elevation: ele,
			viewingDirection: null,
			fieldOfView: null,
			cors,
			updateIntervalMin: FERATEL_UPDATE_INTERVAL_MIN,
			newestPictureTime
		};
	}
};
