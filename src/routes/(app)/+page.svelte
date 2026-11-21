<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { t } from '#lib/i18n/index.ts';
	import { homeTitle } from '#lib/page-titles.ts';
	import { app } from '#lib/state/app.svelte.ts';
	import { loadCatalog, nearestBuilt, resortAt } from '#lib/state/catalog.ts';

	const MIN_SIZABLE_RESORT_KM = 30;
	const GEOLOCATION_TIMEOUT_MS = 8000;
	const MAX_COARSE_GEOLOCATION_AGE_MS = 30 * 60_000;

	let asking = $state(false);
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

	function position(enforceDeadlineTimeout: boolean): Promise<GeolocationPosition | null> {
		if (!('geolocation' in navigator)) return Promise.resolve(null);
		return new Promise((resolve) => {
			const timer = enforceDeadlineTimeout
				? setTimeout(() => resolve(null), GEOLOCATION_TIMEOUT_MS)
				: undefined;
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

	onMount(async () => {
		// Offline on the mountain: reopen the last map instead of waiting for a location fix.
		if (!navigator.onLine && app.openedBefore) return open(app.openedBefore);
		const permissionState = await permission();
		const isAskingForPermission = permissionState !== 'granted' && permissionState !== 'denied';
		asking = isAskingForPermission;
		const isLocationDenied = permissionState === 'denied';
		const [resorts, pos] = await Promise.all([
			loadCatalog(),
			isLocationDenied ? null : position(!isAskingForPermission)
		]);
		const storedResortId = app.openedBefore;
		const isStoredResortValidAndBuilt =
			storedResortId && (!resorts || resorts.some((r) => r.id === storedResortId && r.built));
		const lastValidResortId = isStoredResortValidAndBuilt ? storedResortId : null;
		const [lon, lat] = pos ? [pos.coords.longitude, pos.coords.latitude] : [0, 0];
		const currentResort = resorts && pos ? resortAt(resorts, lon, lat, lastValidResortId) : null;
		if (currentResort) return open(currentResort.id);
		if (lastValidResortId) return open(lastValidResortId);
		const nearest =
			resorts && pos
				? (nearestBuilt(resorts, lon, lat, MIN_SIZABLE_RESORT_KM) ??
					nearestBuilt(resorts, lon, lat))
				: null;
		open(nearest?.resort.id ?? app.lastResort);
	});
</script>

<svelte:head>
	<title>{homeTitle()}</title>
</svelte:head>

<div
	class="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-surface p-6 text-center"
>
	<span class="size-7 animate-spin rounded-full border-2 border-accent border-t-transparent"></span>
	<div>
		<h1 class="text-lg font-bold tracking-tight text-ink">openski.org</h1>
		<p class="mt-1 text-sm text-ink-soft">
			{asking ? t.home.allowLocation : t.home.findingNearby}
		</p>
	</div>
	{#if asking}
		<div class="flex gap-2">
			<button
				class="h-10 rounded-2xl border border-line bg-surface-2 px-4 text-sm font-medium text-ink"
				onclick={() => open(app.lastResort)}
			>
				{t.common.skip}
			</button>
			<a
				href={resolve('/(app)/resorts')}
				class="flex h-10 items-center rounded-2xl border border-line bg-surface-2 px-4 text-sm font-medium text-ink"
				onclick={() => (isTransitioningToResort = true)}
			>
				{t.home.chooseFromList}
			</a>
		</div>
	{/if}
</div>
