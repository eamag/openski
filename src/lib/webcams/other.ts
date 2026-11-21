import { APP_USER_AGENT } from '#lib/identity.ts';
import { fetchJpegDimensions, measureCors } from './jpeg.ts';
import type { ResolvedWebcam, WebcamAdapter } from './types.ts';

const GRUNWALD_RESORT_DEFAULT_ELEVATION_M = 1530;
const OTHER_WEBCAM_UPDATE_INTERVAL_MIN = 5;

export const otherAdapter: WebcamAdapter = {
	name: 'other',

	match(url: URL): boolean {
		return (
			url.hostname.includes('gruenwald-resort.com') ||
			url.hostname.includes('popup-communications.com')
		);
	},

	async resolve(url: URL, fetchFn: typeof fetch = fetch): Promise<ResolvedWebcam> {
		const pageRes = await fetchFn(url.href, {
			headers: { 'User-Agent': APP_USER_AGENT }
		});
		if (!pageRes.ok) {
			throw new Error(`Failed to load page ${url.href}: HTTP ${pageRes.status}`);
		}
		const html = await pageRes.text();

		const imgMatches = [
			...html.matchAll(
				/(https?:\/\/[^"'\s<>]*(?:webcam\d+|popup-communications)[^"'\s<>]+\.(?:jpg|jpeg))/gi
			)
		].map((m) => m[1]);

		const uniqueImgs = Array.from(new Set(imgMatches));
		if (uniqueImgs.length === 0) {
			throw new Error(`No webcam images found on ${url.href}`);
		}

		const hash = url.hash.toLowerCase();
		const query = url.searchParams.get('cam');
		let selectedImg = uniqueImgs[0];
		let camId = 'webcam01';

		if (hash.includes('2') || query === '2' || hash.includes('webcam02')) {
			const cam2 = uniqueImgs.find((u) => u.includes('webcam02') || u.includes('webcam2'));
			if (cam2) {
				selectedImg = cam2;
				camId = 'webcam02';
			}
		} else {
			const cam1 = uniqueImgs.find((u) => u.includes('webcam01') || u.includes('webcam1'));
			if (cam1) {
				selectedImg = cam1;
				camId = 'webcam01';
			}
		}

		let name = 'Grünwald Resort Webcam';
		const captionMatch =
			camId === 'webcam01'
				? html.match(/Blickrichtung Norden:\s*([^.<]+)/i)
				: html.match(/Blickrichtung Süden:\s*([^.<]+)/i);

		if (captionMatch) {
			name = `Grünwald Resort - ${captionMatch[1].trim()}`;
		}

		const eleMatch = html.match(/(\d{4})\s*m\b/);
		const ele = eleMatch ? Number.parseInt(eleMatch[1], 10) : GRUNWALD_RESORT_DEFAULT_ELEVATION_M;

		const [cors, dims, headRes] = await Promise.all([
			measureCors(selectedImg, fetchFn),
			fetchJpegDimensions(selectedImg, fetchFn),
			fetchFn(selectedImg, {
				method: 'HEAD',
				headers: { 'User-Agent': APP_USER_AGENT }
			}).catch(() => null)
		]);

		const lastModified = headRes?.headers.get('last-modified');
		const newestPictureTime = lastModified ? new Date(lastModified).toISOString() : null;

		return {
			provider: 'other',
			cameraId: camId,
			canonicalPageUrl: url.origin + url.pathname,
			name,
			imageUrl: selectedImg,
			archiveUrlPattern: null,
			archiveTimeStepMin: null,
			archiveHistoryDays: null,
			width: dims.width,
			height: dims.height,
			panorama: false,
			tileLayout: null,
			position: null,
			elevation: ele,
			viewingDirection: null,
			fieldOfView: null,
			cors,
			updateIntervalMin: OTHER_WEBCAM_UPDATE_INTERVAL_MIN,
			newestPictureTime
		};
	}
};
