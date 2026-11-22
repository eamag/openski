<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { LngLat } from '#lib/geo.ts';
	import ResortMap from '#lib/map/ResortMap.svelte';
	import { resortPageFromRouteId, resortTitle, type TitledResort } from '#lib/page-titles.ts';
	import { t } from '#lib/i18n/index.ts';
	import { app } from '#lib/state/app.svelte.ts';
	import { catalogResort } from '#lib/state/catalog.ts';
	import { conditions } from '#lib/state/conditions.svelte.ts';
	import { location } from '#lib/state/location.svelte.ts';
	import { progress } from '#lib/state/progress.svelte.ts';
	import { queues } from '#lib/state/queues.svelte.ts';
	import { route } from '#lib/state/route.svelte.ts';
	import { status } from '#lib/state/status.svelte.ts';
	import { tracking } from '#lib/state/tracking.svelte.ts';
	import { theme as appearance } from '#lib/state/theme.svelte.ts';
	import { getPisteColors } from '#lib/resort/difficulty.ts';
	import BottomNav from '#lib/ui/BottomNav.svelte';
	import Icon from '#lib/ui/Icon.svelte';
	import MapControls from '#lib/ui/MapControls.svelte';
	import Settings from '#lib/ui/Settings.svelte';
	import type { LayoutProps } from './$types';

	const LIVE_STATUS_POLL_INTERVAL_MS = 5 * 60_000;
	const DEFAULT_SIMULATION_SPEED_MULTIPLIER = 20;

	let { children }: LayoutProps = $props();

	const resortId = $derived(page.params.resort ?? '');
	let lastInitResortId = $state<string | null>(null);
	let catalogEntry = $state<TitledResort | null>(null);

	$effect(() => {
		const id = resortId;
		catalogEntry = null;
		void catalogResort(id).then((entry) => {
			if (resortId === id) catalogEntry = entry ?? null;
		});
	});

	// Piste colours follow the resort's signs (green circle = easy in North America).
	const pisteCssStyle = $derived.by(() => {
		const colors = getPisteColors(app.country, appearance.dark);
		return [
			`--piste-novice: ${colors.novice}`,
			`--piste-easy: ${colors.easy}`,
			`--piste-intermediate: ${colors.intermediate}`,
			`--piste-advanced: ${colors.advanced}`,
			`--piste-expert: ${colors.expert}`,
			`--piste-freeride: ${colors.freeride}`,
			`--piste-unknown: ${colors.unknown}`
		].join('; ');
	});

	onMount(() => {
		app.restoreOptions();
		void route.restorePrefs();
		const isRunningSimulation = page.url.searchParams.has('sim');
		void navigator.permissions
			?.query({ name: 'geolocation' })
			.then((permissionStatus) => {
				if (permissionStatus.state === 'granted' && !isRunningSimulation) location.start();
			})
			.catch(() => undefined);
	});

	$effect(() => {
		const id = resortId;
		if (!id) return;
		untrack(() => {
			void app.load(id);
		});
	});

	$effect(() => {
		const resort = app.resort;
		if (!resort) return;
		if (lastInitResortId === resort.id) return;
		lastInitResortId = resort.id;
		untrack(() => {
			void progress.init(resort);
			void tracking.checkDraft();
			void conditions.load();
			void queues.init();
			void status.load();
			const simulationSpeedParam = page.url.searchParams.get('sim');
			if (simulationSpeedParam !== null) {
				const speedMultiplier = Number(simulationSpeedParam) || DEFAULT_SIMULATION_SPEED_MULTIPLIER;
				void import('#lib/dev/simulate.ts').then((module) =>
					module.startSimulation(resort, speedMultiplier)
				);
			}
		});
	});

	$effect(() => {
		if (!app.resort) return;
		const refreshLiveStatusWhenVisible = () => {
			if (document.visibilityState === 'visible') void status.load();
		};
		const timer = setInterval(refreshLiveStatusWhenVisible, LIVE_STATUS_POLL_INTERVAL_MS);
		document.addEventListener('visibilitychange', refreshLiveStatusWhenVisible);
		return () => {
			clearInterval(timer);
			document.removeEventListener('visibilitychange', refreshLiveStatusWhenVisible);
		};
	});

	$effect(() => {
		const currentRouteId = page.route.id;
		const targetMode = currentRouteId?.includes('/progress')
			? 'progress'
			: currentRouteId?.includes('/now')
				? 'conditions'
				: 'pistes';
		if (app.mode !== targetMode) app.mode = targetMode;
	});

	function onpick(at: LngLat) {
		if (app.picking === 'from') route.from = { kind: 'point', at };
		else route.to = { kind: 'point', at };
		app.picking = null;
	}

	const resortName = $derived(
		(app.resort?.id === resortId ? app.resort.data.name : catalogEntry?.name) ?? resortId
	);

	const pageTitle = $derived(
		catalogEntry ? resortTitle(catalogEntry, resortPageFromRouteId(page.route.id)) : null
	);
</script>

<svelte:head>
	{#if pageTitle}
		<title>{pageTitle}</title>
	{/if}
</svelte:head>

{#if app.loadError}
	<div
		class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-surface p-6 text-center"
	>
		<div class="max-w-sm rounded-3xl border border-line bg-surface-2 p-6 shadow-sm">
			<span
				class="mb-4 inline-flex size-12 items-center justify-center rounded-full bg-warn/15 text-warn"
			>
				<Icon name="map" size={24} />
			</span>
			<h1 class="text-lg font-bold text-ink">{t.map.unavailable}</h1>
			<p class="mt-2 text-sm leading-relaxed text-ink-soft">{app.loadError}</p>
			<a
				href={resolve('/(app)/resorts')}
				class="mt-6 inline-flex h-11 w-full items-center justify-center rounded-2xl bg-accent font-semibold text-accent-ink"
			>
				{t.map.chooseResort}
			</a>
		</div>
	</div>
{:else}
	<div class="fixed inset-0 flex flex-col bg-surface" style={pisteCssStyle}>
		<main class="relative min-h-0 flex-1 overflow-hidden">
			<ResortMap {onpick} />
			<MapControls {resortId} />
			{#if !app.picking}
				<div
					class="pointer-events-none absolute inset-x-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-20 mx-auto flex max-w-xl md:mx-0 md:max-w-md"
				>
					<a
						href={resolve('/(app)/resorts')}
						class="pointer-events-auto flex h-9 min-w-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-sm font-semibold text-ink shadow-[0_2px_10px_rgb(0_0_0/0.14)]"
						aria-label="{resortName}: {t.map.chooseDifferentResort}"
						title={resortName}
						data-sveltekit-reset="false"
					>
						<Icon name="map" size={14} />
						<span class="min-w-0 truncate">{resortName}</span>
						<span class="shrink-0 rotate-90 text-ink-soft"><Icon name="chevron" size={13} /></span>
					</a>
				</div>
			{/if}
			{#if app.picking}
				<div
					class="absolute inset-x-4 top-[calc(env(safe-area-inset-top)+1rem)] z-30 flex items-center justify-between gap-3 rounded-2xl bg-ink px-4 py-3 text-sm font-medium text-surface shadow-lg"
				>
					{t.map.tapMapToSet(app.picking === 'from' ? t.map.start : t.map.destination)}
					<button class="rounded-full bg-surface/20 px-3 py-1" onclick={() => (app.picking = null)}>
						{t.common.cancel}
					</button>
				</div>
			{/if}
			<div class="pointer-events-none absolute inset-0" class:hidden={!!app.picking}>
				{@render children()}
			</div>
			<Settings />
		</main>
		<BottomNav {resortId} />
	</div>
{/if}
