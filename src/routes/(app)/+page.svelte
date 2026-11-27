<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { t } from '#lib/i18n/index.ts';
	import { homeTitle } from '#lib/page-titles.ts';
	import { app } from '#lib/state/app.svelte.ts';
	import { loadCatalog, nearestBuilt, resortAt } from '#lib/state/catalog.ts';
	import Icon from '#lib/ui/Icon.svelte';

	const MIN_SIZABLE_RESORT_KM = 30;
	const GEOLOCATION_TIMEOUT_MS = 8000;
	const MAX_COARSE_GEOLOCATION_AGE_MS = 30 * 60_000;

	const initialReturning = !navigator.onLine && Boolean(app.openedBefore);
	let mode = $state<'choose' | 'locating' | 'opening'>(
		app.openedBefore || initialReturning ? 'opening' : 'choose'
	);
	let locationFailed = $state(false);
	let isTransitioningToResort = false;

	function open(resortId: string) {
		if (isTransitioningToResort) return;
		isTransitioningToResort = true;
		void goto(resolve(`${resortId}${page.url.search}`), { replace: true });
	}

	async function permission(): Promise<PermissionState | 'unknown'> {
		try {
			return (await navigator.permissions.query({ name: 'geolocation' })).state;
		} catch {
			return 'unknown';
		}
	}

	function position(): Promise<GeolocationPosition | null> {
		if (!('geolocation' in navigator)) return Promise.resolve(null);
		return new Promise((resolve) => {
			const timer = setTimeout(() => resolve(null), GEOLOCATION_TIMEOUT_MS);
			navigator.geolocation.getCurrentPosition(
				(p) => {
					clearTimeout(timer);
					resolve(p);
				},
				() => {
					clearTimeout(timer);
					resolve(null);
				},
				{
					enableHighAccuracy: false,
					maximumAge: MAX_COARSE_GEOLOCATION_AGE_MS,
					timeout: GEOLOCATION_TIMEOUT_MS
				}
			);
		});
	}

	async function openNearestResort(fallbackToLastResort: boolean): Promise<void> {
		mode = 'locating';
		locationFailed = false;
		const [resorts, pos] = await Promise.all([loadCatalog(true), position()]);
		const storedResortId = app.openedBefore;
		const lastValidResortId =
			storedResortId && (!resorts || resorts.some((r) => r.id === storedResortId && r.built))
				? storedResortId
				: null;
		if (!pos) {
			if (fallbackToLastResort) return open(lastValidResortId ?? app.lastResort);
			mode = 'choose';
			locationFailed = true;
			return;
		}
		const [lon, lat] = [pos.coords.longitude, pos.coords.latitude];
		const currentResort = resorts ? resortAt(resorts, lon, lat, lastValidResortId) : null;
		if (currentResort) return open(currentResort.id);
		if (lastValidResortId) return open(lastValidResortId);
		const nearest = resorts
			? (nearestBuilt(resorts, lon, lat, MIN_SIZABLE_RESORT_KM) ?? nearestBuilt(resorts, lon, lat))
			: null;
		if (nearest) return open(nearest.resort.id);
		if (fallbackToLastResort) return open(app.lastResort);
		mode = 'choose';
		locationFailed = true;
	}

	onMount(async () => {
		// Offline on the mountain: reopen the last map instead of waiting for a location fix.
		if (!navigator.onLine && app.openedBefore) return open(app.openedBefore);
		// Only locate automatically when permission is already granted so first-time visits
		// never stall on an unrequested permission prompt or silently bypass resort choice.
		const granted = (await permission()) === 'granted';
		if (granted) return void openNearestResort(true);
		if (app.openedBefore) {
			mode = 'opening';
			return open(app.openedBefore);
		}
		mode = 'choose';
	});
</script>

<svelte:head>
	<title>{homeTitle()}</title>
</svelte:head>

<div class="fixed inset-0 flex flex-col items-center justify-center bg-surface p-6">
	{#if mode === 'choose'}
		<div class="flex w-full max-w-sm flex-col gap-5 text-center">
			<div>
				<h1 class="text-2xl font-bold tracking-tight text-ink">openski.org</h1>
				<p class="mt-2 text-sm leading-relaxed text-ink-soft">{t.home.subtitle}</p>
			</div>

			<div class="flex flex-col gap-2.5">
				<button
					type="button"
					class="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-accent px-4 text-[15px] font-semibold text-accent-ink shadow-sm active:scale-[0.99]"
					onclick={() => void openNearestResort(false)}
				>
					<Icon name="locate" size={18} />
					{t.home.useLocation}
				</button>

				<a
					href={resolve('/(app)/resorts')}
					class="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-line bg-surface-2 px-4 text-[15px] font-semibold text-ink active:scale-[0.99]"
				>
					<Icon name="search" size={18} />
					{t.home.chooseFromList}
				</a>

				<a
					href={resolve('/(app)/[resort]', { resort: 'soelden' })}
					class="mt-1 flex flex-col rounded-2xl border border-line px-4 py-3 text-left transition hover:border-accent/40 active:scale-[0.99]"
				>
					<span class="flex items-center justify-between text-sm font-semibold text-ink">
						{t.home.previewSoelden}
						<span class="text-accent"><Icon name="chevron" size={16} /></span>
					</span>
					<span class="mt-0.5 text-xs text-ink-soft">{t.home.previewSoeldenHint}</span>
				</a>
			</div>

			{#if locationFailed}
				<p
					class="rounded-2xl bg-warn/15 px-3.5 py-2.5 text-xs leading-relaxed text-warn"
					role="alert"
				>
					{t.home.locationFailed}
				</p>
			{/if}

			<p class="text-[11px] text-ink-soft">
				{t.home.dataBy}
				<a
					href="https://www.openstreetmap.org/copyright"
					target="_blank"
					rel="external noopener noreferrer"
					class="underline"
				>
					© OpenStreetMap
				</a>
				·
				<a
					href="https://openskimap.org/"
					target="_blank"
					rel="external noopener noreferrer"
					class="underline"
				>
					OpenSkiMap
				</a>
			</p>
		</div>
	{:else}
		<div class="flex flex-col items-center gap-4 text-center">
			<span class="size-7 animate-spin rounded-full border-2 border-accent border-t-transparent"
			></span>
			<div>
				<h1 class="text-lg font-bold tracking-tight text-ink">openski.org</h1>
				<p class="mt-1 text-sm text-ink-soft">
					{mode === 'locating' ? t.home.findingNearby : t.home.opening}
				</p>
			</div>
		</div>
	{/if}
</div>
