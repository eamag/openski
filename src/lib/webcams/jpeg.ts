import { APP_USER_AGENT } from '#lib/identity.ts';

export function parseJpegDimensions(bytes: Uint8Array): { width: number; height: number } | null {
	if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
		return null;
	}

	let offset = 2;
	while (offset < bytes.length - 8) {
		if (bytes[offset] !== 0xff) {
			offset++;
			continue;
		}

		while (offset < bytes.length && bytes[offset] === 0xff) {
			offset++;
		}
		if (offset >= bytes.length) break;

		const marker = bytes[offset++];

		const isStandaloneMarker =
			marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7);
		if (isStandaloneMarker) {
			continue;
		}

		if (offset + 2 > bytes.length) break;
		const length = (bytes[offset] << 8) | bytes[offset + 1];

		const isStartOfFrameMarker = marker === 0xc0 || marker === 0xc1 || marker === 0xc2;
		if (isStartOfFrameMarker) {
			if (offset + 7 > bytes.length) break;
			const height = (bytes[offset + 3] << 8) | bytes[offset + 4];
			const width = (bytes[offset + 5] << 8) | bytes[offset + 6];
			return { width, height };
		}

		offset += length;
	}

	return null;
}

export async function measureCors(
	url: string,
	fetchFn: typeof fetch = fetch
): Promise<'*' | 'none'> {
	try {
		const res = await fetchFn(url, {
			method: 'HEAD',
			headers: { 'User-Agent': APP_USER_AGENT }
		});
		return res.headers.get('access-control-allow-origin') === '*' ? '*' : 'none';
	} catch {
		return 'none';
	}
}

export async function fetchJpegDimensions(
	url: string,
	fetchFn: typeof fetch = fetch
): Promise<{ width: number; height: number }> {
	const dimensionsFrom = async (headers: Record<string, string>) => {
		const res = await fetchFn(url, { headers: { 'User-Agent': APP_USER_AGENT, ...headers } });
		return parseJpegDimensions(new Uint8Array(await res.arrayBuffer()));
	};
	const fromStart = await dimensionsFrom({ Range: 'bytes=0-8191' }).catch(() => null);
	const fromWholeFile = fromStart ?? (await dimensionsFrom({}).catch(() => null));
	return fromWholeFile ?? { width: 0, height: 0 };
}

export function parseImageDimensions(bytes: Uint8Array): { width: number; height: number } | null {
	const b = bytes;
	if (b.length < 12) return null;
	if (b[0] === 0xff && b[1] === 0xd8) return parseJpegDimensions(b);

	const u16le = (i: number) => b[i] | (b[i + 1] << 8);
	const u24le = (i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
	const ascii = (i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n));

	if (b[0] === 0x89 && ascii(1, 3) === 'PNG' && b.length >= 24) {
		const u32 = (i: number) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
		return { width: u32(16), height: u32(20) };
	}
	if (ascii(0, 3) === 'GIF' && b.length >= 10) return { width: u16le(6), height: u16le(8) };
	if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP' && b.length >= 30) {
		const kind = ascii(12, 4);
		if (kind === 'VP8 ') return { width: u16le(26) & 0x3fff, height: u16le(28) & 0x3fff };
		if (kind === 'VP8L') {
			return {
				width: 1 + (((b[22] & 0x3f) << 8) | b[21]),
				height: 1 + (((b[24] & 0x0f) << 10) | (b[23] << 2) | ((b[22] & 0xc0) >> 6))
			};
		}
		if (kind === 'VP8X') return { width: 1 + u24le(24), height: 1 + u24le(27) };
	}
	return null;
}
