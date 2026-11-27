<script lang="ts">
	import { formatDistance, formatDuration, formatList, formatMeters, t } from '#lib/i18n/index.ts';
	import { trackRouteCalculated } from '#lib/analytics.ts';
	import { liftIcon } from '#lib/format.ts';
	import {
		placeKey,
		placeLabel,
		search,
		type Place,
		type SearchResult
	} from '#lib/resort/places.ts';
	import type { RouteStep } from '#lib/resort/routing.ts';
	import { getRouteFilterLevels } from '#lib/resort/difficulty.ts';
	import { app } from '#lib/state/app.svelte.ts';
	import { conditions } from '#lib/state/conditions.svelte.ts';
	import { location } from '#lib/state/location.svelte.ts';
	import { queues } from '#lib/state/queues.svelte.ts';
	import { route } from '#lib/state/route.svelte.ts';
	import { status } from '#lib/state/status.svelte.ts';
	import Icon from '#lib/ui/Icon.svelte';
	import PisteBadge from '#lib/ui/PisteBadge.svelte';
	import Sheet from '#lib/ui/Sheet.svelte';
	import StatusCredit from '#lib/ui/StatusCredit.svelte';

	const SEARCH_RESULT_LIMIT = 14;
	const MIN_SIGNIFICANT_DROP_METRES = 5;
	const MIN_SIGNIFICANT_WALK_METRES = 40;
	const MIN_UNCOUNTED_PISTE_METRES = 200;
	const LONG_FLAT_SECTION_METRES = 120;

	let editingEndpoint = $state<'from' | 'to' | null>(null);
	let query = $state('');

	const resort = $derived(app.resort);
	const results = $derived(
		resort && editingEndpoint ? search(resort, query, SEARCH_RESULT_LIMIT) : []
	);
	const result = $derived(route.result);

	$effect(() => {
		if (resort && route.prefs.preferGoodSnow) void conditions.load();
	});

	$effect(() => {
		if (route.from.kind === 'me' || route.to?.kind === 'me') location.start();
	});

	$effect(() => {
		const currentResort = resort;
		const calculated = result;
		const toPlace = route.to;
		if (!currentResort || !calculated || !toPlace) return;
		const routeKey = [
			currentResort.id,
			placeKey(route.from),
			placeKey(toPlace),
			route.prefs.maxDifficulty,
			route.prefs.avoidDragLifts,
			route.prefs.avoidFlats,
			route.prefs.preferGoodSnow,
			route.ignoreClosures
		].join(':');
		trackRouteCalculated({
			resort: currentResort.id,
			key: routeKey,
			fromKind: route.from.kind,
			toKind: toPlace.kind,
			maxDifficulty: route.prefs.maxDifficulty,
			durationS: calculated.time,
			lengthM: calculated.length,
			steps: calculated.steps.length
		});
	});

	function focusOnMount(element: HTMLInputElement) {
		element.focus();
	}

	function set(place: Place) {
		if (editingEndpoint === 'from') route.from = place;
		else route.to = place;
		editingEndpoint = null;
		query = '';
	}

	function pickOnMap() {
		app.picking = editingEndpoint;
		editingEndpoint = null;
		query = '';
	}

	const levels = $derived(
		getRouteFilterLevels(app.country).map((l) => ({
			...l,
			color: `var(--piste-${l.colorKey})`
		}))
	);

	const closedSummary = $derived.by(() => {
		const { lifts, pistes } = route.closed;
		const parts: string[] = [];
		if (lifts) parts.push(t.route.closedLifts(lifts));
		if (pistes) parts.push(t.route.closedPistes(pistes));
		return parts.length ? formatList(parts) : null;
	});

	function isSignificantRouteStep(
		step: RouteStep,
		pistes: NonNullable<typeof resort>['data']['pistes']
	): boolean {
		if (step.kind === 'lift') return true;
		if (step.kind === 'walk') return step.length > MIN_SIGNIFICANT_WALK_METRES;
		const piste = pistes[step.owner];
		return Boolean(piste?.counted || step.length > MIN_UNCOUNTED_PISTE_METRES);
	}

	function stepDetail(step: RouteStep): string {
		const parts = [formatDistance(step.length)];
		if (step.kind === 'lift') {
			parts.push(
				step.downhillRide
					? t.route.down(formatMeters(step.down))
					: t.route.up(formatMeters(step.up))
			);
			const queueEstimate =
				resort && queues.liftWait ? queues.byLift[resort.data.lifts[step.owner].id] : undefined;
			if (queueEstimate)
				parts.push(t.route.waitingAt(queueEstimate.people, queueEstimate.frame.time));
		} else if (step.down > MIN_SIGNIFICANT_DROP_METRES) {
			parts.push(t.route.down(formatMeters(step.down)));
		}
		return parts.join(t.common.separator);
	}
</script>

{#if resort}
	<Sheet tall={!!editingEndpoint} collapsible={!!result && !editingEndpoint}>
		{#if editingEndpoint}
			<div class="flex items-center gap-2">
				<label class="flex h-11 flex-1 items-center gap-2 rounded-2xl bg-surface-2 px-3">
					<span class="text-ink-soft"><Icon name="search" size={17} /></span>
					<input
						use:focusOnMount
						bind:value={query}
						type="search"
						autocomplete="off"
						placeholder={editingEndpoint === 'from' ? t.route.startFrom : t.route.whereTo}
						class="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-soft"
					/>
				</label>
				<button
					class="h-11 px-2 text-sm font-medium text-ink-soft"
					onclick={() => (editingEndpoint = null)}
				>
					{t.common.cancel}
				</button>
			</div>
			<ul class="mt-2">
				<li>
					<button class="row" onclick={() => set({ kind: 'me' })}>
						<span class="dot bg-accent text-accent-ink"><Icon name="locate" size={16} /></span>
						<span class="text-[15px] font-medium">{t.route.myLocation}</span>
					</button>
				</li>
				<li>
					<button class="row" onclick={pickOnMap}>
						<span class="dot bg-surface-2"><Icon name="pin" size={16} /></span>
						<span class="text-[15px] font-medium">{t.route.chooseOnMap}</span>
					</button>
				</li>
				{#each results as r (placeKey(r.place))}
					{@render resultRow(r)}
				{/each}
			</ul>
		{:else}
			<div class="flex items-stretch gap-2">
				<div class="min-w-0 flex-1 overflow-hidden rounded-2xl bg-surface-2">
					<button class="endpoint" onclick={() => (editingEndpoint = 'from')}>
						<span class="size-2.5 shrink-0 rounded-full border-2 border-ink-soft"></span>
						<span class="truncate">{placeLabel(resort, route.from)}</span>
					</button>
					<div class="ml-9 h-px bg-line"></div>
					<button class="endpoint" onclick={() => (editingEndpoint = 'to')}>
						<span class="size-2.5 shrink-0 rounded-full bg-accent"></span>
						<span class="truncate {route.to ? '' : 'text-ink-soft'}">
							{route.to ? placeLabel(resort, route.to) : t.route.whereTo}
						</span>
					</button>
				</div>
				<button
					class="grid w-11 shrink-0 place-items-center rounded-2xl bg-surface-2 text-ink-soft disabled:opacity-40"
					onclick={() => route.swap()}
					disabled={!route.to}
					aria-label={t.route.swap}
				>
					<Icon name="swap" size={18} />
				</button>
			</div>

			<div class="mt-3 flex flex-wrap gap-2">
				<div
					class="flex shrink-0 rounded-full bg-surface-2 p-0.5"
					role="radiogroup"
					aria-label={t.route.hardestPiste}
				>
					{#each levels as level (level.value)}
						{@const on = route.prefs.maxDifficulty === level.value}
						<button
							class="flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium {on
								? 'bg-surface shadow-sm'
								: 'text-ink-soft'}"
							role="radio"
							aria-checked={on}
							onclick={() => route.setPrefs({ maxDifficulty: level.value })}
						>
							<span class="size-2.5 rounded-full" style:background={level.color}></span>
							{level.label}
						</button>
					{/each}
				</div>
				<button
					class="chip {route.prefs.avoidDragLifts ? 'on' : ''}"
					aria-pressed={route.prefs.avoidDragLifts}
					onclick={() => route.setPrefs({ avoidDragLifts: !route.prefs.avoidDragLifts })}
				>
					{t.route.noDragLifts}
				</button>
				<button
					class="chip {route.prefs.avoidFlats ? 'on' : ''}"
					aria-pressed={route.prefs.avoidFlats}
					onclick={() => route.setPrefs({ avoidFlats: !route.prefs.avoidFlats })}
				>
					{t.route.avoidFlats}
				</button>
				<button
					class="chip {route.prefs.preferGoodSnow ? 'on' : ''}"
					aria-pressed={route.prefs.preferGoodSnow}
					onclick={() => {
						route.setPrefs({ preferGoodSnow: !route.prefs.preferGoodSnow });
						void conditions.load();
					}}
				>
					{t.route.bestConditions}
				</button>
			</div>

			{#if status.summary && closedSummary}
				<div
					class="mt-3 flex items-center gap-2 rounded-2xl bg-surface-2 py-1.5 pr-1.5 pl-3 text-[13px]"
				>
					<p class="min-w-0 flex-1 text-ink-soft">
						{route.ignoreClosures
							? t.route.ignoringClosures(
									closedSummary,
									status.summary.stale
										? t.route.reportStale(status.summary.at)
										: t.route.reportCurrent(status.summary.at)
								)
							: t.route.avoidingClosures(
									closedSummary,
									status.summary.stale
										? t.route.reportStale(status.summary.at)
										: t.route.reportCurrent(status.summary.at)
								)}
					</p>
					<button
						class="h-10 shrink-0 rounded-xl bg-surface px-3 font-medium text-ink"
						onclick={() => (route.ignoreClosures = !route.ignoreClosures)}
					>
						{route.ignoreClosures ? t.route.avoidThem : t.route.ignore}
					</button>
				</div>
			{/if}
			<StatusCredit class="mt-1.5" />

			{#if result}
				<div class="mt-4 flex items-baseline gap-3">
					<p class="tabular text-2xl font-semibold">{formatDuration(result.time)}</p>
					<p class="tabular text-sm text-ink-soft">
						{formatDistance(result.length)}{t.common.separator}{t.route.down(
							formatMeters(result.down)
						)}{t.common.separator}{t.route.up(formatMeters(result.up))}
					</p>
				</div>
				{#if result.usesClosed}
					<p class="mt-2 rounded-2xl bg-warn/15 px-3 py-2 text-[13px] text-warn">
						{t.route.previewNotice}
					</p>
				{/if}
				<ol class="mt-3">
					{#each result.steps as step, i (i)}
						{#if isSignificantRouteStep(step, resort.data.pistes)}
							<li class="flex items-center gap-3 border-t border-line py-2.5 first:border-t-0">
								{#if step.kind === 'piste'}
									<PisteBadge
										difficulty={step.difficulty ?? 'easy'}
										label={resort.data.pistes[step.owner].ref}
										size={34}
									/>
								{:else}
									<span
										class="grid size-[34px] shrink-0 place-items-center rounded-full {step.kind ===
										'lift'
											? 'bg-ink text-surface'
											: 'bg-surface-2 text-ink-soft'}"
									>
										<Icon
											name={step.kind === 'lift' ? liftIcon(step.liftType!) : 'walk'}
											size={19}
										/>
									</span>
								{/if}
								<div class="min-w-0 flex-1">
									<p class="truncate text-[15px] font-medium">
										{step.kind === 'walk' ? t.route.walkOrSkate : step.name}
										{#if step.downhillRide}<span class="font-normal text-ink-soft">
												{t.common.separator}{t.route.rideDown}
											</span>{/if}
										{#if step.closed}<span class="font-semibold text-bad">
												{t.common.separator}{t.route.closed}
											</span>{:else if step.unreported}<span class="font-normal text-warn">
												{t.common.separator}{t.route.unreported}
											</span>{/if}
									</p>
									<p class="tabular text-xs text-ink-soft">
										{stepDetail(step)}
										{#if step.kind === 'piste' && step.flat > LONG_FLAT_SECTION_METRES}
											<span class="text-warn">
												{t.common.separator}{t.route.flatWarning(formatDistance(step.flat))}
											</span>
										{/if}
									</p>
								</div>
								<p class="tabular shrink-0 text-sm text-ink-soft">{formatDuration(step.time)}</p>
							</li>
						{/if}
					{/each}
				</ol>
				<p class="mt-1 text-[11px] text-ink-soft">
					{t.route.paceNote}
					{#if !status.summary}{t.route.checkOpenNote}{/if}
				</p>
			{:else if route.problem}
				<p class="mt-4 rounded-2xl bg-surface-2 px-3 py-3 text-sm text-ink-soft">{route.problem}</p>
			{:else}
				<p class="mt-4 text-sm text-ink-soft">
					{t.route.noDestination}
				</p>
			{/if}
		{/if}
	</Sheet>
{/if}

{#snippet resultRow(r: SearchResult)}
	<li>
		<button class="row" onclick={() => set(r.place)}>
			{#if r.kind === 'piste' && resort}
				{@const p = resort.data.pistes[r.index]}
				<PisteBadge difficulty={p.difficulty} label={p.ref} size={30} />
			{:else}
				<span class="dot bg-surface-2">
					<Icon
						name={r.kind === 'lift' && resort ? liftIcon(resort.data.lifts[r.index].type) : 'pin'}
						size={16}
					/>
				</span>
			{/if}
			<span class="min-w-0 flex-1">
				<span class="block truncate text-[15px] font-medium">{r.label}</span>
				<span class="block text-xs text-ink-soft">{r.detail}</span>
			</span>
		</button>
	</li>
{/snippet}

<style>
	.row {
		display: flex;
		width: 100%;
		align-items: center;
		gap: 0.75rem;
		padding: 0.55rem 0.25rem;
		text-align: left;
	}
	.dot {
		display: grid;
		place-items: center;
		width: 30px;
		height: 30px;
		flex-shrink: 0;
		border-radius: 9999px;
	}
	.endpoint {
		display: flex;
		width: 100%;
		height: 2.75rem;
		align-items: center;
		gap: 0.75rem;
		padding: 0 0.9rem;
		text-align: left;
		font-size: 15px;
		font-weight: 500;
	}
	.chip {
		height: 2.25rem;
		flex-shrink: 0;
		border-radius: 9999px;
		background: var(--surface-2);
		padding: 0 0.85rem;
		font-size: 13px;
		font-weight: 500;
		color: var(--ink-soft);
	}
	.chip.on {
		background: color-mix(in srgb, var(--accent) 16%, transparent);
		color: var(--accent);
	}
</style>
