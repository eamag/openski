import type { ResortStatus } from './intermaps.ts';

export const OPENDATAHUB_LIFTS =
	'https://tourism.api.opendatahub.com/v1/ODHActivityPoi?source=dss&active=true&pagesize=5000&tagfilter=lifts' +
	'&fields=Id,Detail.de.Title,Detail.it.Title,Detail.en.Title,IsOpen,GpsPoints.valleystationpoint,GpsPoints.position';

interface Point {
	Latitude?: number | null;
	Longitude?: number | null;
}
interface Item {
	'Detail.de.Title'?: string | null;
	'Detail.it.Title'?: string | null;
	'Detail.en.Title'?: string | null;
	IsOpen?: boolean | null;
	'GpsPoints.valleystationpoint'?: Point | null;
	'GpsPoints.position'?: Point | null;
}

const VALLEY_STATION_BBOX_PADDING_DEG = 0.01;

export function parseOpenDataHub(
	doc: unknown,
	bbox: [west: number, south: number, east: number, north: number]
): ResortStatus {
	const items = (doc as { Items?: Item[] })?.Items;
	if (!Array.isArray(items)) throw new Error('unexpected status format');
	const [west, south, east, north] = bbox;
	const midLatitude = (south + north) / 2;
	const padLon = VALLEY_STATION_BBOX_PADDING_DEG / Math.cos((midLatitude * Math.PI) / 180);
	const lifts: ResortStatus['lifts'] = [];
	for (const item of items) {
		const at = item['GpsPoints.valleystationpoint'] ?? item['GpsPoints.position'];
		const lon = at?.Longitude;
		const lat = at?.Latitude;
		if (typeof item.IsOpen !== 'boolean' || lon == null || lat == null) continue;
		const isInsidePaddedBbox =
			lon >= west - padLon &&
			lon <= east + padLon &&
			lat >= south - VALLEY_STATION_BBOX_PADDING_DEG &&
			lat <= north + VALLEY_STATION_BBOX_PADDING_DEG;
		if (!isInsidePaddedBbox) continue;
		const names = new Set(
			[item['Detail.de.Title'], item['Detail.it.Title'], item['Detail.en.Title']].flatMap((t) =>
				t?.trim() ? [t.trim()] : []
			)
		);
		for (const name of names) lifts.push({ name, kind: 'other', open: item.IsOpen });
	}
	return { at: new Date().toISOString(), lifts, pistes: [] };
}
