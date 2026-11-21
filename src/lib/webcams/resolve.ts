import { directAdapter } from './direct.ts';
import { feratelAdapter } from './feratel.ts';
import { fotoWebcamAdapter } from './fotowebcam.ts';
import { otherAdapter } from './other.ts';
import { panomaxAdapter } from './panomax.ts';
import { roundshotAdapter } from './roundshot.ts';
import { skapingAdapter } from './skaping.ts';
import { tirolAdapter } from './tirol.ts';
import { webcamHdAdapter } from './webcamhd.ts';
import { type ResolvedWebcam, UnsupportedWebcam, type WebcamAdapter } from './types.ts';

const SPECIFIC_PROVIDER_ADAPTERS: WebcamAdapter[] = [
	panomaxAdapter,
	feratelAdapter,
	roundshotAdapter,
	skapingAdapter,
	otherAdapter,
	fotoWebcamAdapter,
	tirolAdapter,
	webcamHdAdapter
];
const CATCH_ALL_FALLBACK_ADAPTER: WebcamAdapter = directAdapter;

export const adapters: WebcamAdapter[] = [
	...SPECIFIC_PROVIDER_ADAPTERS,
	CATCH_ALL_FALLBACK_ADAPTER
];

export async function resolveWebcam(
	pageUrl: string,
	fetchFn: typeof fetch = fetch
): Promise<ResolvedWebcam> {
	let url: URL;
	try {
		url = new URL(pageUrl);
	} catch {
		throw new Error(`Invalid webcam URL: ${pageUrl}`);
	}

	for (const candidateAdapter of adapters) {
		if (candidateAdapter.match(url)) {
			return candidateAdapter.resolve(url, fetchFn);
		}
	}

	throw new UnsupportedWebcam(url.hostname);
}
