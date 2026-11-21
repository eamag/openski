<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import {
		formatDistance,
		formatDuration,
		formatMeters,
		formatPercent,
		formatUnit,
		t
	} from '#lib/i18n/index.ts';
	import { liftIcon, liftTypeLabel } from '#lib/format.ts';
	import { getDifficultyLongLabel } from '#lib/resort/difficulty.ts';
	import { poiTypeLabel, type Place } from '#lib/resort/places.ts';
	import type { Resort } from '#lib/resort/model.ts';
	import type { Selection } from '#lib/state/app.svelte.ts';
	import { app } from '#lib/state/app.svelte.ts';
	import { conditions } from '#lib/state/conditions.svelte.ts';
	import { scoreColor } from '#lib/conditions/model.ts';
	import HourStrip from './HourStrip.svelte';
	import ElevationProfile from './ElevationProfile.svelte';
	import { degrees, pisteProfile } from '#lib/resort/profile.ts';
	import { EDGE_LIT, EDGE_TUNNEL, EDGE_UNGROOMED } from '#lib/resort/types.ts';
	import { PISTE_DONE, progress } from '#lib/state/progress.svelte.ts';
	import { route } from '#lib/state/route.svelte.ts';
	import { status } from '#lib/state/status.svelte.ts';
	import Icon from './Icon.svelte';
	import StatusCredit from './StatusCredit.svelte';
	import PisteBadge from './PisteBadge.svelte';

	const MOST_OF_THE_PISTE = 0.5;

	let { resort, selection }: { resort: Resort; selection: Selection } = $props();

	const piste = $derived(selection.kind === 'piste' ? resort.data.pistes[selection.index] : null);
	const lift = $derived(selection.kind === 'lift' ? resort.data.lifts[selection.index] : null);
	const poi = $derived(selection.kind === 'poi' ? resort.data.pois[selection.index] : null);
	const pisteState = $derived(selection.kind === 'piste' ? progress.pistes[selection.index] : null);
	const liftDone = $derived(selection.kind === 'lift' ? progress.lifts[selection.index] : false);
	const reportedOpen = $derived(
		selection.kind === 'piste'
			? status.pistes[selection.index]
			: selection.kind === 'lift'
				? status.lifts[selection.index]
				: null
	);
	const canEdit = $derived(
		selection.kind === 'lift' || (selection.kind === 'piste' && !!piste?.ways?.length)
	);

	const profile = $derived(
		selection.kind === 'piste' ? pisteProfile(resort, selection.index) : null
	);
	const pisteFeatures = $derived.by(() => {
		if (selection.kind !== 'piste') return [];
		const edges = resort.pisteEdges[selection.index].map((i) => resort.data.edges[i]);
		const total = edges.reduce((s, e) => s + e.len, 0) || 1;
		const share = (flag: number) =>
			edges.reduce((s, e) => s + ((e.f ?? 0) & flag ? e.len : 0), 0) / total;
		const out: string[] = [];
		if (share(EDGE_LIT) >= MOST_OF_THE_PISTE) out.push(t.place.features.lit);
		if (share(EDGE_UNGROOMED) >= MOST_OF_THE_PISTE) out.push(t.place.features.ungroomed);
		if (share(EDGE_TUNNEL) > 0) out.push(t.place.features.tunnel);
		return out;
	});
	const slope = (pct: number) =>
		t.place.slope(formatPercent(pct / 100), formatUnit(Math.round(degrees(pct)), 'degree'));

	const outlook = $derived.by(() => {
		const hour = conditions.hour;
		if (selection.kind !== 'piste' || !hour) return null;
		const c = conditions.pistes[selection.index];
		if (!c) return null;
		const when =
			hour.day === 0
				? t.place.outlook.today
				: hour.day === 1
					? t.place.outlook.tomorrow
					: t.place.outlook.inDays(hour.day);
		return { c, when, hour: hour.hour, day: conditions.pisteDay(selection.index, hour.day) };
	});

	function selectedPlace(end: 'from' | 'to'): Place {
		const s = selection;
		if (s.kind !== 'lift') return { kind: s.kind, index: s.index };
		const lastStation = resort.data.lifts[s.index].stations.length - 1;
		return { kind: 'station', lift: s.index, station: end === 'from' ? lastStation : 0 };
	}

	function routeWith(end: 'from' | 'to') {
		route[end] = selectedPlace(end);
		app.selection = null;
		void goto(resolve('/(app)/[resort]/route', { resort: page.params.resort ?? resort.id }));
	}
</script>

<div class="flex items-start gap-3">
	{#if piste}
		<PisteBadge difficulty={piste.difficulty} label={piste.ref} size={44} />
		<div class="min-w-0 flex-1">
			<h2 class="truncate text-lg leading-tight font-semibold">
				{piste.title ?? resort.pisteName(piste)}
			</h2>
			<p class="text-sm text-ink-soft">
				{#if reportedOpen !== null}<span
						class="font-medium {reportedOpen ? 'text-good' : 'text-bad'}"
					>
						{reportedOpen ? t.common.open : t.place.closedToday}
					</span>{t.common.separator}{/if}{getDifficultyLongLabel(piste.difficulty, app.country)} · {formatDistance(
					piste.length
				)} · {t.place.drop(formatMeters(piste.top - piste.bottom))}
			</p>
			{#if reportedOpen !== null}<StatusCredit />{/if}
		</div>
	{:else if lift}
		<span class="grid size-11 shrink-0 place-items-center rounded-full bg-ink text-surface">
			<Icon name={liftIcon(lift.type)} size={24} />
		</span>
		<div class="min-w-0 flex-1">
			<h2 class="truncate text-lg leading-tight font-semibold">{lift.name}</h2>
			<p class="text-sm text-ink-soft">
				{#if reportedOpen !== null}<span
						class="font-medium {reportedOpen ? 'text-good' : 'text-bad'}"
					>
						{reportedOpen ? t.common.open : t.place.closedToday}
					</span>{t.common.separator}{/if}{liftTypeLabel(lift)} · {formatDuration(lift.duration)} · {t.place.up(
					formatMeters(lift.top - lift.bottom)
				)}
			</p>
			{#if reportedOpen !== null}<StatusCredit />{/if}
		</div>
	{:else if poi}
		<span class="grid size-11 shrink-0 place-items-center rounded-full bg-surface-2 text-ink">
			<Icon name="pin" size={24} />
		</span>
		<div class="min-w-0 flex-1">
			<h2 class="truncate text-lg leading-tight font-semibold">{poi.name}</h2>
			<p class="text-sm text-ink-soft">
				{poiTypeLabel(poi.type)} · {formatMeters(poi.ele)}
			</p>
		</div>
	{/if}
	<button
		class="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-soft"
		onclick={() => (app.selection = null)}
		aria-label={t.common.close}
	>
		<Icon name="x" size={18} />
	</button>
</div>

{#if piste}
	<dl class="mt-3 grid grid-cols-3 gap-2 text-center">
		<div class="rounded-2xl bg-surface-2 py-2">
			<dt class="text-[11px] text-ink-soft">{t.place.average}</dt>
			<dd class="tabular font-semibold">
				{slope(profile?.avgPct ?? ((piste.top - piste.bottom) / piste.length) * 100)}
			</dd>
		</div>
		<div class="rounded-2xl bg-surface-2 py-2">
			<dt class="text-[11px] text-ink-soft">{t.place.steepest}</dt>
			<dd class="tabular font-semibold">{profile ? slope(profile.steepest.pct) : '–'}</dd>
		</div>
		<div class="rounded-2xl bg-surface-2 py-2">
			<dt class="text-[11px] text-ink-soft">{t.place.flatPush}</dt>
			<dd class="tabular font-semibold">{profile ? formatDistance(profile.flat) : '–'}</dd>
		</div>
	</dl>
	{#if pisteFeatures.length}
		<p class="mt-2 flex flex-wrap gap-1.5">
			{#each pisteFeatures as tag (tag)}<span
					class="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium"
				>
					{tag}
				</span>{/each}
		</p>
	{/if}
	{#if outlook}
		<button
			class="mt-2 block w-full rounded-2xl bg-surface-2 px-3 py-2.5 text-left"
			onclick={() =>
				goto(resolve('/(app)/[resort]/now', { resort: page.params.resort ?? resort.id }))}
		>
			<span class="flex items-center gap-2">
				<span class="size-2.5 shrink-0 rounded-full" style:background={scoreColor(outlook.c.score)}
				></span>
				<span class="min-w-0 flex-1 truncate text-[13px]">
					<b class="font-semibold">
						{t.conditions.surface[outlook.c.surface]} · {t.conditions.light[outlook.c.lightKind]}
					</b>
					<span class="text-ink-soft">
						{t.place.outlook.atTime(`${outlook.hour}:00`, outlook.when)}
					</span>
				</span>
				<span class="text-ink-soft"><Icon name="chevron" size={15} /></span>
			</span>
			<span class="mt-2 block">
				<HourStrip cells={outlook.day} selected={conditions.index} compact />
			</span>
		</button>
	{/if}
{:else if lift}
	<dl class="mt-3 grid grid-cols-3 gap-2 text-center">
		<div class="rounded-2xl bg-surface-2 py-2">
			<dt class="text-[11px] text-ink-soft">
				{formatMeters(lift.bottom)}–{formatMeters(lift.top)}
			</dt>
			<dd class="tabular font-semibold">{t.place.up(formatMeters(lift.top - lift.bottom))}</dd>
		</div>
		<div class="rounded-2xl bg-surface-2 py-2">
			<dt class="text-[11px] text-ink-soft">{t.place.length}</dt>
			<dd class="tabular font-semibold">
				{formatDistance(Math.hypot(lift.length, lift.top - lift.bottom))}
			</dd>
		</div>
		<div class="rounded-2xl bg-surface-2 py-2">
			<dt class="text-[11px] text-ink-soft">{t.place.averageSlope}</dt>
			<dd class="tabular font-semibold">
				{lift.length ? slope(((lift.top - lift.bottom) / lift.length) * 100) : '–'}
			</dd>
		</div>
	</dl>
	{#if lift.capacity || lift.bubble || lift.heated}
		<p class="mt-2 flex flex-wrap gap-1.5">
			{#if lift.capacity}<span
					class="tabular rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium"
				>
					{t.place.capacity(lift.capacity)}
				</span>{/if}
			{#if lift.bubble}<span class="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium">
					{t.place.bubble}
				</span>{/if}
			{#if lift.heated}<span class="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium">
					{t.place.heatedSeats}
				</span>{/if}
		</p>
	{/if}
{/if}

<div class="mt-3 flex flex-wrap gap-2">
	<button
		class="flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl bg-accent px-4 font-semibold text-accent-ink"
		onclick={() => routeWith('to')}
	>
		<Icon name="route" size={18} />
		{t.place.routeHere}
	</button>
	<button class="h-12 rounded-2xl bg-surface-2 px-4 font-medium" onclick={() => routeWith('from')}>
		{t.place.fromHere}
	</button>
	{#if piste && pisteState}
		{@const tracked = pisteState.share >= PISTE_DONE}
		<button
			class="flex h-12 items-center gap-1.5 rounded-2xl px-4 font-medium {pisteState.done
				? 'bg-good/15 text-good'
				: 'bg-surface-2'}"
			onclick={() => progress.togglePiste(piste.id)}
			disabled={tracked && !pisteState.manual}
			aria-pressed={pisteState.done}
		>
			<Icon name="check" size={18} />
			{pisteState.done ? t.place.ridden : t.place.markRidden}
		</button>
	{:else if lift}
		<button
			class="flex h-12 items-center gap-1.5 rounded-2xl px-4 font-medium {liftDone
				? 'bg-good/15 text-good'
				: 'bg-surface-2'}"
			onclick={() => progress.toggleLift(lift.id)}
			aria-pressed={liftDone}
		>
			<Icon name="check" size={18} />
			{liftDone ? t.place.ridden : t.place.markRidden}
		</button>
	{/if}
</div>

{#if piste && profile}
	{#key selection.index}<ElevationProfile {profile} />{/key}
{/if}

{#if canEdit}
	<button
		class="mt-2 flex h-10 w-full items-center justify-center gap-1.5 rounded-2xl text-sm font-medium text-ink-soft"
		onclick={() =>
			goto(
				resolve(`/(app)/[resort]/edit?kind=${selection.kind}&index=${selection.index}`, {
					resort: page.params.resort ?? resort.id
				})
			)}
	>
		<Icon name="info" size={16} />
		{t.place.editOsm}
	</button>
{/if}
{#if piste && pisteState && pisteState.share > 0 && pisteState.share < PISTE_DONE}
	<p class="mt-2 text-xs text-ink-soft">
		{t.place.trackedProgress(formatPercent(pisteState.share))}
	</p>
{/if}
