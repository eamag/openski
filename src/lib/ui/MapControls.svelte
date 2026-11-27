<script lang="ts">
	import { onMount } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { t } from '#lib/i18n/index.ts';
	import { app } from '#lib/state/app.svelte.ts';
	import { location } from '#lib/state/location.svelte.ts';
	import { settings } from '#lib/state/settings.svelte.ts';
	import Icon from './Icon.svelte';

	let { resortId }: { resortId: string } = $props();

	function locate() {
		location.start();
		app.follow = true;
	}
	const isLocationUnavailable = $derived(
		location.status === 'denied' || location.status === 'unavailable'
	);
	const wide = new MediaQuery('min-width: 768px');
	const CONTROLS_BOTTOM_MARGIN_PX = 16;
	const controlsBottomOffsetPx = $derived(
		(wide.current ? 0 : app.sheetHeight) + CONTROLS_BOTTOM_MARGIN_PX
	);
	const BELOW_RESORT_CHIP_REM = 3.5;
	const BELOW_MAP_SEARCH_BAR_REM = 7;
	const controlsTopLimit = $derived(
		`calc(env(safe-area-inset-top) + ${page.route.id === '/(app)/[resort]' ? BELOW_MAP_SEARCH_BAR_REM : BELOW_RESORT_CHIP_REM}rem)`
	);

	// Enable bottom transitions only after the initial layout frame so mounting alongside a
	// bottom sheet does not animate upward and trigger Cumulative Layout Shift.
	let animateBottom = $state(false);
	onMount(() => {
		const id = requestAnimationFrame(() => (animateBottom = true));
		return () => cancelAnimationFrame(id);
	});
</script>

{#if app.resort}
	<div
		class="pointer-events-none absolute right-3 z-10 flex flex-col-reverse flex-wrap-reverse content-start gap-2 {animateBottom
			? 'transition-[bottom] duration-200'
			: ''}"
		style:top={controlsTopLimit}
		style:bottom="{controlsBottomOffsetPx}px"
	>
		<button
			class="fab {app.follow && location.fix ? 'on' : ''} {isLocationUnavailable ? 'off' : ''}"
			onclick={locate}
			aria-label={isLocationUnavailable ? t.map.locationUnavailable : t.map.showLocation}
		>
			<Icon name="locate" />
		</button>
		<button
			class="fab {app.terrain ? 'on' : ''}"
			onclick={() => (app.terrain = !app.terrain)}
			aria-pressed={app.terrain}
			aria-label={t.map.terrain3d}
		>
			<Icon name="mountain" />
		</button>
		<a
			class="fab"
			href={resolve('/(app)/[resort]/questions', { resort: resortId })}
			aria-label={t.map.helpAria}
		>
			<Icon name="help" />
		</a>
		<button class="fab" onclick={() => settings.show()} aria-label={t.map.settings}>
			<Icon name="settings" />
		</button>
	</div>
{/if}

<style>
	.fab {
		pointer-events: auto;
		display: grid;
		place-items: center;
		width: 46px;
		height: 46px;
		border-radius: 9999px;
		background: var(--surface);
		color: var(--ink);
		border: 1px solid var(--line);
		box-shadow: 0 2px 10px rgb(0 0 0 / 0.14);
	}
	.fab.on {
		background: var(--accent);
		color: var(--accent-ink);
		border-color: transparent;
	}
	.fab.off {
		color: var(--bad);
	}
</style>
