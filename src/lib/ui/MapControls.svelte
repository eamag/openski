<script lang="ts">
	import { MediaQuery } from 'svelte/reactivity';
	import { resolve } from '$app/paths';
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
	const resortName = $derived(app.resort?.data.name ?? resortId);
	const wide = new MediaQuery('min-width: 768px');
	const CONTROLS_BOTTOM_MARGIN_PX = 16;
	const controlsBottomOffsetPx = $derived(
		(wide.current ? 0 : app.sheetHeight) + CONTROLS_BOTTOM_MARGIN_PX
	);
</script>

<div
	class="pointer-events-none absolute right-3 z-10 flex flex-col gap-2 transition-[bottom] duration-200"
	style:bottom="{controlsBottomOffsetPx}px"
>
	<a
		href={resolve('/(app)/resorts')}
		class="pointer-events-auto flex h-9 items-center gap-1.5 self-end rounded-full border border-line bg-surface px-3 text-xs font-medium text-ink shadow-[0_2px_10px_rgb(0_0_0/0.14)]"
		aria-label={t.map.chooseDifferentResort}
		data-sveltekit-reset="false"
	>
		<Icon name="map" size={13} />
		<span class="max-w-[120px] truncate">{resortName}</span>
		<Icon name="chevron" size={12} />
	</a>
	<button class="fab" onclick={() => settings.show()} aria-label={t.map.settings}>
		<Icon name="settings" />
	</button>
	<a
		class="fab"
		href={resolve('/(app)/[resort]/questions', { resort: resortId })}
		aria-label={t.map.helpAria}
	>
		<Icon name="help" />
	</a>
	<button
		class="fab {app.terrain ? 'on' : ''}"
		onclick={() => (app.terrain = !app.terrain)}
		aria-pressed={app.terrain}
		aria-label={t.map.terrain3d}
	>
		<Icon name="mountain" />
	</button>
	<button
		class="fab {app.follow && location.fix ? 'on' : ''} {isLocationUnavailable ? 'off' : ''}"
		onclick={locate}
		aria-label={isLocationUnavailable ? t.map.locationUnavailable : t.map.showLocation}
	>
		<Icon name="locate" />
	</button>
</div>

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
