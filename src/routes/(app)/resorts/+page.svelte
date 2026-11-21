<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { formatNumber, t, unitSymbol } from '#lib/i18n/index.ts';
	import { resortsTitle } from '#lib/page-titles.ts';
	import type { CatalogResort } from '#lib/resort/catalog.ts';
	import { getCatalogPisteColours } from '#lib/resort/difficulty.ts';
	import { app } from '#lib/state/app.svelte.ts';
	import { loadCatalog } from '#lib/state/catalog.ts';
	import { theme as appearance } from '#lib/state/theme.svelte.ts';
	import Icon from '#lib/ui/Icon.svelte';

	const MAX_SEARCH_RESULTS = 50;

	function breakdown(resort: CatalogResort) {
		const colors = getCatalogPisteColours(resort.country, appearance.dark);
		return colors
			.map((colour) => ({
				...colour,
				km: resort.pisteKm?.[colour.key] ?? 0
			}))
			.filter((colour) => colour.km > 0);
	}

	interface SearchableResort extends CatalogResort {
		searchKey: string;
	}

	let query = $state('');
	let loading = $state(true);
	let failed = $state(false);
	let resorts = $state.raw<SearchableResort[]>([]);
	let lastId = $state<string | null>(null);

	function normalize(s: string): string {
		return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
	}

	onMount(async () => {
		lastId = app.lastResort;
		const catalog = await loadCatalog();
		if (catalog) resorts = catalog.map((r) => ({ ...r, searchKey: normalize(r.name) }));
		else failed = true;
		loading = false;
	});

	const builtResorts = $derived(resorts.filter((r) => r.built));
	const lastResort = $derived(resorts.find((r) => r.id === lastId && r.built) ?? null);

	const searchResults = $derived.by(() => {
		const q = normalize(query);
		if (!q) return [];
		return resorts
			.filter((r) => r.searchKey.includes(q))
			.sort((a, b) => {
				if (a.built !== b.built) return a.built ? -1 : 1;
				const aStarts = a.searchKey.startsWith(q);
				const bStarts = b.searchKey.startsWith(q);
				if (aStarts !== bStarts) return aStarts ? -1 : 1;
				return b.km - a.km;
			})
			.slice(0, MAX_SEARCH_RESULTS);
	});
</script>

{#snippet stats(r: CatalogResort)}
	<p class="mt-0.5 text-xs text-ink-soft">
		{#if r.region}{r.region}{t.common.separator}{/if}
		{t.resorts.liftCount(r.lifts)}{t.common.separator}{t.resorts.pistesKm(r.km)}
	</p>
	{@const parts = breakdown(r)}
	{@const total = parts.reduce((sum, p) => sum + p.km, 0)}
	{#if parts.length}
		<div class="mt-1.5 flex items-center gap-2.5">
			<span
				class="flex h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-surface-2"
				aria-hidden="true"
			>
				{#each parts as p (p.key)}
					<span style:width="{(p.km / total) * 100}%" style:background={p.color}></span>
				{/each}
			</span>
			<span
				class="tabular flex items-center gap-x-2 text-[11px] whitespace-nowrap text-ink-soft"
				role="img"
				aria-label={t.resorts.pisteKmByColourAria(
					parts.map((p) => `${p.label} ${formatNumber(Math.round(p.km))}`).join(', ')
				)}
			>
				{#each parts as p (p.key)}
					<span class="inline-flex items-center gap-1">
						<span class="size-1.5 rounded-full" style:background={p.color}></span>{formatNumber(
							Math.round(p.km)
						)}
					</span>
				{/each}
				<span>{unitSymbol('kilometer')}</span>
			</span>
		</div>
	{/if}
{/snippet}

{#snippet countryBadge(country: string)}
	<span
		class="rounded border border-line bg-surface px-1.5 py-0.5 text-[10px] font-medium text-ink-soft"
	>
		{country}
	</span>
{/snippet}

{#snippet resortLink(r: CatalogResort)}
	<a
		href={resolve('/(app)/[resort]', { resort: r.id })}
		class="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface-2 p-3.5 transition hover:border-accent/40 active:scale-[0.99]"
	>
		<div class="min-w-0 flex-1">
			<div class="flex items-center gap-2">
				<span class="truncate text-[15px] font-semibold text-ink">{r.name}</span>
				{#if r.country}{@render countryBadge(r.country)}{/if}
			</div>
			{@render stats(r)}
		</div>
		<span class="text-accent"><Icon name="chevron" size={16} /></span>
	</a>
{/snippet}

<svelte:head>
	<title>{resortsTitle()}</title>
</svelte:head>

<div class="fixed inset-0 flex flex-col overflow-hidden bg-surface">
	<header
		class="flex shrink-0 flex-col gap-3 border-b border-line bg-surface px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-3"
	>
		<div class="flex items-center justify-between">
			<div>
				<h1 class="text-xl font-bold tracking-tight text-ink">openski.org</h1>
				<p class="text-xs text-ink-soft">{t.resorts.tagline}</p>
			</div>
			{#if lastResort}
				<a
					href={resolve('/(app)/[resort]', { resort: lastResort.id })}
					class="flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 text-xs font-medium text-ink"
				>
					<Icon name="map" size={13} />
					{t.resorts.backToMap}
				</a>
			{/if}
		</div>

		<div class="relative flex items-center">
			<span class="pointer-events-none absolute left-3.5 text-ink-soft">
				<Icon name="search" size={17} />
			</span>
			<input
				type="search"
				bind:value={query}
				placeholder={t.resorts.searchPlaceholder}
				class="h-11 w-full rounded-2xl border border-line bg-surface-2 pr-9 pl-10 text-sm text-ink placeholder:text-ink-soft focus:border-accent focus:bg-surface focus:outline-none"
				aria-label={t.resorts.searchAria}
			/>
			{#if query}
				<button
					type="button"
					class="absolute right-2.5 grid size-6 place-items-center rounded-full text-ink-soft hover:text-ink"
					onclick={() => (query = '')}
					aria-label={t.resorts.clearSearchAria}
				>
					<Icon name="x" size={15} />
				</button>
			{/if}
		</div>
	</header>

	<main
		class="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+2rem)]"
	>
		{#if loading}
			<div class="flex flex-col items-center justify-center py-16 text-center text-ink-soft">
				<span
					class="mb-3 size-6 animate-spin rounded-full border-2 border-accent border-t-transparent"
				></span>
				<p class="text-sm font-medium">{t.resorts.loading}</p>
			</div>
		{:else if failed}
			<div class="rounded-2xl bg-bad/15 p-4 text-center text-sm text-bad">
				{t.resorts.loadError}
			</div>
		{:else if query.trim()}
			<div class="flex flex-col gap-2">
				<p class="px-1 text-xs font-semibold tracking-wide text-ink-soft uppercase">
					{t.resorts.searchResultsHeading(
						`${formatNumber(searchResults.length)}${searchResults.length === MAX_SEARCH_RESULTS ? '+' : ''}`
					)}
				</p>
				{#if searchResults.length === 0}
					<p class="py-12 text-center text-sm text-ink-soft">
						{t.resorts.noMatches(query)}
					</p>
				{:else}
					<ul class="flex flex-col gap-2">
						{#each searchResults as r (r.id)}
							<li>
								{#if r.built}
									{@render resortLink(r)}
								{:else}
									<div
										class="flex cursor-not-allowed items-center justify-between gap-3 rounded-2xl border border-line/60 bg-surface-2/50 p-3.5 opacity-60"
									>
										<div class="min-w-0 flex-1">
											<div class="flex items-center gap-2">
												<span class="truncate text-[15px] font-medium text-ink">{r.name}</span>
												{#if r.country}{@render countryBadge(r.country)}{/if}
											</div>
											{@render stats(r)}
										</div>
										<span
											class="shrink-0 rounded-full border border-line bg-surface px-2.5 py-0.5 text-[11px] font-medium text-ink-soft"
										>
											{t.resorts.noMapYet}
										</span>
									</div>
								{/if}
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		{:else}
			<div class="flex flex-col gap-6">
				{#if lastResort}
					<section>
						<h2 class="mb-2 px-1 text-xs font-semibold tracking-wide text-ink-soft uppercase">
							{t.resorts.lastOpened}
						</h2>
						<a
							href={resolve('/(app)/[resort]', { resort: lastResort.id })}
							class="flex items-center justify-between gap-3 rounded-2xl border-2 border-accent bg-accent/8 p-4 transition active:scale-[0.99]"
						>
							<div class="min-w-0 flex-1">
								<div class="flex items-center gap-2">
									<span class="truncate text-base font-bold text-ink">{lastResort.name}</span>
									{#if lastResort.country}
										<span
											class="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent"
										>
											{lastResort.country}
										</span>
									{/if}
								</div>
								{@render stats(lastResort)}
							</div>
							<span
								class="flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink"
							>
								{t.resorts.openMap}
								<Icon name="chevron" size={14} />
							</span>
						</a>
					</section>
				{/if}

				<section>
					<h2 class="mb-2 px-1 text-xs font-semibold tracking-wide text-ink-soft uppercase">
						{t.resorts.allResortsHeading(formatNumber(builtResorts.length))}
					</h2>
					<ul class="flex flex-col gap-2">
						{#each builtResorts as r (r.id)}
							<li>{@render resortLink(r)}</li>
						{/each}
					</ul>
				</section>
			</div>
		{/if}
	</main>
</div>
