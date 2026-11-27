<script lang="ts">
	import type { Snippet } from 'svelte';
	import { t } from '#lib/i18n/index.ts';
	import { app } from '#lib/state/app.svelte.ts';

	const FOLDED_MAX_HEIGHT = '10.5rem';
	const TALL_MAX_HEIGHT = '72%';
	const DEFAULT_MAX_HEIGHT = '56%';

	let {
		children,
		tall = false,
		collapsible = false,
		heightAware = true
	}: { children: Snippet; tall?: boolean; collapsible?: boolean; heightAware?: boolean } = $props();
	let height = $state(0);
	let folded = $state(false);

	const currentMaxHeight = $derived(
		folded ? FOLDED_MAX_HEIGHT : tall ? TALL_MAX_HEIGHT : DEFAULT_MAX_HEIGHT
	);

	function measureHeight(node: HTMLElement) {
		const sync = () => {
			height = node.offsetHeight;
		};
		sync();
		const observer = new ResizeObserver(sync);
		observer.observe(node);
		return {
			destroy() {
				observer.disconnect();
			}
		};
	}

	$effect(() => {
		if (!heightAware) return;
		app.sheetHeight = height;
		return () => {
			app.sheetHeight = 0;
		};
	});
</script>

<section
	use:measureHeight
	class="pointer-events-auto absolute inset-x-0 bottom-0 z-20 mx-auto flex w-full max-w-xl flex-col rounded-t-3xl border-t border-line bg-surface shadow-[0_-8px_30px_rgb(0_0_0/0.12)] transition-[max-height] duration-200 md:bottom-4 md:left-4 md:mx-0 md:max-w-md md:rounded-3xl md:border"
	style:max-height={currentMaxHeight}
>
	{#if collapsible}
		<button
			class="mx-auto flex h-6 w-24 shrink-0 items-center justify-center"
			onclick={() => (folded = !folded)}
			aria-expanded={!folded}
			aria-label={folded ? t.map.sheet.expand : t.map.sheet.collapse}
		>
			<span class="h-1 w-9 rounded-full bg-line"></span>
		</button>
	{:else}
		<div class="mx-auto mt-2 mb-2.5 h-1 w-9 shrink-0 rounded-full bg-line md:hidden"></div>
	{/if}
	<div
		class="no-scrollbar min-h-0 flex-1 overscroll-contain px-4 pb-4 {folded
			? 'overflow-hidden'
			: 'overflow-y-auto'} {collapsible ? '' : 'md:pt-3'}"
	>
		{@render children()}
	</div>
</section>
