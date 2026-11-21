import wasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url';
import { t } from '../i18n/index.ts';
import type { Detection } from './types.ts';

export interface DetectOptions {
	confidence?: number;
	iou?: number;
	_internal?: boolean;
}

export interface Detector {
	detect(
		image: OffscreenCanvas,
		upscale?: number,
		blur?: number,
		options?: DetectOptions
	): Promise<Detection[]>;
	release(): Promise<void>;
}

interface RawBox {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
	score: number;
}

function nms(boxes: RawBox[], iouThreshold: number): RawBox[] {
	if (boxes.length === 0) return [];
	boxes.sort((a, b) => b.score - a.score);

	const keep: RawBox[] = [];
	for (const b of boxes) {
		let overlap = false;
		for (const k of keep) {
			const xx1 = Math.max(b.x1, k.x1);
			const yy1 = Math.max(b.y1, k.y1);
			const xx2 = Math.min(b.x2, k.x2);
			const yy2 = Math.min(b.y2, k.y2);

			const w = Math.max(0, xx2 - xx1);
			const h = Math.max(0, yy2 - yy1);
			const inter = w * h;
			if (inter > 0) {
				const areaB = (b.x2 - b.x1) * (b.y2 - b.y1);
				const areaK = (k.x2 - k.x1) * (k.y2 - k.y1);
				const iou = inter / (areaB + areaK - inter);
				if (iou > iouThreshold) {
					overlap = true;
					break;
				}
			}
		}
		if (!overlap) {
			keep.push(b);
		}
	}
	return keep;
}

export async function loadDetector(
	modelUrl: string,
	onProgress?: (share: number) => void
): Promise<Detector> {
	const ort = await import('onnxruntime-web/wasm');

	ort.env.wasm.numThreads = 1;
	ort.env.wasm.wasmPaths = { wasm: wasmUrl };

	const res = await fetch(modelUrl);
	if (!res.ok) {
		throw new Error(t.queues.error.modelDownloadFailed(res.status));
	}

	let modelBytes: Uint8Array;
	const contentLength = res.headers.get('content-length');
	const total = contentLength ? parseInt(contentLength, 10) : 0;
	if (res.body) {
		const reader = res.body.getReader();
		const chunks: Uint8Array[] = [];
		let loaded = 0;
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			if (value) {
				chunks.push(value);
				loaded += value.length;
				if (total > 0 && onProgress) {
					onProgress(Math.min(1, loaded / total));
				}
			}
		}
		modelBytes = new Uint8Array(loaded);
		let offset = 0;
		for (const chunk of chunks) {
			modelBytes.set(chunk, offset);
			offset += chunk.length;
		}
		if (onProgress) onProgress(1);
	} else {
		const buf = await res.arrayBuffer();
		modelBytes = new Uint8Array(buf);
		if (onProgress) onProgress(1);
	}

	const session = await ort.InferenceSession.create(modelBytes, {
		executionProviders: ['wasm']
	});

	const inputName = session.inputNames[0];
	const outputName = session.outputNames[0];

	const YOLO_MODEL_WINDOW_SIZE = 640;
	const YOLO_NUM_COLOR_CHANNELS = 3;
	const YOLO_NUM_CANDIDATE_BOXES = 8400;
	const YOLO_PERSON_CLASS_ROW_INDEX = 4;
	const LETTERBOX_PADDING_GREY_VALUE = 114 / 255;
	const DEFAULT_BLUR_RADIUS_PX = 2;
	const DENSE_CROWD_CONFIDENCE = 0.15;
	const DENSE_CROWD_IOU = 0.6;
	const SPARSE_QUEUE_CONFIDENCE = 0.3;
	const SPARSE_QUEUE_IOU = 0.45;
	const DENSE_CROWD_PERSON_COUNT_THRESHOLD = 20;
	const CANDIDATE_SCORE_FLOOR = 0.1;
	const SLIDING_WINDOW_OVERLAP_RATIO = 0.2;

	const inputBuffer = new Float32Array(
		YOLO_NUM_COLOR_CHANNELS * YOLO_MODEL_WINDOW_SIZE * YOLO_MODEL_WINDOW_SIZE
	);

	const detector: Detector = {
		async detect(
			image: OffscreenCanvas,
			upscale = 1,
			blur = DEFAULT_BLUR_RADIUS_PX,
			options: DetectOptions = {}
		): Promise<Detection[]> {
			const scaledW = Math.round(image.width * upscale);
			const scaledH = Math.round(image.height * upscale);
			const sliceCanvas = new OffscreenCanvas(scaledW, scaledH);
			const sCtx = sliceCanvas.getContext('2d', { willReadFrequently: true });
			if (!sCtx) throw new Error('Could not get 2d context for the scaled canvas');
			sCtx.imageSmoothingEnabled = true;
			sCtx.imageSmoothingQuality = 'high';
			sCtx.filter = blur > 0 ? `blur(${blur}px)` : 'none';
			sCtx.drawImage(image, 0, 0, scaledW, scaledH);
			sCtx.filter = 'none';

			const W = sliceCanvas.width;
			const H = sliceCanvas.height;
			const sliceCtx = sliceCanvas.getContext('2d', { willReadFrequently: true });
			if (!sliceCtx) throw new Error('Could not get 2d context for sliced canvas');

			const step = Math.floor(YOLO_MODEL_WINDOW_SIZE * (1 - SLIDING_WINDOW_OVERLAP_RATIO));

			const xStarts: number[] = [];
			let cx = 0;
			while (cx + YOLO_MODEL_WINDOW_SIZE <= W) {
				xStarts.push(cx);
				cx += step;
			}
			if (xStarts.length === 0 || xStarts[xStarts.length - 1] + YOLO_MODEL_WINDOW_SIZE < W) {
				xStarts.push(Math.max(0, W - YOLO_MODEL_WINDOW_SIZE));
			}

			const yStarts: number[] = [];
			let cy = 0;
			while (cy + YOLO_MODEL_WINDOW_SIZE <= H) {
				yStarts.push(cy);
				cy += step;
			}
			if (yStarts.length === 0 || yStarts[yStarts.length - 1] + YOLO_MODEL_WINDOW_SIZE < H) {
				yStarts.push(Math.max(0, H - YOLO_MODEL_WINDOW_SIZE));
			}

			const uniqueX = Array.from(new Set(xStarts)).sort((a, b) => a - b);
			const uniqueY = Array.from(new Set(yStarts)).sort((a, b) => a - b);

			const allRawBoxes: RawBox[] = [];

			for (const ys of uniqueY) {
				for (const xs of uniqueX) {
					const winW = Math.min(YOLO_MODEL_WINDOW_SIZE, W - xs);
					const winH = Math.min(YOLO_MODEL_WINDOW_SIZE, H - ys);

					const padLeft = Math.floor((YOLO_MODEL_WINDOW_SIZE - winW) / 2);
					const padTop = Math.floor((YOLO_MODEL_WINDOW_SIZE - winH) / 2);

					inputBuffer.fill(LETTERBOX_PADDING_GREY_VALUE);

					const imgData = sliceCtx.getImageData(xs, ys, winW, winH);
					const pixels = imgData.data;

					const channelSize = 640 * 640;
					for (let row = 0; row < winH; row++) {
						const dstRow = (padTop + row) * 640;
						const srcRow = row * winW * 4;
						for (let col = 0; col < winW; col++) {
							const dstIdx = dstRow + (padLeft + col);
							const srcIdx = srcRow + col * 4;
							inputBuffer[dstIdx] = pixels[srcIdx] / 255;
							inputBuffer[channelSize + dstIdx] = pixels[srcIdx + 1] / 255;
							inputBuffer[2 * channelSize + dstIdx] = pixels[srcIdx + 2] / 255;
						}
					}

					const tensor = new ort.Tensor('float32', inputBuffer, [1, 3, 640, 640]);
					const outMap = await session.run({ [inputName]: tensor });
					const outTensor = outMap[outputName];
					const out = outTensor.data as Float32Array;

					for (let i = 0; i < YOLO_NUM_CANDIDATE_BOXES; i++) {
						const score = out[YOLO_PERSON_CLASS_ROW_INDEX * YOLO_NUM_CANDIDATE_BOXES + i];
						if (score < CANDIDATE_SCORE_FLOOR) continue;

						const bx = out[i];
						const by = out[YOLO_NUM_CANDIDATE_BOXES + i];
						const bw = out[2 * YOLO_NUM_CANDIDATE_BOXES + i];
						const bh = out[3 * YOLO_NUM_CANDIDATE_BOXES + i];

						const unpadX = bx - padLeft;
						const unpadY = by - padTop;

						const x1 = (unpadX - bw / 2 + xs) / upscale;
						const y1 = (unpadY - bh / 2 + ys) / upscale;
						const x2 = (unpadX + bw / 2 + xs) / upscale;
						const y2 = (unpadY + bh / 2 + ys) / upscale;

						allRawBoxes.push({ x1, y1, x2, y2, score });
					}
				}
			}

			const sparseBoxes = nms(
				allRawBoxes.filter((b) => b.score >= SPARSE_QUEUE_CONFIDENCE),
				SPARSE_QUEUE_IOU
			);
			const isDenseCrowd =
				sparseBoxes.length >= DENSE_CROWD_PERSON_COUNT_THRESHOLD ||
				options.confidence === DENSE_CROWD_CONFIDENCE;
			if (isDenseCrowd && !options._internal && !options.confidence && !options.iou && upscale < 2)
				return detector.detect(image, upscale * 2, blur, {
					confidence: DENSE_CROWD_CONFIDENCE,
					iou: DENSE_CROWD_IOU,
					_internal: true
				});
			const confidence =
				options.confidence ?? (isDenseCrowd ? DENSE_CROWD_CONFIDENCE : SPARSE_QUEUE_CONFIDENCE);
			const iou = options.iou ?? (isDenseCrowd ? DENSE_CROWD_IOU : SPARSE_QUEUE_IOU);
			const kept = nms(
				allRawBoxes.filter((b) => b.score >= confidence),
				iou
			);
			return kept.map((b) => ({
				x: b.x1,
				y: b.y1,
				w: b.x2 - b.x1,
				h: b.y2 - b.y1,
				score: b.score
			}));
		},

		async release(): Promise<void> {
			await session.release();
		}
	};
	return detector;
}
