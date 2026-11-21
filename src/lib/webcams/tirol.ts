import { APP_USER_AGENT } from '#lib/identity.ts';
import { probeImage } from './image.ts';
import type { ResolvedWebcam, WebcamAdapter } from './types.ts';

const SITE = 'https://www.tirol.gv.at';
const INDEX = `${SITE}/verkehr/strassenbau-und-strassenerhaltung/webcams/`;
const TIROL_UPDATE_INTERVAL_MINUTES = 1;

const sharedPagePromises = new Map<string, Promise<string>>();

function fetchCachedPage(href: string, fetchFn: typeof fetch): Promise<string> {
	let pagePromise = sharedPagePromises.get(href);
	if (!pagePromise) {
		pagePromise = (async () => {
			const res = await fetchFn(href, { headers: { 'User-Agent': APP_USER_AGENT } });
			if (!res.ok) throw new Error(`Failed to load page ${href}: HTTP ${res.status}`);
			return res.text();
		})();
		sharedPagePromises.set(href, pagePromise);
		pagePromise.catch(() => sharedPagePromises.delete(href));
	}
	return pagePromise;
}

const HTML_ENTITIES: Record<string, string> = {
	amp: '&',
	quot: '"',
	lt: '<',
	gt: '>',
	apos: "'",
	nbsp: ' '
};

const decodeHtmlEntities = (text: string) =>
	text.replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi, (match, decimal, hex, entityName) =>
		decimal
			? String.fromCodePoint(Number(decimal))
			: hex
				? String.fromCodePoint(parseInt(hex, 16))
				: (HTML_ENTITIES[entityName.toLowerCase()] ?? match)
	);

const GERMAN_COMPASS_BEARING_DEGREES: Record<string, number> = {
	norden: 0,
	nordosten: 45,
	osten: 90,
	südosten: 135,
	suedosten: 135,
	süden: 180,
	sueden: 180,
	südwesten: 225,
	suedwesten: 225,
	westen: 270,
	nordwesten: 315
};

function findRoadPageUrl(indexHtml: string, roadDirectory: string): string | null {
	const roadSlugs = [
		...indexHtml.matchAll(
			/href="(\/verkehr\/strassenbau-und-strassenerhaltung\/webcams\/webcams-bezirk-[a-z-]+\/([a-z0-9-]+)\/)"/g
		)
	].map((match) => ({ path: match[1], slug: match[2] }));
	const roadCode = roadDirectory.replace(/^ftp/, '');
	const classifiedRoadMatch = roadCode.match(/^([bl])(\d+)$/);
	const matchedRoad = classifiedRoadMatch
		? roadSlugs.find((entry) =>
				new RegExp(`^(?:webcam-)?${classifiedRoadMatch[1]}-${classifiedRoadMatch[2]}-`).test(
					entry.slug
				)
			)
		: roadSlugs.find((entry) => entry.slug.includes(roadCode));
	return matchedRoad ? SITE + matchedRoad.path : null;
}

function findImageAltCaption(roadPageHtml: string, imageHref: string): string | null {
	for (const imgTagMatch of roadPageHtml.matchAll(/<img\b[^>]*>/g)) {
		const src = imgTagMatch[0].match(/\bsrc="([^"]*)"/)?.[1];
		if (src === imageHref) {
			const rawAlt = imgTagMatch[0].match(/\balt="([^"]*)"/)?.[1] ?? '';
			return decodeHtmlEntities(rawAlt).trim() || null;
		}
	}
	return null;
}

export const tirolAdapter: WebcamAdapter = {
	name: 'tirol',

	match(url: URL): boolean {
		return (
			url.hostname.toLowerCase() === 'webcams.tirol.gv.at' && /\.(jpe?g|png)$/i.test(url.pathname)
		);
	},

	async resolve(url: URL, fetchFn: typeof fetch = fetch): Promise<ResolvedWebcam> {
		const probe = await probeImage(url.href, fetchFn, { head: false });

		const pathSegments = url.pathname.split('/').filter(Boolean);
		const cameraId = pathSegments.join('/').replace(/\.[a-z]+$/i, '');
		const roadDirectory = pathSegments[0];
		const cameraFilename = pathSegments[pathSegments.length - 1];
		const roadNameFormatted = roadDirectory.replace(/^ftp/, '').toUpperCase();
		const cameraNameFormatted = cameraFilename.replace(/\.[a-z]+$/i, '');
		let name = `Land Tirol ${roadNameFormatted} ${cameraNameFormatted}`;
		let canonicalPageUrl = url.href;
		let viewingDirection: number | null = null;

		const roadPageUrl = findRoadPageUrl(await fetchCachedPage(INDEX, fetchFn), roadDirectory);
		if (roadPageUrl) {
			const altCaption = findImageAltCaption(await fetchCachedPage(roadPageUrl, fetchFn), url.href);
			if (altCaption) {
				name = altCaption;
				canonicalPageUrl = roadPageUrl;
				const compassDirectionWord = altCaption
					.match(/Blickrichtung\s+([^,]+)$/i)?.[1]
					.trim()
					.toLowerCase();
				if (compassDirectionWord && compassDirectionWord in GERMAN_COMPASS_BEARING_DEGREES) {
					viewingDirection = GERMAN_COMPASS_BEARING_DEGREES[compassDirectionWord];
				}
			}
		}

		return {
			provider: 'tirol',
			cameraId,
			canonicalPageUrl,
			name,
			imageUrl: url.href,
			archiveUrlPattern: null,
			archiveTimeStepMin: null,
			archiveHistoryDays: null,
			width: probe.width,
			height: probe.height,
			panorama: false,
			tileLayout: null,
			position: null,
			elevation: null,
			viewingDirection,
			fieldOfView: null,
			cors: probe.cors,
			updateIntervalMin: TIROL_UPDATE_INTERVAL_MINUTES,
			newestPictureTime: probe.lastModified
		};
	}
};
