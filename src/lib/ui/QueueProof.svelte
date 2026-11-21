<script lang="ts">
	import { t } from '#lib/i18n/index.ts';
	import { viewerUrl } from '#lib/queues/pictures.ts';
	import type { QueueCamera } from '#lib/queues/types.ts';
	import type { QueueReading } from '#lib/state/queues.svelte.ts';
	import Icon from './Icon.svelte';

	let { reading, camera, crop }: { reading: QueueReading; camera: QueueCamera; crop?: string } =
		$props();

	const CROP_STRIP_TARGET_HEIGHT_PX = 190;
	const DETECTION_BOX_STROKE_COLOR = '#3dff7a';

	const [sourceWidth, sourceHeight] = $derived(reading.size);
	const minScrollableStripWidthPx = $derived(
		Math.round((sourceWidth / sourceHeight) * CROP_STRIP_TARGET_HEIGHT_PX)
	);
	let showDetectionBoxes = $state(true);
</script>

<figure class="mt-1 mb-3">
	{#if crop}
		<div class="no-scrollbar overflow-x-auto rounded-2xl bg-black">
			<button
				class="relative block"
				style:width="max(100%, {minScrollableStripWidthPx}px)"
				onclick={() => (showDetectionBoxes = !showDetectionBoxes)}
				aria-pressed={showDetectionBoxes}
				aria-label={showDetectionBoxes ? t.queues.hideBoxes : t.queues.showBoxes}
			>
				<img
					src={crop}
					alt={t.queues.pictureAlt(reading.frame.time, reading.people)}
					class="block w-full"
					style:aspect-ratio="{sourceWidth} / {sourceHeight}"
				/>
				{#if showDetectionBoxes}
					<svg
						viewBox="0 0 {sourceWidth} {sourceHeight}"
						preserveAspectRatio="none"
						class="absolute inset-0 size-full"
						aria-hidden="true"
					>
						{#each reading.detections as detection, detectionIndex (detectionIndex)}
							<rect
								x={detection.x}
								y={detection.y}
								width={detection.w}
								height={detection.h}
								fill="none"
								stroke={DETECTION_BOX_STROKE_COLOR}
								stroke-width="1.5"
								vector-effect="non-scaling-stroke"
							/>
						{/each}
					</svg>
				{/if}
			</button>
		</div>
	{:else}
		<p class="rounded-2xl bg-surface-2 px-3 py-3 text-xs text-ink-soft">
			{t.queues.pictureMissingDevice}
		</p>
	{/if}
	<figcaption class="mt-2 text-xs leading-relaxed text-ink-soft">
		<span class="tabular">
			{t.queues.boxedSummary(reading.people, camera.name, reading.frame.time)}
		</span>
		{#if crop}{t.queues.tapToHideBoxes}{/if}
		<span class="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 font-medium text-accent">
			{#each reading.sources as sourceUrl, sourceIndex (sourceUrl)}
				<a
					href={sourceUrl}
					target="_blank"
					rel="external noopener noreferrer"
					class="flex items-center gap-1"
				>
					<Icon name="external" size={13} />
					{t.queues.originalPicture(
						reading.sources.length > 1 ? sourceIndex + 1 : undefined,
						reading.sources.length > 1 ? reading.sources.length : undefined
					)}
				</a>
			{/each}
			<a
				href={viewerUrl(camera, reading.frame)}
				target="_blank"
				rel="external noopener noreferrer"
				class="flex items-center gap-1"
			>
				<Icon name="camera" size={13} />
				{t.queues.openWebcam}
			</a>
		</span>
	</figcaption>
</figure>
