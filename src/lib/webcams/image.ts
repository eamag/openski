import { APP_USER_AGENT } from '#lib/identity.ts';
import { parseImageDimensions } from './jpeg.ts';

const PROBE_BYTES = 65_536;

export interface ImageProbe {
	contentType: string;
	bytes: number | null;
	lastModified: string | null;
	cors: '*' | 'none';
	width: number;
	height: number;
}

export class NotAnImage extends Error {
	constructor(url: string, detail: string) {
		super(`Not an image: ${detail} (${url})`);
		this.name = 'NotAnImage';
	}
}

const typeOf = (res: Response) =>
	(res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
const isImage = (type: string) => type.startsWith('image/');
const isUnsure = (type: string) => type === '' || type.endsWith('octet-stream');

const totalBytes = (res: Response): number | null => {
	const range = res.headers.get('content-range')?.match(/\/(\d+)\s*$/);
	if (range) return Number(range[1]);
	if (res.status === 206) return null;
	const length = Number(res.headers.get('content-length'));
	return Number.isFinite(length) && length > 0 ? length : null;
};

const modifiedAt = (res: Response): string | null => {
	const value = res.headers.get('last-modified');
	const time = value ? new Date(value).getTime() : Number.NaN;
	return Number.isNaN(time) ? null : new Date(time).toISOString();
};

async function readHead(res: Response, max: number): Promise<Uint8Array> {
	if (!res.body) return new Uint8Array(await res.arrayBuffer()).subarray(0, max);
	const reader = res.body.getReader();
	const out = new Uint8Array(max);
	let length = 0;
	try {
		while (length < max) {
			const { done, value } = await reader.read();
			if (done) break;
			const take = Math.min(value.length, max - length);
			out.set(value.subarray(0, take), length);
			length += take;
		}
	} finally {
		await reader.cancel().catch(() => {});
	}
	return out.subarray(0, length);
}

export async function probeImage(
	url: string,
	fetchFn: typeof fetch = fetch,
	options: { head?: boolean } = {}
): Promise<ImageProbe> {
	const headers = { 'User-Agent': APP_USER_AGENT, Accept: 'image/*,*/*;q=0.5' };

	if (options.head !== false) {
		const head = await fetchFn(url, { method: 'HEAD', headers }).catch(() => null);
		if (head) {
			const type = typeOf(head);
			if (head.status === 404 || head.status === 410)
				throw new Error(`HTTP ${head.status} for ${url}`);
			if (head.ok && type && !isImage(type) && !isUnsure(type)) throw new NotAnImage(url, type);
		}
	}

	const res = await fetchFn(url, { headers: { ...headers, Range: `bytes=0-${PROBE_BYTES - 1}` } });
	if (!res.ok) {
		await res.body?.cancel().catch(() => {});
		throw new Error(`HTTP ${res.status} for ${url}`);
	}
	const type = typeOf(res);
	if (!isImage(type)) {
		await res.body?.cancel().catch(() => {});
		throw new NotAnImage(url, type || 'no content type');
	}
	const head = await readHead(res, PROBE_BYTES);
	const size = parseImageDimensions(head);
	const isSupportedImageFormat = /^image\/(?:jpe?g|pjpeg|png|gif|webp)$/.test(type);
	const isTruncatedOrDeadImage = !size && head.length < PROBE_BYTES && isSupportedImageFormat;
	if (isTruncatedOrDeadImage)
		throw new NotAnImage(url, `unreadable ${type} of ${head.length} bytes`);
	return {
		contentType: type,
		bytes: totalBytes(res) ?? (head.length < PROBE_BYTES ? head.length : null),
		lastModified: modifiedAt(res),
		cors: res.headers.get('access-control-allow-origin') === '*' ? '*' : 'none',
		width: size?.width ?? 0,
		height: size?.height ?? 0
	};
}
