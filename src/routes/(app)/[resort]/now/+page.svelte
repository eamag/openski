<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { scoreColor, scoreWord, type PisteConditions } from '#lib/conditions/model.ts';
	import { describeCode } from '#lib/conditions/weather.ts';
	import { liftIcon, liftTypeLabel } from '#lib/format.ts';
	import {
		formatMeters,
		formatPercent,
		formatTemperature,
		formatUnit,
		formatWeekday,
		t
	} from '#lib/i18n/index.ts';
	import { queueLevel, type QueueLevel } from '#lib/queues/wait.ts';
	import { DIFFICULTY_RANK } from '#lib/resort/types.ts';
	import { getNowFilterLevels } from '#lib/resort/difficulty.ts';
	import { app } from '#lib/state/app.svelte.ts';
	import { conditions, DAY_END, DAY_START } from '#lib/state/conditions.svelte.ts';
	import type { SnapshotInput } from '#lib/snapshot.ts';
	import { OPEN_FROM, OPEN_UNTIL, queues } from '#lib/state/queues.svelte.ts';
	import { route } from '#lib/state/route.svelte.ts';
	import { status } from '#lib/state/status.svelte.ts';
	import HourStrip from '#lib/ui/HourStrip.svelte';
	import Icon from '#lib/ui/Icon.svelte';
	import PisteBadge from '#lib/ui/PisteBadge.svelte';
	import QueueProof from '#lib/ui/QueueProof.svelte';
	import Sheet from '#lib/ui/Sheet.svelte';
	import StatusCredit from '#lib/ui/StatusCredit.svelte';

	const QUEUE_REFRESH_INTERVAL_MS = 10 * 60_000;
	const MIN_LIFT_LENGTH_FOR_QUEUE_MONITORING = 150;
	const QUEUE_BADGE: Record<QueueLevel, string> = {
		none: 'bg-good/15 text-good',
		short: 'bg-warn/15 text-warn',
		queue: 'bg-bad/15 text-bad',
		long: 'bg-bad/15 text-bad'
	};

	type Level = 'all' | 'easy' | 'intermediate' | 'advanced';
	const isLiftsTabRequested =
		page.url.searchParams.get('tab') === 'lifts' || page.url.searchParams.has('queues');
	let tab = $state<'pistes' | 'lifts'>(isLiftsTabRequested ? 'lifts' : 'pistes');
	let level = $state<Level>('all');
	const filterLevels = $derived(getNowFilterLevels(app.country));
	const activeFilterLabel = $derived(filterLevels.find((f) => f.id === level)?.label ?? level);

	const resort = $derived(app.resort);
	const forecast = $derived(conditions.forecast);
	const hour = $derived(conditions.hour);

	$effect(() => {
		if (resort) {
			void conditions.load();
			void queues.init();
		}
	});

	const days = $derived.by(() => {
		if (!forecast || !resort) return [];
		const firstHourOfEachDay = forecast.hours.filter(
			(h, i) => i === 0 || forecast.hours[i - 1].day !== h.day
		);
		return firstHourOfEachDay.map((h) => ({
			day: h.day,
			label:
				h.day === 0
					? t.common.today
					: h.day === 1
						? t.common.tomorrow
						: formatWeekday(h.t, 'short', resort.data.timezone)
		}));
	});

	const cells = $derived(
		forecast && hour
			? forecast.hours.flatMap((h, index) =>
					h.day === hour.day ? [{ index, hour: h.hour, score: h.score }] : []
				)
			: []
	);

	function pickDay(day: number) {
		if (!forecast || !hour) return;
		let closest = -1;
		forecast.hours.forEach((h, i) => {
			if (h.day !== day) return;
			const distance = Math.abs(h.hour - hour.hour);
			if (closest < 0 || distance < Math.abs(forecast.hours[closest].hour - hour.hour)) closest = i;
		});
		if (closest >= 0) conditions.select(closest);
	}

	const compass = (deg: number) => t.now.compass[Math.round(deg / 45) % 8];

	const inLevel = (rank: number) =>
		level === 'all' ||
		(level === 'easy' ? rank <= 1 : level === 'intermediate' ? rank === 2 : rank >= 3);

	const rows = $derived(
		(resort?.data.pistes ?? [])
			.map((piste, index) => ({ piste, index, c: conditions.pistes[index] }))
			.filter(
				(x): x is typeof x & { c: PisteConditions } =>
					!!x.c &&
					x.piste.counted &&
					inLevel(DIFFICULTY_RANK[x.piste.difficulty]) &&
					status.pistes[x.index] !== false
			)
			.sort(
				(a, b) =>
					b.c.score - a.c.score ||
					a.piste.ref.localeCompare(b.piste.ref, undefined, { numeric: true })
			)
	);

	const closedHidden = $derived(
		(resort?.data.pistes ?? []).filter(
			(p, i) => p.counted && inLevel(DIFFICULTY_RANK[p.difficulty]) && status.pistes[i] === false
		).length
	);

	const facts = (c: PisteConditions) =>
		[
			t.conditions.surface[c.surface],
			t.conditions.light[c.lightKind],
			c.windKmh >= 20 ? t.now.windSpeed(formatUnit(c.windKmh, 'kilometer-per-hour')) : null
		]
			.filter(Boolean)
			.join(t.common.separator);

	const picked = $derived.by(() => {
		const sel = app.selection;
		if (!resort || !hour || sel?.kind !== 'piste') return null;
		const c = conditions.pistes[sel.index];
		if (!c) return null;
		const day = conditions.pisteDay(sel.index, hour.day);
		const max = Math.max(...day.map((d) => d.score ?? 0));
		const good = day.filter((d) => (d.score ?? 0) >= max - 4);
		return {
			index: sel.index,
			piste: resort.data.pistes[sel.index],
			c,
			day,
			best: good.length
				? {
						from: good[0].hour,
						to: good[good.length - 1].hour + 1,
						all: good.length === day.length
					}
				: null
		};
	});

	function routeTo(index: number) {
		route.to = { kind: 'piste', index };
		app.selection = null;
		void goto(resolve('/(app)/[resort]/route', { resort: page.params.resort ?? app.lastResort }));
	}

	const camerasFor = (liftId: string) =>
		queues.cameras.flatMap((camera) =>
			camera.regions.filter((r) => r.liftId === liftId).map((region) => ({ camera, region }))
		);
	const watched = $derived(
		(resort?.data.lifts ?? [])
			.map((lift, index) => ({ lift, index, views: camerasFor(lift.id) }))
			.filter((x) => x.views.length)
	);
	const places = $derived(
		queues.cameras.flatMap((camera) =>
			camera.regions.filter((r) => !r.liftId).map((region) => ({ camera, region }))
		)
	);
	const unwatched = $derived(
		(resort?.data.lifts ?? []).filter(
			(l) => l.length > MIN_LIFT_LENGTH_FOR_QUEUE_MONITORING && !queues.covered.has(l.id)
		).length
	);
	const replay = $derived.by(() => {
		const m = page.url.searchParams.get('queues')?.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/);
		return m ? { date: m[1], time: m[2] } : undefined;
	});
	const frameTimes = $derived.by(() => {
		const times = Object.values(queues.readings)
			.map((r) => r.frame.time)
			.sort();
		if (!times.length) return null;
		return times[0] === times[times.length - 1]
			? times[0]
			: `${times[0]}–${times[times.length - 1]}`;
	});
	let expandedRegionId = $state<string | null>(null);

	$effect(() => {
		if (tab !== 'lifts' || queues.phase !== 'idle' || !queues.cameras.length) return;
		if (!queues.enabled && !replay) return;
		const isStale = !queues.attempted || Date.now() - queues.attempted > QUEUE_REFRESH_INTERVAL_MS;
		if (isStale) void queues.check(replay);
	});

	let ask = $state<{
		state: 'idle' | 'busy' | 'done' | 'error';
		prompt?: string;
		url?: string;
		copied?: boolean;
		message?: string;
	}>({ state: 'idle' });

	function snapshotInput(): SnapshotInput | null {
		if (!resort || !forecast || !hour) return null;
		const tz = resort.data.timezone;
		const parts = Object.fromEntries(
			new Intl.DateTimeFormat('en-CA', {
				timeZone: tz,
				year: 'numeric',
				month: '2-digit',
				day: '2-digit',
				hour: '2-digit',
				minute: '2-digit',
				hourCycle: 'h23'
			})
				.formatToParts(new Date())
				.map((p) => [p.type, p.value])
		);
		const day = forecast.hours.flatMap((h, k) =>
			h.day === hour.day && h.hour >= DAY_START && h.hour <= DAY_END ? [{ h, k }] : []
		);
		if (!day.length) return null;
		const now = Math.max(
			0,
			day.findIndex(({ k }) => k === conditions.index)
		);
		const busiest: Record<string, { people: number; wait: number; frame: string }> = {};
		for (const r of Object.values(queues.readings)) {
			if (!r.liftId) continue;
			const seen = busiest[r.liftId];
			if (!seen || r.people > seen.people)
				busiest[r.liftId] = { people: r.people, wait: r.wait, frame: r.frame.time };
		}
		return {
			resort: resort.id,
			date: `${parts.year}-${parts.month}-${parts.day}`,
			time: `${parts.hour}:${parts.minute}`,
			level,
			now,
			hours: day.map(({ h }) => ({
				hour: h.hour,
				score: h.score,
				low: h.low,
				high: h.high,
				windDir: h.windDir,
				cloud: h.cloud,
				snowfall: h.snowfall,
				code: h.code
			})),
			pistes: resort.data.pistes.flatMap((p, i) => {
				const c = conditions.pistes[i];
				if (!p.counted || !c) return [];
				const scores = new Map(conditions.pisteDay(i, hour.day).map((d) => [d.index, d.score]));
				return [
					{
						i,
						open: status.pistes[i] ?? null,
						score: c.score,
						surface: c.surface,
						light: c.lightKind,
						windKmh: c.windKmh,
						temp: c.temp,
						day: day.map(({ k }) => scores.get(k) ?? null)
					}
				];
			}),
			lifts: resort.data.lifts.map((l, i) => {
				const q = busiest[l.id];
				return {
					i,
					open: status.lifts[i] ?? null,
					...(q ? { people: q.people, waitS: q.wait, frame: q.frame } : {})
				};
			})
		};
	}

	async function askAi() {
		const input = snapshotInput();
		if (!input || !resort) return;
		ask = { state: 'busy' };
		try {
			const res = await fetch('/api/snapshot', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(input)
			});
			const body = (await res.json().catch(() => null)) as {
				url?: string;
				message?: string;
			} | null;
			if (!res.ok || !body?.url) throw new Error(body?.message ?? `error ${res.status}`);
			const prompt = t.now.aiPrompt(
				resort.data.name,
				body.url,
				level === 'all' ? '' : t.now.aiFilterPreference(activeFilterLabel)
			);
			const copied = await navigator.clipboard.writeText(prompt).then(
				() => true,
				() => false
			);
			ask = { state: 'done', prompt, url: body.url, copied };
		} catch (err) {
			ask = {
				state: 'error',
				message: err instanceof TypeError ? t.now.noConnection : (err as Error).message
			};
		}
	}

	const minutes = (seconds: number) =>
		seconds < 45 ? t.now.underOneMinute : t.now.aboutMinutes(Math.max(1, Math.round(seconds / 60)));
	const people = (n: number) => t.now.peopleCount(n);
	function windDescription(kmh: number): string {
		if (kmh < 12) return t.now.windWord.calm;
		if (kmh < 28) return t.now.windWord.breezy;
		if (kmh < 50) return t.now.windWord.windy;
		return t.now.windWord.stormy;
	}
</script>

{#if resort}
	<Sheet tall collapsible>
		<div class="flex items-center gap-2">
			<div class="no-scrollbar flex min-w-0 flex-1 gap-1 overflow-x-auto min-[380px]:gap-1.5">
				{#if tab === 'lifts'}
					<h1 class="flex h-8 items-center text-[17px] font-semibold">{t.now.liftQueues}</h1>
				{/if}
				{#each tab === 'pistes' ? days : [] as d (d.day)}
					<button
						class="h-8 shrink-0 rounded-full px-2.5 text-[13px] font-medium min-[380px]:px-3 {hour?.day ===
						d.day
							? 'bg-ink text-surface'
							: 'bg-surface-2 text-ink-soft'}"
						aria-pressed={hour?.day === d.day}
						onclick={() => pickDay(d.day)}
					>
						{d.label}
					</button>
				{/each}
			</div>
			<div class="flex shrink-0 rounded-full bg-surface-2 p-0.5">
				{#each ['pistes', 'lifts'] as const as currentTab (currentTab)}
					<button
						class="h-8 rounded-full px-2.5 text-[13px] font-medium capitalize min-[380px]:px-3.5 {tab ===
						currentTab
							? 'bg-surface shadow-sm'
							: 'text-ink-soft'}"
						aria-pressed={tab === currentTab}
						onclick={() => (tab = currentTab)}
					>
						{t.now.tabs[currentTab]}
					</button>
				{/each}
			</div>
		</div>

		{#if tab !== 'lifts' && forecast && hour}
			<div class="mt-3">
				<HourStrip {cells} selected={conditions.index} onselect={(i) => conditions.select(i)} />
			</div>
			<p class="tabular mt-2.5 text-[13px] leading-snug text-ink-soft">
				<b class="font-semibold text-ink">
					{hour.hour}:00{t.common.separator}{describeCode(hour.code)}
				</b>{t.common.separator}{t.now.weatherSummary(
					formatTemperature(hour.high.temp),
					formatMeters(hour.high.ele),
					formatTemperature(hour.low.temp)
				)}{t.common.separator}{t.now.windUpTop(
					formatUnit(hour.high.wind, 'kilometer-per-hour'),
					compass(hour.windDir)
				)}
				{#if hour.snowfall >= 0.1}{t.common.separator}{t.now.snowing}{/if}
			</p>
			<button
				class="mt-2.5 flex h-10 w-full items-center justify-center gap-2 rounded-2xl bg-surface-2 text-sm font-medium disabled:opacity-60"
				onclick={askAi}
				disabled={ask.state === 'busy'}
			>
				<Icon name="sparkle" size={16} />
				{ask.state === 'busy' ? t.now.makingSnapshot : t.now.askAi}
			</button>
			{#if ask.state === 'done' && ask.prompt}
				<div class="mt-2 rounded-2xl border border-line p-3 text-xs leading-snug">
					<p class="font-medium text-ink">
						{ask.copied ? t.now.copiedPrompt : t.now.openPrompt}
						{t.now.aiPromptHint}
					</p>
					<div class="mt-2 grid grid-cols-2 gap-2">
						<a
							class="flex h-10 items-center justify-center rounded-xl bg-accent font-semibold text-accent-ink"
							href={`https://chatgpt.com/?q=${encodeURIComponent(ask.prompt)}`}
							target="_blank"
							rel="external noopener noreferrer"
						>
							ChatGPT
						</a>
						<a
							class="flex h-10 items-center justify-center rounded-xl bg-accent font-semibold text-accent-ink"
							href={`https://claude.ai/new?q=${encodeURIComponent(ask.prompt)}`}
							target="_blank"
							rel="external noopener noreferrer"
						>
							Claude
						</a>
					</div>
					<a
						class="mt-2 block truncate text-ink-soft underline"
						href={ask.url}
						target="_blank"
						rel="external noreferrer"
					>
						{ask.url}
					</a>
				</div>
			{:else if ask.state === 'error'}
				<p class="mt-2 text-xs text-bad" role="alert">
					{t.now.snapshotError(ask.message ?? '')}
				</p>
			{/if}
		{:else if conditions.error}
			<p class="mt-3 rounded-2xl bg-surface-2 px-3 py-3 text-sm text-ink-soft" role="alert">
				{conditions.error}
				<button class="ml-1 font-medium text-accent" onclick={() => conditions.load(true)}>
					{t.common.retry}
				</button>
			</p>
		{:else}
			<div class="mt-3 h-12 animate-pulse rounded-2xl bg-surface-2"></div>
			<p class="mt-2.5 text-[13px] text-ink-soft">
				{t.now.calculatingConditions}
			</p>
		{/if}

		{#if tab === 'pistes'}
			{#if picked}
				{@const { piste, c } = picked}
				<div class="mt-3 rounded-3xl border border-line p-3">
					<div class="flex items-center gap-3">
						<PisteBadge difficulty={piste.difficulty} label={piste.ref} size={38} />
						<div class="min-w-0 flex-1">
							<h2 class="truncate text-[15px] leading-tight font-semibold">
								{piste.title ?? resort.pisteName(piste)}
							</h2>
							<p class="tabular text-xs text-ink-soft">
								{formatTemperature(c.temp)}{t.common.separator}{t.now.windSpeed(
									formatUnit(c.windKmh, 'kilometer-per-hour')
								)}
								{#if picked.best}
									{t.common.separator}{picked.best.all
										? t.now.bestAllDay
										: t.now.bestTimeRange(picked.best.from, picked.best.to)}
								{/if}
							</p>
						</div>
						<span
							class="tabular grid h-9 min-w-9 place-items-center rounded-full px-2 text-sm font-bold text-white"
							style:background={scoreColor(c.score)}
						>
							{c.score}
						</span>
						<button
							class="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-soft"
							onclick={() => (app.selection = null)}
							aria-label={t.common.close}
						>
							<Icon name="x" size={16} />
						</button>
					</div>
					<div class="mt-3">
						<HourStrip
							cells={picked.day}
							selected={conditions.index}
							compact
							onselect={(i) => conditions.select(i)}
						/>
					</div>
					<dl class="mt-3 grid grid-cols-3 gap-2">
						{#each [[t.now.factors.snow, t.conditions.surface[c.surface], c.snow, 'snow'], [t.now.factors.light, t.conditions.light[c.lightKind], c.light, 'eye'], [t.now.factors.wind, windDescription(c.windKmh), c.wind, 'wind']] as const as [factorName, word, value, icon] (factorName)}
							<div class="rounded-2xl bg-surface-2 px-2.5 py-2">
								<dt class="flex items-center gap-1 text-[11px] text-ink-soft">
									<Icon name={icon} size={12} />{factorName}
								</dt>
								<dd class="mt-0.5 truncate text-[13px] font-semibold">{word}</dd>
								<div class="mt-1.5 h-1 overflow-hidden rounded-full bg-line">
									<div
										class="h-full rounded-full"
										style:width="{value}%"
										style:background={scoreColor(value)}
									></div>
								</div>
							</div>
						{/each}
					</dl>
					<button
						class="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-2xl bg-accent text-sm font-semibold text-accent-ink"
						onclick={() => routeTo(picked.index)}
					>
						<Icon name="route" size={16} />
						{t.now.routeHere}
					</button>
				</div>
			{/if}

			{#if forecast && hour}
				<div class="mt-3 flex items-center gap-0.5">
					{#each filterLevels as opt (opt.id)}
						<button
							class="flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-medium {level ===
							opt.id
								? 'bg-surface-2 text-ink'
								: 'text-ink-soft'}"
							aria-pressed={level === opt.id}
							onclick={() => (level = opt.id)}
						>
							{#if opt.colorKey}
								<span class="size-2.5 rounded-full" style:background="var(--piste-{opt.colorKey})"
								></span>
							{/if}
							{opt.label}
						</button>
					{/each}
					<span class="ml-auto flex shrink-0 items-center gap-1.5 text-[11px] text-ink-soft">
						{t.conditions.score.poor}
						<span
							class="h-1.5 w-9 rounded-full"
							style:background="linear-gradient(90deg, {[10, 45, 65, 85, 100]
								.map(scoreColor)
								.join(', ')})"
						></span>
						{t.conditions.score.great}
					</span>
				</div>
				<ul class="mt-1">
					{#each rows as { piste, index, c } (piste.id)}
						{@const on = app.selection?.kind === 'piste' && app.selection.index === index}
						<li class="border-t border-line first:border-t-0">
							<button
								class="flex w-full items-center gap-3 py-2 text-left"
								aria-pressed={on}
								onclick={() => (app.selection = on ? null : { kind: 'piste', index })}
							>
								<PisteBadge difficulty={piste.difficulty} label={piste.ref} size={32} />
								<span class="min-w-0 flex-1">
									<span class="block truncate text-[15px] font-medium">
										{piste.title ?? resort.pisteName(piste)}
									</span>
									<span class="block truncate text-xs text-ink-soft">{facts(c)}</span>
								</span>
								<span
									class="tabular grid h-7 min-w-9 shrink-0 place-items-center rounded-full px-2 text-[13px] font-bold text-white"
									style:background={scoreColor(c.score)}
									aria-label={t.now.scoreAria(scoreWord(c.score), c.score)}
								>
									{c.score}
								</span>
							</button>
						</li>
					{:else}
						<li class="py-4 text-sm text-ink-soft">
							{closedHidden ? t.now.allClosedToday : t.now.noPistesOfColour}
						</li>
					{/each}
				</ul>
				{#if closedHidden}
					<p class="mt-2 text-xs text-ink-soft">
						{t.now.pistesReportedClosed(closedHidden)}
					</p>
				{/if}
				<p class="mt-2 text-[11px] leading-relaxed text-ink-soft">
					{t.now.disclaimer}
				</p>
				<p class="mt-1 text-[11px] text-ink-soft">
					{t.now.weatherDataBy}
					<a
						href="https://open-meteo.com/"
						target="_blank"
						rel="external noreferrer"
						class="underline"
					>
						Open-Meteo.com
					</a>.
				</p>
			{/if}
		{:else if !queues.cameras.length}
			<p class="pt-8 text-center text-sm text-ink-soft">
				{t.now.noWebcams}
			</p>
			<a
				href={resolve(`/contribute/webcam?resort=${resort?.data.id ?? ''}`)}
				class="mx-auto mt-3 mb-6 flex h-11 w-fit items-center gap-2 rounded-2xl bg-accent px-5 text-sm font-semibold text-accent-ink"
			>
				<Icon name="camera" size={17} />
				{t.now.addWebcam}
			</a>
		{:else}
			<div class="mt-3 rounded-3xl bg-surface-2 p-3">
				{#if queues.phase === 'model'}
					<p class="text-sm font-medium">
						{t.now.gettingCounter(formatPercent(queues.progress))}
					</p>
					<div class="mt-2 h-1 overflow-hidden rounded-full bg-line">
						<div
							class="h-full rounded-full bg-accent transition-[width]"
							style:width="{queues.progress * 100}%"
						></div>
					</div>
				{:else if queues.phase !== 'idle'}
					<p class="tabular flex items-center gap-2 text-sm font-medium">
						<span class="size-2 animate-pulse rounded-full bg-accent"></span>
						{queues.phase === 'looking'
							? t.now.lookingForPictures
							: t.now.countingPeople(queues.counted, queues.total)}
					</p>
				{:else}
					{@const shut = queues.closed || (!replay && queues.afterHours())}
					<div class="flex items-center gap-3">
						<p class="min-w-0 flex-1 text-[13px] leading-snug text-ink-soft">
							{#if shut}
								<b class="font-semibold text-ink">{t.now.liftsShutTitle}</b>
								{t.now.liftsShutDesc(OPEN_FROM, OPEN_UNTIL)}
							{:else if queues.checked && frameTimes}
								<b class="tabular font-semibold text-ink">{t.now.picturesFromTitle(frameTimes)}</b>
								{t.now.picturesFromDesc}
							{:else}
								<b class="font-semibold text-ink">
									{t.now.countPeopleTitle(queues.cameras.length)}
								</b>
								{t.now.countPeopleDesc}
							{/if}
						</p>
						{#if !shut}
							<button
								class="flex h-10 shrink-0 items-center gap-1.5 rounded-2xl bg-accent px-3.5 text-sm font-semibold text-accent-ink"
								onclick={() => queues.check(replay)}
							>
								<Icon name="users" size={16} />
								{queues.checked ? t.now.checkAgain : t.now.check}
							</button>
						{/if}
					</div>
				{/if}
				{#if queues.error}
					<p class="mt-2 text-xs text-bad" role="alert">{queues.error}</p>
				{/if}
			</div>

			<ul class="mt-1">
				{#each watched as { lift, index, views } (lift.id)}
					{@const r = queues.byLift[lift.id]}
					{@const view = views.find((v) => v.region.id === r?.regionId) ?? views[0]}
					{@const isProofExpanded = !!r && expandedRegionId === r.regionId}
					{@const shut = status.lifts[index] === false}
					<li class="border-t border-line first:border-t-0">
						<button
							class="flex w-full items-center gap-3 py-2.5 text-left"
							aria-expanded={r ? isProofExpanded : undefined}
							onclick={() => {
								app.selection = { kind: 'lift', index };
								if (r) expandedRegionId = isProofExpanded ? null : r.regionId;
							}}
						>
							<span
								class="grid size-8 shrink-0 place-items-center rounded-full bg-ink text-surface"
							>
								<Icon name={liftIcon(lift.type)} size={18} />
							</span>
							<span class="min-w-0 flex-1">
								<span class="block truncate text-[15px] font-medium">{lift.name}</span>
								<span class="tabular block truncate text-xs text-ink-soft">
									{#if r}
										{shut
											? t.now.inView(people(r.people), r.frame.time)
											: t.now.waitingSummary(people(r.people), minutes(r.wait), r.frame.time)}
									{:else if queues.failed.includes(view.camera.camera)}
										{t.now.noPictureFromCamera(view.camera.name)}
									{:else}
										{shut ? t.now.closedToday : liftTypeLabel(lift)}{t.common
											.separator}{t.now.cameraAt(view.camera.name)}
									{/if}
								</span>
							</span>
							{#if r}
								<span
									class="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold {shut
										? 'bg-surface-2 text-ink-soft'
										: QUEUE_BADGE[queueLevel(r.people)]}"
								>
									{shut ? t.now.closedToday : t.queues.level[queueLevel(r.people)]}
								</span>
								<span
									class="shrink-0 text-ink-soft transition-transform {isProofExpanded
										? 'rotate-90'
										: ''}"
								>
									<Icon name="chevron" size={16} />
								</span>
							{/if}
						</button>
						{#if r && isProofExpanded}
							<QueueProof reading={r} camera={view.camera} crop={queues.crops[r.regionId]} />
						{/if}
					</li>
				{:else}
					<li class="py-4 text-sm text-ink-soft">
						{t.now.noWebcamLooksAtQueue}
					</li>
				{/each}
			</ul>

			{#if places.length}
				<h2 class="mt-4 text-[13px] font-semibold">{t.now.aroundMountain}</h2>
				<p class="text-xs text-ink-soft">{t.now.aroundMountainHint}</p>
				<ul class="mt-1">
					{#each places as { camera, region } (region.id)}
						{@const r = queues.readings[region.id]}
						{@const isProofExpanded = !!r && expandedRegionId === region.id}
						<li class="border-t border-line first:border-t-0">
							<button
								class="flex w-full items-center gap-3 py-2.5 text-left"
								aria-expanded={r ? isProofExpanded : undefined}
								disabled={!r}
								onclick={() => (expandedRegionId = isProofExpanded ? null : region.id)}
							>
								<span
									class="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-soft"
								>
									<Icon name="camera" size={17} />
								</span>
								<span class="min-w-0 flex-1">
									<span class="block truncate text-[15px] font-medium">{region.label}</span>
									<span class="tabular block truncate text-xs text-ink-soft">
										{#if r}
											{camera.name}{camera.source.kind === 'still' && camera.source.rotates
												? t.now.turningCamera
												: ''}{t.common.separator}{r.frame.time}
										{:else if queues.failed.includes(camera.camera)}
											{t.now.noPictureFromGenericCamera}
										{:else}
											{camera.name}
										{/if}
									</span>
								</span>
								{#if r}
									<span
										class="tabular shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold"
									>
										{people(r.people)}
									</span>
									<span
										class="shrink-0 text-ink-soft transition-transform {isProofExpanded
											? 'rotate-90'
											: ''}"
									>
										<Icon name="chevron" size={16} />
									</span>
								{/if}
							</button>
							{#if r && isProofExpanded}
								<QueueProof reading={r} {camera} crop={queues.crops[region.id]} />
							{/if}
						</li>
					{/each}
				</ul>
			{/if}

			{#if watched.length}
				<p class="mt-2 text-[11px] leading-relaxed text-ink-soft">
					{t.now.unwatchedSummary(unwatched)}
					{t.now.queueDisclaimer}
				</p>
			{/if}
			<StatusCredit class="mt-2" />
			<a
				href={resolve(`/contribute/webcam?resort=${resort?.data.id ?? ''}`)}
				class="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-line text-sm font-medium"
			>
				<Icon name="camera" size={17} />
				{t.now.addWebcamOrArea}
			</a>
		{/if}
	</Sheet>
{/if}
