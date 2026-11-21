<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { liftIcon, liftTypeLabel } from '#lib/format.ts';
	import { formatDistance, formatNumber, formatPercent, t, unitSymbol } from '#lib/i18n/index.ts';
	import { getProgressBadges } from '#lib/resort/difficulty.ts';
	import { DIFFICULTY_RANK } from '#lib/resort/types.ts';
	import { app } from '#lib/state/app.svelte.ts';
	import { progress } from '#lib/state/progress.svelte.ts';
	import { settings } from '#lib/state/settings.svelte.ts';
	import Account from '#lib/ui/Account.svelte';
	import Icon from '#lib/ui/Icon.svelte';
	import PisteBadge from '#lib/ui/PisteBadge.svelte';
	import Sheet from '#lib/ui/Sheet.svelte';

	let filter = $state<'all' | 'todo' | 'done'>('all');
	let tab = $state<'pistes' | 'lifts'>('pistes');

	const resort = $derived(app.resort);
	const summary = $derived(progress.summary);

	const refOrder = (ref: string) =>
		ref
			? parseInt(ref, 10) * 100 +
				(ref.charCodeAt(ref.length - 1) > 57 ? ref.charCodeAt(ref.length - 1) - 96 : 0)
			: 1e6;

	const pistes = $derived(
		(resort?.data.pistes ?? [])
			.map((piste, index) => ({ piste, index, state: progress.pistes[index] }))
			.filter((x) => x.piste.counted && x.state)
			.filter((x) => filter === 'all' || (filter === 'done') === x.state.done)
			.sort(
				(a, b) =>
					refOrder(a.piste.ref) - refOrder(b.piste.ref) || a.piste.id.localeCompare(b.piste.id)
			)
	);
	const lifts = $derived(
		(resort?.data.lifts ?? [])
			.map((lift, index) => ({ lift, index, done: progress.lifts[index] ?? false }))
			.filter((x) => x.lift.length > 150)
			.filter((x) => filter === 'all' || (filter === 'done') === x.done)
			.sort((a, b) => b.lift.length - a.lift.length)
	);

	const badges = $derived.by(() => {
		if (!resort) return [];
		const all = resort.data.pistes
			.map((p, i) => ({ p, s: progress.pistes[i] }))
			.filter((x) => x.p.counted && x.s);
		const rank = (min: number, max: number) =>
			all.filter(
				(x) => DIFFICULTY_RANK[x.p.difficulty] >= min && DIFFICULTY_RANK[x.p.difficulty] <= max
			);
		const share = (list: typeof all) =>
			list.length ? list.filter((x) => x.s.done).length / list.length : null;
		const top3 = resort.data.lifts
			.map((l, i) => ({ l, i }))
			.sort((a, b) => b.l.top - a.l.top)
			.slice(0, 3);
		const pBadges = getProgressBadges(app.country);
		const candidates: { name: string; hint: string; value: number | null }[] = [
			{
				name: t.progress.badges.firstTracks,
				hint: t.progress.badges.firstTracksHint,
				value: all.some((x) => x.s.done) ? 1 : 0
			},
			{ name: pBadges.low.name, hint: pBadges.low.hint, value: share(rank(0, 1)) },
			{ name: pBadges.mid.name, hint: pBadges.mid.hint, value: share(rank(2, 2)) },
			{ name: pBadges.high.name, hint: pBadges.high.hint, value: share(rank(3, 4)) },
			{
				name: top3.length === 3 ? t.progress.badges.threeSummits : t.progress.badges.topOfTheResort,
				hint: top3.map((x) => x.l.name.replace(/ (I+|bahn)$/, '')).join(', '),
				value: top3.length ? top3.filter((x) => progress.lifts[x.i]).length / top3.length : null
			},
			{
				name: t.progress.badges.liftCollector,
				hint: t.progress.badges.liftCollectorHint,
				value: summary?.liftsTotal ? summary.liftsDone / summary.liftsTotal : null
			}
		];
		return candidates.flatMap((badge) =>
			badge.value === null ? [] : [{ ...badge, value: badge.value }]
		);
	});

	function show(index: number, kind: 'piste' | 'lift') {
		app.selection = { kind, index };
		void goto(resolve('/(app)/[resort]', { resort: page.params.resort ?? app.lastResort }));
	}

	const PROGRESS_RING_RADIUS = 30;
	const PROGRESS_RING_CIRCUMFERENCE = 2 * Math.PI * PROGRESS_RING_RADIUS;
</script>

{#if resort && summary}
	<Sheet tall>
		<div class="flex items-start gap-4">
			<svg
				viewBox="0 0 72 72"
				class="size-[72px] shrink-0 -rotate-90"
				role="img"
				aria-label={t.progress.shareRidden(formatPercent(summary.share))}
			>
				<circle
					cx="36"
					cy="36"
					r={PROGRESS_RING_RADIUS}
					fill="none"
					stroke="var(--surface-2)"
					stroke-width="7"
				/>
				<circle
					cx="36"
					cy="36"
					r={PROGRESS_RING_RADIUS}
					fill="none"
					stroke="var(--accent)"
					stroke-width="7"
					stroke-linecap="round"
					stroke-dasharray={PROGRESS_RING_CIRCUMFERENCE}
					stroke-dashoffset={PROGRESS_RING_CIRCUMFERENCE * (1 - summary.share)}
					class="transition-[stroke-dashoffset] duration-500"
				/>
				<text
					x="36"
					y="36"
					class="tabular rotate-90 fill-ink text-[17px] font-semibold"
					style="transform-origin: 36px 36px"
					text-anchor="middle"
					dominant-baseline="central"
				>
					{formatPercent(summary.share)}
				</text>
			</svg>
			<div class="min-w-0">
				<h1 class="text-lg leading-tight font-semibold">{resort.data.name}</h1>
				<p class="tabular text-sm text-ink-soft">
					{t.progress.kmRidden(formatNumber(summary.km, 1), formatNumber(summary.totalKm, 0))}
				</p>
				<p class="tabular text-sm text-ink-soft">
					<b class="font-semibold text-ink">{formatNumber(summary.pistesDone)}</b>/{formatNumber(
						summary.pistesTotal
					)}
					{t.progress.pistes}
					{t.common.separator}
					<b class="font-semibold text-ink">{formatNumber(summary.liftsDone)}</b>/{formatNumber(
						summary.liftsTotal
					)}
					{t.progress.lifts}
				</p>
			</div>
			<button
				class="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-soft"
				onclick={() => settings.show()}
				aria-label={t.settings.title}
			>
				<Icon name="settings" size={18} />
			</button>
		</div>

		<ul class="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4">
			{#each badges as badge (badge.name)}
				<li
					class="w-[7.5rem] shrink-0 rounded-2xl p-2.5 {badge.value >= 1
						? 'bg-accent text-accent-ink'
						: 'bg-surface-2'}"
				>
					<p class="flex items-center gap-1 text-[13px] leading-tight font-semibold">
						{#if badge.value >= 1}<Icon name="check" size={14} stroke={2.6} />{/if}{badge.name}
					</p>
					<p
						class="mt-0.5 line-clamp-2 min-h-8 text-[11px] leading-tight {badge.value >= 1
							? 'opacity-80'
							: 'text-ink-soft'}"
					>
						{badge.hint}
					</p>
					<div
						class="mt-1.5 h-1 overflow-hidden rounded-full {badge.value >= 1
							? 'bg-accent-ink/30'
							: 'bg-line'}"
					>
						<div
							class="h-full rounded-full {badge.value >= 1 ? 'bg-accent-ink' : 'bg-accent'}"
							style:width="{Math.round(badge.value * 100)}%"
						></div>
					</div>
				</li>
			{/each}
		</ul>

		<Account />

		<div class="mt-4 flex items-center gap-2">
			<div class="flex rounded-full bg-surface-2 p-0.5">
				{#each ['pistes', 'lifts'] as const as tabOption (tabOption)}
					<button
						class="h-8 rounded-full px-3.5 text-[13px] font-medium {tab === tabOption
							? 'bg-surface shadow-sm'
							: 'text-ink-soft'}"
						onclick={() => (tab = tabOption)}
					>
						{t.progress.tabs[tabOption]}
					</button>
				{/each}
			</div>
			<div class="ml-auto flex rounded-full bg-surface-2 p-0.5">
				{#each ['all', 'todo', 'done'] as const as value (value)}
					<button
						class="h-8 rounded-full px-3 text-[13px] font-medium {filter === value
							? 'bg-surface shadow-sm'
							: 'text-ink-soft'}"
						onclick={() => (filter = value)}
					>
						{t.progress.filters[value]}
					</button>
				{/each}
			</div>
		</div>

		<ul class="mt-1">
			{#if tab === 'pistes'}
				{#each pistes as { piste, index, state } (piste.id)}
					<li class="flex items-center gap-3 border-t border-line py-2 first:border-t-0">
						<button
							class="flex min-w-0 flex-1 items-center gap-3 text-left"
							onclick={() => show(index, 'piste')}
						>
							<PisteBadge difficulty={piste.difficulty} label={piste.ref} size={32} />
							<span class="min-w-0 flex-1">
								<span class="block truncate text-[15px] font-medium">
									{piste.title ?? resort.pisteName(piste)}
								</span>
								<span class="mt-1 flex items-center gap-2">
									<span class="h-1 flex-1 overflow-hidden rounded-full bg-surface-2">
										<span
											class="block h-full rounded-full {state.done ? 'bg-good' : 'bg-accent'}"
											style:width="{state.manual ? 100 : Math.round(state.share * 100)}%"
										></span>
									</span>
									<span class="tabular w-12 text-right text-[11px] text-ink-soft">
										{formatDistance(piste.length)}
									</span>
								</span>
							</span>
						</button>
						<button
							class="grid size-9 shrink-0 place-items-center rounded-full {state.done
								? 'bg-good text-white'
								: 'bg-surface-2 text-ink-soft'}"
							onclick={() => progress.togglePiste(piste.id)}
							disabled={state.done && !state.manual}
							aria-pressed={state.done}
							aria-label={t.progress.action.label(
								state.done ? t.progress.action.ridden : t.progress.action.markAsRidden,
								resort.pisteName(piste)
							)}
						>
							<Icon name="check" size={17} stroke={2.4} />
						</button>
					</li>
				{:else}
					<li class="py-4 text-sm text-ink-soft">
						{filter === 'done'
							? t.progress.emptyPistes.done
							: filter === 'todo'
								? t.progress.emptyPistes.todo
								: t.progress.emptyPistes.all}
					</li>
				{/each}
			{:else}
				{#each lifts as { lift, index, done } (lift.id)}
					<li class="flex items-center gap-3 border-t border-line py-2 first:border-t-0">
						<button
							class="flex min-w-0 flex-1 items-center gap-3 text-left"
							onclick={() => show(index, 'lift')}
						>
							<span
								class="grid size-8 shrink-0 place-items-center rounded-full bg-ink text-surface"
							>
								<Icon name={liftIcon(lift.type)} size={18} />
							</span>
							<span class="min-w-0 flex-1">
								<span class="block truncate text-[15px] font-medium">{lift.name}</span>
								<span class="tabular block text-xs text-ink-soft">
									{liftTypeLabel(lift)}
									{t.common.separator}
									{formatNumber(lift.bottom)}–{formatNumber(lift.top)}
									{unitSymbol('meter')}
								</span>
							</span>
						</button>
						<button
							class="grid size-9 shrink-0 place-items-center rounded-full {done
								? 'bg-good text-white'
								: 'bg-surface-2 text-ink-soft'}"
							onclick={() => progress.toggleLift(lift.id)}
							aria-pressed={done}
							aria-label={t.progress.action.label(
								done ? t.progress.action.ridden : t.progress.action.markAsRidden,
								lift.name
							)}
						>
							<Icon name="check" size={17} stroke={2.4} />
						</button>
					</li>
				{:else}
					<li class="py-4 text-sm text-ink-soft">
						{filter === 'done'
							? t.progress.emptyLifts.done
							: filter === 'todo'
								? t.progress.emptyLifts.todo
								: t.progress.emptyLifts.all}
					</li>
				{/each}
			{/if}
		</ul>
	</Sheet>
{/if}
