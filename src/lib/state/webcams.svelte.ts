import { asset, resolve } from '$app/paths';
import { t } from '#lib/i18n/index.ts';
import { catalogResort } from './catalog.ts';

export interface Webcam {
	osm: string;
	name: string;
	lat: number;
	lon: number;
	direction: number | null;
	fov: number | null;
	url: string;
	provider: string | null;
	imageUrl: string | null;
}

const PROVIDER_LABEL: Record<string, string> = {
	panomax: 'Panomax',
	feratel: 'Feratel',
	roundshot: 'Roundshot',
	skaping: 'Skaping',
	'foto-webcam': 'foto-webcam.eu',
	tirol: 'Land Tirol',
	'webcam-hd': 'webcam-hd.com'
};

export function providerLabel(cam: Webcam): string {
	if (cam.provider && PROVIDER_LABEL[cam.provider]) return PROVIDER_LABEL[cam.provider];
	return (
		cam.url.match(/^https?:\/\/(?:www\.)?([^/:?#]+)/i)?.[1] ?? cam.provider ?? t.webcams.webcam
	);
}

const LIGHT_IMAGE_PROVIDERS = new Set([
	'panomax',
	'roundshot',
	'skaping',
	'foto-webcam',
	'tirol',
	'webcam-hd'
]);
const TIMESTAMPED_IMAGE_PROVIDERS = new Set(['roundshot', 'skaping']);
const FRESH_IMAGE_FETCH_TIMEOUT_MS = 8000;

export const isHeavy = (cam: Webcam) => !LIGHT_IMAGE_PROVIDERS.has(cam.provider ?? '');

const isWeb = (href: string) => /^https?:\/\/[^\s/]/i.test(href);

export async function pictureCandidates(cam: Webcam): Promise<string[]> {
	let url = cam.imageUrl;
	if (!url || !isWeb(url)) return [];
	if (TIMESTAMPED_IMAGE_PROVIDERS.has(cam.provider ?? '')) {
		const fresh = await fetch(
			`${resolve('/api/webcam-resolve')}?url=${encodeURIComponent(cam.url)}`,
			{ signal: AbortSignal.timeout(FRESH_IMAGE_FETCH_TIMEOUT_MS) }
		)
			.then((res) => (res.ok ? (res.json() as Promise<{ imageUrl?: string }>) : null))
			.catch(() => null);
		if (fresh?.imageUrl && isWeb(fresh.imageUrl)) url = fresh.imageUrl;
	}
	if (cam.provider === 'roundshot') {
		const base = url.replace(/_(full\d?|half|quarter)\.jpg$/, '');
		if (base !== url) return [`${base}_quarter.jpg`, `${base}_half.jpg`];
	}
	return [url];
}

class WebcamState {
	cams = $state.raw<Webcam[]>([]);
	selected = $state.raw<Webcam | null>(null);

	private loadedFor: string | null = null;

	load(id: string | null): void {
		if (id === this.loadedFor) return;
		this.loadedFor = id;
		this.cams = [];
		this.selected = null;
		if (id) void this.fetchList(id);
	}

	private async fetchList(id: string): Promise<void> {
		const entry = await catalogResort(id);
		if (this.loadedFor !== id || !entry?.webcams) return;
		const list = await fetch(asset(`data/${id}-webcams.json` as never))
			.then((res) => (res.ok ? (res.json() as Promise<Webcam[]>) : []))
			.catch(() => []);
		if (this.loadedFor !== id) return;
		this.cams = list.filter(
			(w) => w.url && isWeb(w.url) && Number.isFinite(w.lat) && Number.isFinite(w.lon)
		);
	}

	byOsm(osm: string): Webcam | undefined {
		return this.cams.find((c) => c.osm === osm);
	}
}

export const webcams = new WebcamState();
