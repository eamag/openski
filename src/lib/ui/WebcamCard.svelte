<script lang="ts">
	import {
		isHeavy,
		pictureCandidates,
		providerLabel,
		webcams,
		type Webcam
	} from '#lib/state/webcams.svelte.ts';
	import { resolve } from '$app/paths';
	import { t } from '#lib/i18n/index.ts';
	import { app } from '#lib/state/app.svelte.ts';
	import Icon from './Icon.svelte';

	let { cam }: { cam: Webcam } = $props();

	const PANORAMA_ASPECT_RATIO_THRESHOLD = 2.2;

	let pictureCandidateUrls = $state.raw<string[] | null>(null);
	let candidateAttemptIndex = $state(0);
	let isPictureLoaded = $state(false);
	let isPictureFailed = $state(false);
	let isPanoramicAspect = $state(false);
	let userConfirmedHeavyDownload = $state(false);

	const hasImageUrl = $derived(!!cam.imageUrl);
	const shouldLoadPicture = $derived(hasImageUrl && (!isHeavy(cam) || userConfirmedHeavyDownload));

	$effect(() => {
		if (!shouldLoadPicture) return;
		let isCurrent = true;
		void pictureCandidates(cam).then((candidateList) => {
			if (!isCurrent) return;
			pictureCandidateUrls = candidateList;
			isPictureFailed = candidateList.length === 0;
		});
		return () => {
			isCurrent = false;
		};
	});

	const currentPictureUrl = $derived(pictureCandidateUrls?.[candidateAttemptIndex]);
	const displayName = $derived(cam.name || t.webcams.webcam);

	function handleImageLoad(event: Event) {
		const imgElement = event.currentTarget as HTMLImageElement;
		const aspectRatio = imgElement.naturalWidth / Math.max(1, imgElement.naturalHeight);
		isPanoramicAspect = aspectRatio > PANORAMA_ASPECT_RATIO_THRESHOLD;
		isPictureLoaded = true;
	}

	function handleImageError() {
		if (pictureCandidateUrls && candidateAttemptIndex + 1 < pictureCandidateUrls.length) {
			candidateAttemptIndex++;
		} else {
			isPictureFailed = true;
		}
	}
</script>

<div class="flex items-start gap-3">
	<span class="grid size-11 shrink-0 place-items-center rounded-full bg-surface-2 text-ink">
		<Icon name="camera" size={24} />
	</span>
	<div class="min-w-0 flex-1">
		<h2 class="truncate text-lg leading-tight font-semibold">{displayName}</h2>
		<p class="text-sm text-ink-soft">
			{t.webcams.webcam}{t.common.separator}<a
				href={cam.url}
				target="_blank"
				rel="external noopener noreferrer"
				class="underline"
			>
				{providerLabel(cam)}
			</a>
		</p>
	</div>
	<button
		class="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-soft"
		onclick={() => (webcams.selected = null)}
		aria-label={t.common.close}
	>
		<Icon name="x" size={18} />
	</button>
</div>

{#if hasImageUrl}
	{#if shouldLoadPicture && !isPictureFailed}
		<div
			class="no-scrollbar relative mt-3 overflow-x-auto rounded-2xl bg-surface-2"
			class:min-h-36={!isPictureLoaded}
		>
			{#if currentPictureUrl}
				{#snippet picture()}
					<img
						src={currentPictureUrl}
						alt={t.webcams.pictureAlt(displayName)}
						loading="lazy"
						decoding="async"
						referrerpolicy="no-referrer"
						class="block max-w-none {isPanoramicAspect ? 'h-44 w-auto' : 'h-auto w-full'}"
						onload={handleImageLoad}
						onerror={handleImageError}
					/>
				{/snippet}
				{#if isPanoramicAspect}
					{@render picture()}
				{:else}
					<a href={cam.url} target="_blank" rel="external noopener noreferrer">
						{@render picture()}
					</a>
				{/if}
			{/if}
			{#if !isPictureLoaded}
				<span class="absolute inset-0 grid place-items-center text-xs text-ink-soft">
					{t.webcams.loading}
				</span>
			{/if}
		</div>
	{:else if isPictureFailed}
		<p class="mt-3 rounded-2xl bg-surface-2 px-3 py-3 text-xs text-ink-soft">
			{t.webcams.unavailable}
		</p>
	{:else}
		<button
			class="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-surface-2 font-medium"
			onclick={() => (userConfirmedHeavyDownload = true)}
		>
			<Icon name="eye" size={18} />
			{t.webcams.showPicture}
			<span class="text-xs font-normal text-ink-soft">{t.webcams.heavyHint}</span>
		</button>
	{/if}
{/if}

<a
	href={cam.url}
	target="_blank"
	rel="external noopener noreferrer"
	class="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-accent font-semibold text-accent-ink"
>
	<Icon name="external" size={18} />
	{t.webcams.openPage}
</a>
{#if app.resort && cam.provider && cam.imageUrl}
	<a
		href={resolve(
			`/contribute/webcam?resort=${app.resort.data.id}&url=${encodeURIComponent(cam.url)}`
		)}
		class="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-line font-medium"
	>
		<Icon name="users" size={18} />
		{t.webcams.countQueues}
	</a>
{/if}
