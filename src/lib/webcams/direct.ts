import { probeImage } from './image.ts';
import type { ResolvedWebcam, WebcamAdapter } from './types.ts';

const PANORAMA_MIN_ASPECT_RATIO = 2.5;

export const directAdapter: WebcamAdapter = {
	name: 'direct',

	match(url: URL): boolean {
		return url.protocol === 'http:' || url.protocol === 'https:';
	},

	async resolve(url: URL, fetchFn: typeof fetch = fetch): Promise<ResolvedWebcam> {
		const probe = await probeImage(url.href, fetchFn);
		return {
			provider: 'direct',
			cameraId: url.href,
			canonicalPageUrl: url.href,
			name: url.hostname.replace(/^www\./, ''),
			imageUrl: url.href,
			archiveUrlPattern: null,
			archiveTimeStepMin: null,
			archiveHistoryDays: null,
			width: probe.width,
			height: probe.height,
			panorama: probe.height > 0 && probe.width / probe.height >= PANORAMA_MIN_ASPECT_RATIO,
			tileLayout: null,
			position: null,
			elevation: null,
			viewingDirection: null,
			fieldOfView: null,
			cors: probe.cors,
			updateIntervalMin: null,
			newestPictureTime: probe.lastModified
		};
	}
};
