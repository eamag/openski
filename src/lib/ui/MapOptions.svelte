<script lang="ts">
	import { SLOPE_CLASSES } from '#lib/map/slope.ts';
	import { t } from '#lib/i18n/index.ts';
	import { getLegendItems, getDifficultySectionTitle } from '#lib/resort/difficulty.ts';
	import { app } from '#lib/state/app.svelte.ts';
	import { progress } from '#lib/state/progress.svelte.ts';
	import { status } from '#lib/state/status.svelte.ts';
	import { theme as appearance } from '#lib/state/theme.svelte.ts';

	const legendItems = $derived(getLegendItems(app.country, appearance.dark));
	const legendTitle = $derived(getDifficultySectionTitle(app.country));

	const closedHint = $derived.by(() => {
		const summary = status.summary;
		if (summary) {
			const counts = t.map.statusCounts(
				summary.lifts.open,
				summary.lifts.known,
				summary.pistes.open,
				summary.pistes.known
			);
			return summary.stale
				? t.map.staleReport(counts, summary.at)
				: t.map.reportedAt(counts, summary.at);
		}
		if (status.missing) return t.map.reportMissing;
		if (status.data && !status.data.source) return t.map.reportNoSource;
		return t.map.closedDefaultHint;
	});

	const doneHint = $derived(
		progress.summary
			? t.map.doneCounts(
					progress.summary.pistesDone,
					progress.summary.pistesTotal,
					progress.summary.liftsDone,
					progress.summary.liftsTotal
				)
			: t.map.doneDefaultHint
	);
</script>

{#snippet option(name: 'dimClosed' | 'dimDone' | 'slopes', title: string, text: string)}
	<label class="flex cursor-pointer items-center gap-3 py-1.5">
		<span class="min-w-0 flex-1">
			<span class="block text-[15px] font-medium">{title}</span>
			<span class="tabular block text-xs leading-snug text-ink-soft">{text}</span>
		</span>
		<input
			type="checkbox"
			role="switch"
			class="peer sr-only"
			checked={app[name]}
			onchange={(e) => app.setOption(name, e.currentTarget.checked)}
		/>
		<span
			class="relative h-7 w-12 shrink-0 rounded-full bg-line transition-colors peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent/50 after:absolute after:top-0.5 after:left-0.5 after:size-6 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5"
		></span>
	</label>
{/snippet}

{@render option('dimClosed', t.map.dimClosed, closedHint)}
{@render option('dimDone', t.map.dimDone, doneHint)}
{@render option('slopes', t.map.slopes, t.map.slopesHint)}
{#if app.slopes}
	<ul class="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-soft">
		{#each SLOPE_CLASSES as c (c.from)}
			<li class="flex items-center gap-1">
				<span class="size-3 rounded-sm" style:background="rgb({c.color.join(' ')})"></span>{t.map
					.slopeClass[c.from]}
			</li>
		{/each}
	</ul>
{/if}

<div class="mt-3 border-t border-line pt-2.5">
	<span class="block text-[13px] font-semibold tracking-wide text-ink-soft uppercase">
		{legendTitle}
	</span>
	<ul class="mt-2 flex flex-wrap gap-x-3.5 gap-y-1.5 text-xs text-ink-soft">
		{#each legendItems as item (item.key)}
			<li class="flex items-center gap-1.5">
				<span class="size-2.5 rounded-full" style:background={item.color}></span>
				<span class="text-ink">{item.label}</span>
			</li>
		{/each}
	</ul>
</div>
