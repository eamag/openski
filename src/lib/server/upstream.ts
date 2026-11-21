import { APP_USER_AGENT } from '#lib/identity.ts';

const MAX_REDIRECTS = 3;
const DEFAULT_MAX_UPSTREAM_BYTES = 5 * 1024 * 1024;
const DEFAULT_UPSTREAM_TIMEOUT_MS = 10_000;

export const PROVIDER_HOSTS: readonly string[] = [
	'panomax.com',
	'roundshot.com',
	'feratel.com',
	'skaping.com',
	'gruenwald-resort.com',
	'popup-communications.com',
	'foto-webcam.eu',
	'tirol.gv.at',
	'webcam-hd.com'
];

const IMAGE_TYPES = new Set([
	'image/jpeg',
	'image/pjpeg',
	'image/png',
	'image/gif',
	'image/webp',
	'image/avif',
	'image/bmp',
	'image/x-icon',
	'image/vnd.microsoft.icon'
]);

export class UpstreamError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'UpstreamError';
	}
}

const SKAPING_IMAGE_BUCKET_HOST = 'skaping.s3.gra.io.cloud.ovh.net';

export function isAllowedHost(
	hostname: string,
	hosts: readonly string[] = PROVIDER_HOSTS
): boolean {
	const host = hostname.toLowerCase().replace(/\.$/, '');
	const isProviderDomain = hosts.some((domain) => host === domain || host.endsWith(`.${domain}`));
	return isProviderDomain || host === SKAPING_IMAGE_BUCKET_HOST;
}

export function isAllowedUpstream(url: URL, hosts: readonly string[] = PROVIDER_HOSTS): boolean {
	if (url.protocol !== 'https:') return false;
	if (url.username || url.password) return false;
	const isStandardHttpsPort = !url.port || url.port === '443';
	if (!isStandardHttpsPort) return false;
	return isAllowedHost(url.hostname, hosts);
}

function mediaType(response: Response): string {
	return (response.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
}

function checkedResponse(response: Response, maxBytes: number, imageOnly: boolean): Response {
	if (imageOnly && !IMAGE_TYPES.has(mediaType(response))) {
		void response.body?.cancel().catch(() => {});
		throw new UpstreamError(
			`Upstream is not a supported image (${mediaType(response) || 'no content type'})`
		);
	}

	const declared = Number(response.headers.get('content-length'));
	if (Number.isFinite(declared) && declared > maxBytes) {
		void response.body?.cancel().catch(() => {});
		throw new UpstreamError(`Upstream response is too large (${declared} bytes)`);
	}
	if (!response.body) return response;

	let seen = 0;
	const capped = new TransformStream<Uint8Array, Uint8Array>({
		transform(chunk, controller) {
			seen += chunk.byteLength;
			if (seen > maxBytes) {
				controller.error(new UpstreamError('Upstream response exceeded the byte limit'));
			} else {
				controller.enqueue(chunk);
			}
		}
	});
	return new Response(response.body.pipeThrough(capped), {
		status: response.status,
		statusText: response.statusText,
		headers: response.headers
	});
}

export interface SafeFetchOptions {
	hosts?: readonly string[];
	maxBytes?: number;
	timeoutMs?: number;
	imageOnly?: boolean;
	accept?: string;
}

export async function safeFetch(
	href: string,
	init: RequestInit = {},
	options: SafeFetchOptions = {}
): Promise<Response> {
	const hosts = options.hosts ?? PROVIDER_HOSTS;
	const maxBytes = options.maxBytes ?? DEFAULT_MAX_UPSTREAM_BYTES;
	const timeoutMs = options.timeoutMs ?? DEFAULT_UPSTREAM_TIMEOUT_MS;
	const deadline = AbortSignal.timeout(timeoutMs);
	const signal = init.signal ? AbortSignal.any([init.signal, deadline]) : deadline;
	let url = new URL(href);

	for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
		if (!isAllowedUpstream(url, hosts)) {
			throw new UpstreamError(`Upstream host not allowed: ${url.hostname}`);
		}

		const headers = new Headers(init.headers);
		if (!headers.has('user-agent')) headers.set('user-agent', APP_USER_AGENT);
		if (options.accept && !headers.has('accept')) headers.set('accept', options.accept);

		const response = await fetch(url.href, { ...init, headers, signal, redirect: 'manual' });

		if (response.status >= 300 && response.status < 400) {
			const location = response.headers.get('location');
			void response.body?.cancel().catch(() => {});
			if (!location) throw new UpstreamError('Upstream redirect has no location');
			url = new URL(location, url);
			continue;
		}
		return checkedResponse(response, maxBytes, options.imageOnly === true);
	}
	throw new UpstreamError('Upstream redirected too many times');
}

export function createSafeFetch(options: SafeFetchOptions = {}): typeof fetch {
	return (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
		const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
		return safeFetch(url, init ?? {}, options);
	};
}
