export const MAX_OFM_TILES = 3000;
export const MAX_OFM_BYTES = 50 * 1024 * 1024; // 50 MB
export const PARALLEL_DOWNLOADS = 4;
export const OFM_HOST = 'tiles.openfreemap.org';
export const OFM_TILE_ROUTE = '/api/offline-tiles';

export function tileKey(url: URL | string): string | null {
	const parsed = typeof url === 'string' ? new URL(url, 'https://localhost') : url;
	if (parsed.hostname === OFM_HOST) {
		if (parsed.pathname === '/planet') return 'https://tiles.openfreemap.org/planet';
		const tilePathMatch = parsed.pathname.match(/^\/planet\/(?:[^/]+\/)?(\d+\/\d+\/\d+\.pbf)$/);
		if (tilePathMatch) return `https://tiles.openfreemap.org/planet/${tilePathMatch[1]}`;
		if (parsed.pathname.startsWith('/fonts/'))
			return `https://tiles.openfreemap.org${parsed.pathname}`;
		return null;
	}
	if (parsed.hostname === 'tiles.mapterhorn.com' && parsed.pathname.endsWith('.webp')) {
		return `https://tiles.mapterhorn.com${parsed.pathname}`;
	}
	return null;
}

export function isOpenFreeMapUrl(url: URL | string): boolean {
	const parsed = typeof url === 'string' ? new URL(url, 'https://localhost') : url;
	return parsed.hostname === OFM_HOST;
}

export function toOfflineTileProxyUrl(upstreamUrl: string): string {
	return `${OFM_TILE_ROUTE}?url=${encodeURIComponent(upstreamUrl)}`;
}
