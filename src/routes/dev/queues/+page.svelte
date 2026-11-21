<script lang="ts">
	import { loadDetector } from '#lib/queues/detect.ts';
	import { openPicture, recentFrames, type Frame } from '#lib/queues/pictures.ts';
	import type { QueueCamera, Detection } from '#lib/queues/types.ts';

	interface QueueResult {
		lift: string;
		date: string;
		time: string;
		count: number;
		ms: number;
		detections: Detection[];
	}

	interface QueuedWindow extends Window {
		__queues?: QueueResult[];
		__queuesDone?: boolean;
		__queuesError?: string;
	}

	interface QueueItem {
		lift: string;
		date: string;
		time: string;
		count: number;
		ms: number;
		detections: Detection[];
		canvas: OffscreenCanvas;
	}

	let status = $state('Initializing...');
	let progress = $state(0);
	let items = $state<QueueItem[]>([]);
	let error = $state<string | null>(null);

	const HIGH_RES_WIDTH_THRESHOLD_PX = 1600;
	const LOW_RES_PREVIEW_SCALE = 2;
	const HIGH_RES_PREVIEW_SCALE = 1;

	function drawResult(
		node: HTMLCanvasElement,
		data: { canvas: OffscreenCanvas; detections: Detection[] }
	) {
		const previewScale =
			data.canvas.width > HIGH_RES_WIDTH_THRESHOLD_PX
				? HIGH_RES_PREVIEW_SCALE
				: LOW_RES_PREVIEW_SCALE;
		node.width = data.canvas.width * previewScale;
		node.height = data.canvas.height * previewScale;
		const ctx = node.getContext('2d');
		if (!ctx) return;
		ctx.imageSmoothingEnabled = false;
		ctx.drawImage(data.canvas, 0, 0, node.width, node.height);
		ctx.strokeStyle = '#00ff44';
		ctx.lineWidth = 2;
		ctx.fillStyle = '#00ff44';
		ctx.font = 'bold 12px monospace';
		for (const detection of data.detections) {
			const boxX = detection.x * previewScale;
			const boxY = detection.y * previewScale;
			const boxWidth = detection.w * previewScale;
			const boxHeight = detection.h * previewScale;
			ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
			ctx.fillText(`${Math.round(detection.score * 100)}%`, boxX, Math.max(12, boxY - 3));
		}
	}

	async function run() {
		const win = window as QueuedWindow;
		try {
			status = 'Loading detector model...';
			const detector = await loadDetector('/models/yolo11n.onnx', (share: number) => {
				progress = share;
			});

			const urlParams = new URLSearchParams(window.location.search);
			const resortId = urlParams.get('resort') || 'soelden';
			const requestedDate = urlParams.get('date');
			const requestedTime = urlParams.get('time');

			status = `Loading cameras config for ${resortId}...`;
			const camsRes = await fetch(`/data/${resortId}-queues.json`);
			if (!camsRes.ok) throw new Error(`Failed to load ${resortId}-queues.json: ${camsRes.status}`);
			const cameras: QueueCamera[] = await camsRes.json();

			const resortData = await fetch(`/data/${resortId}.json`)
				.then((res) => (res.ok ? (res.json() as Promise<{ timezone?: string }>) : null))
				.catch(() => null);
			const timezone = resortData?.timezone ?? 'Europe/Vienna';

			const results: QueueResult[] = [];

			const place = { id: resortId, timezone };
			for (const cam of cameras) {
				let frame: Frame | undefined;
				if (requestedDate && requestedTime) {
					const cameraSupportsArchive = cam.source.kind === 'panomax';
					frame = cameraSupportsArchive ? { date: requestedDate, time: requestedTime } : undefined;
				} else {
					status = `Fetching latest frame for ${cam.name}...`;
					frame = (await recentFrames(place, cam, 1))[0];
				}

				if (!frame) {
					console.warn(`No frame found for camera ${cam.camera}`);
					continue;
				}
				const picture = openPicture(place, cam, frame);

				for (const region of cam.regions) {
					status = `Processing ${region.id}...`;
					const detectionStartTime = performance.now();
					const regionCanvas = await picture.crop(region);
					const detections = await detector.detect(regionCanvas, region.upscale, region.blur);
					const ms = Math.round(performance.now() - detectionStartTime);
					frame = picture.frame;

					const item: QueueItem = {
						lift: region.id,
						date: frame.date,
						time: frame.time,
						count: detections.length,
						ms,
						detections,
						canvas: regionCanvas
					};
					items = [...items, item];
					results.push({
						lift: region.id,
						date: frame.date,
						time: frame.time,
						count: detections.length,
						ms,
						detections
					});
				}
			}

			await detector.release();
			status = 'Finished';
			win.__queues = results;
			win.__queuesDone = true;
		} catch (err) {
			console.error('Queue processing error:', err);
			const msg = err instanceof Error ? err.message : String(err);
			error = msg;
			status = `Error: ${msg}`;
			win.__queuesError = msg;
			win.__queuesDone = true;
		}
	}

	$effect(() => {
		run();
	});
</script>

<div
	class="fixed inset-0 overflow-y-auto overscroll-contain bg-neutral-950 p-6 font-sans text-neutral-100"
>
	<header
		class="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-neutral-800 pb-4"
	>
		<div>
			<h1 class="text-xl font-bold tracking-tight">Lift Queue Detector Debug</h1>
			<p class="mt-1 text-sm text-neutral-400">
				Status: <span class="font-mono text-neutral-200">{status}</span>
				{#if progress > 0 && progress < 1}
					<span class="ml-2 font-mono text-xs text-sky-400">({Math.round(progress * 100)}%)</span>
				{/if}
			</p>
		</div>
		{#if error}
			<div class="rounded border border-rose-700 bg-rose-950/80 px-3 py-1.5 text-xs text-rose-300">
				{error}
			</div>
		{/if}
	</header>

	<main class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
		{#each items as item (item.lift)}
			<div class="flex flex-col gap-3 rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
				<div class="flex items-center justify-between">
					<div>
						<h2 class="text-base font-semibold text-neutral-100">{item.lift}</h2>
						<span class="font-mono text-xs text-neutral-400">{item.date} {item.time}</span>
					</div>
					<div class="flex items-center gap-2">
						<span
							class="rounded border border-sky-800 bg-sky-950 px-2 py-0.5 font-mono text-xs text-sky-300"
						>
							{item.ms} ms
						</span>
						<span
							class="rounded border border-emerald-800 bg-emerald-950 px-2.5 py-0.5 font-mono text-xs font-bold text-emerald-300"
						>
							Count: {item.count}
						</span>
					</div>
				</div>

				<div
					class="flex justify-center overflow-auto rounded border border-neutral-800 bg-black/50 p-1"
				>
					<canvas
						use:drawResult={{ canvas: item.canvas, detections: item.detections }}
						class="h-auto max-w-full object-contain"
					></canvas>
				</div>
			</div>
		{/each}
	</main>
</div>
