<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { liftIcon, liftTypeLabel } from '#lib/format.ts';
	import {
		formatDistance,
		formatKm,
		formatMeters,
		formatNumber,
		formatPercent,
		formatUnit,
		t
	} from '#lib/i18n/index.ts';
	import { aspectRose, COLOURS, resortStats } from '#lib/resort/stats.ts';
	import { getDifficultyLabel, getDifficultySectionTitle } from '#lib/resort/difficulty.ts';
	import { skimapOriginal, skimapPage, type SkimapMap } from '#lib/skimap.ts';
	import { app } from '#lib/state/app.svelte.ts';
	import { catalogResort } from '#lib/state/catalog.ts';
	import { conditions } from '#lib/state/conditions.svelte.ts';
	import AspectRose from '#lib/ui/AspectRose.svelte';
	import Icon from '#lib/ui/Icon.svelte';
	import PisteBadge from '#lib/ui/PisteBadge.svelte';
	import Sheet from '#lib/ui/Sheet.svelte';
	import type { CatalogResort } from '#lib/resort/catalog.ts';

	const resort = $derived(app.resort);
	const stats = $derived(resort ? resortStats(resort) : null);
	const rose = $derived(
		resort && conditions.terrain?.version === resort.data.version
			? aspectRose(resort, conditions.terrain)
			: null
	);
	const maxColour = $derived(Math.max(1, ...(stats ? COLOURS.map((c) => stats.byColour[c]) : [])));

	let entry = $state<CatalogResort | null>(null);
	let maps = $state<SkimapMap[] | null>(null);
	let mapsError = $state(false);
	let shown = $state(0);

	$effect(() => {
		const id = page.params.resort ?? '';
		entry = null;
		maps = null;
		mapsError = false;
		shown = 0;
		void catalogResort(id).then(async (found) => {
			if (page.params.resort !== id) return;
			entry = found ?? null;
			if (!found?.skimap) {
				maps = [];
				return;
			}
			try {
				const res = await fetch(`/api/skimap/${found.skimap}`);
				if (!res.ok) throw new Error(String(res.status));
				const list = (await res.json()) as SkimapMap[];
				if (page.params.resort === id) maps = list;
			} catch {
				if (page.params.resort === id) mapsError = true;
			}
		});
	});

	$effect(() => {
		if (resort && !conditions.terrain) void conditions.load();
	});

	function show(index: number) {
		app.selection = { kind: 'piste', index };
		void goto(resolve('/(app)/[resort]', { resort: page.params.resort ?? '' }));
	}

	const host = (url: string) => new URL(url).host.replace(/^www\./, '');
	const MAX_THUMBNAIL_MAPS = 12;
	const current = $derived(maps?.[shown]);
	const thumbnails = $derived(maps?.slice(0, MAX_THUMBNAIL_MAPS) ?? []);
</script>

{#if resort && stats}
	<Sheet tall>
		<h1 class="text-lg leading-tight font-semibold">{resort.data.name}</h1>
		<p class="tabular text-sm text-ink-soft">
			{t.about.summary(
				t.about.pisteDistance(formatUnit(Math.round(stats.pisteKm), 'kilometer')),
				t.about.liftCount(stats.lifts),
				t.about.elevationRange(
					formatMeters(stats.low),
					formatMeters(stats.high),
					formatMeters(stats.high - stats.low)
				)
			)}
		</p>
		{#if entry?.web}
			<a
				href={entry.web}
				target="_blank"
				rel="external noopener noreferrer"
				class="mt-1 inline-flex items-center gap-1 text-sm font-medium text-accent"
			>
				{host(entry.web)}
				<Icon name="external" size={13} />
			</a>
		{/if}

		<h2 class="mt-4 text-[13px] font-semibold tracking-wide text-ink-soft uppercase">
			{getDifficultySectionTitle(entry?.country ?? app.country)}
		</h2>
		<ul class="mt-1.5 space-y-1.5">
			{#each COLOURS.filter((difficulty) => stats.byColour[difficulty] > 0) as difficulty (difficulty)}
				<li class="flex items-center gap-2.5 text-sm">
					<PisteBadge {difficulty} size={18} />
					<span class="w-20 shrink-0">
						{getDifficultyLabel(difficulty, entry?.country ?? app.country)}
					</span>
					<span class="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-2">
						<span
							class="block h-full rounded-full"
							style:width="{(stats.byColour[difficulty] / maxColour) * 100}%"
							style:background={difficulty === 'unknown' ? '#9ca3af' : `var(--piste-${difficulty})`}
						></span>
					</span>
					<span class="tabular w-14 shrink-0 text-right">
						{formatKm(stats.byColour[difficulty], 1)}
					</span>
				</li>
			{/each}
		</ul>

		<h2 class="mt-4 text-[13px] font-semibold tracking-wide text-ink-soft uppercase">
			{t.about.lifts}
		</h2>
		<ul class="mt-1">
			{#each stats.byLift as l (l.type)}
				<li class="flex items-center gap-2.5 border-t border-line py-1.5 text-sm first:border-t-0">
					<span class="text-ink-soft"><Icon name={liftIcon(l.type)} size={18} /></span>
					<span class="flex-1">{liftTypeLabel({ type: l.type, occupancy: undefined })}</span>
					<span class="tabular text-ink-soft">
						{formatNumber(l.count)}{t.common.separator}{formatDistance(l.length)}
					</span>
				</li>
			{/each}
		</ul>

		{#if stats.longest.length}
			<h2 class="mt-4 text-[13px] font-semibold tracking-wide text-ink-soft uppercase">
				{t.about.longestAndSteepest}
			</h2>
			<ul class="mt-1">
				{#each [...stats.longest.map( (r) => ({ r, what: formatDistance(r.length) }) ), ...stats.steepest.map( (r) => ({ r, what: formatPercent(r.pct / 100) }) )] as { r, what }, k (k)}
					{@const p = resort.data.pistes[r.index]}
					<li class="border-t border-line first:border-t-0">
						<button
							class="flex w-full items-center gap-3 py-2 text-left"
							onclick={() => show(r.index)}
						>
							<PisteBadge difficulty={p.difficulty} label={p.ref} size={28} />
							<span class="min-w-0 flex-1 truncate text-[15px] font-medium">
								{p.title ?? resort.pisteName(p)}
							</span>
							<span class="tabular text-sm text-ink-soft">
								{k >= stats.longest.length ? t.about.steepestAt(what) : what}
							</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}

		{#if rose}
			<h2 class="mt-4 mb-2 text-[13px] font-semibold tracking-wide text-ink-soft uppercase">
				{t.about.aspectTitle}
			</h2>
			<AspectRose {rose} />
		{/if}

		<h2 class="mt-5 text-[13px] font-semibold tracking-wide text-ink-soft uppercase">
			{t.about.pisteMaps}
		</h2>
		{#if maps === null && !mapsError}
			<p class="mt-2 text-sm text-ink-soft">{t.about.mapsLoading}</p>
		{:else if mapsError}
			<p class="mt-2 text-sm text-ink-soft">{t.about.mapsLoadError}</p>
		{:else if !current}
			<p class="mt-2 text-sm text-ink-soft">
				{entry?.skimap ? t.about.noMaps : t.about.noMapsSkimap}
			</p>
		{:else}
			<a
				href={current.image}
				target="_blank"
				rel="external noopener noreferrer"
				class="mt-2 block overflow-hidden rounded-2xl border border-line bg-surface-2"
				style:aspect-ratio="{current.width} / {current.height}"
			>
				<img
					src={current.thumb}
					alt={t.about.pisteMapAlt(current.year, current.title)}
					width={current.width}
					height={current.height}
					class="size-full object-contain"
				/>
			</a>
			<p class="mt-1.5 flex flex-wrap items-baseline gap-x-2 text-xs text-ink-soft">
				<b class="tabular font-semibold text-ink">{current.year}</b>
				{#if current.title}<span class="min-w-0 truncate">{current.title}</span>{/if}
				<a
					href={skimapOriginal(current.id)}
					target="_blank"
					rel="external noopener noreferrer"
					class="ml-auto font-medium text-accent"
				>
					{t.about.originalFile}
				</a>
			</p>
			{#if thumbnails.length > 1}
				<ul class="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4">
					{#each thumbnails as pisteMap, mapIndex (pisteMap.id)}
						<li class="shrink-0">
							<button
								class="block w-24 overflow-hidden rounded-xl border-2 {mapIndex === shown
									? 'border-accent'
									: 'border-transparent'}"
								onclick={() => (shown = mapIndex)}
								aria-label={t.about.mapFromYear(pisteMap.year)}
								aria-pressed={mapIndex === shown}
							>
								<img
									src={pisteMap.thumb}
									alt=""
									loading="lazy"
									class="h-16 w-full bg-surface-2 object-cover object-top"
								/>
								<span class="tabular block py-0.5 text-center text-[11px] font-medium">
									{pisteMap.year}
								</span>
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		{/if}
		{#if entry?.skimap}
			<p class="mt-3 text-[11px] leading-relaxed text-ink-soft">
				{t.about.attribution.mapsFrom}
				<a
					href={skimapPage(entry.skimap)}
					target="_blank"
					rel="external noopener noreferrer"
					class="underline"
				>
					skimap.org
				</a>{t.about.attribution.archiveDescription}
			</p>
		{/if}
	</Sheet>
{/if}
