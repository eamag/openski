<script lang="ts">
	import { onDestroy } from 'svelte';
	import { formatDistance, formatMeters, formatPercent, formatUnit, t } from '#lib/i18n/index.ts';
	import { degrees, pointAt, steepnessBand, stretchAt, type Profile } from '#lib/resort/profile.ts';
	import { getElevationBands } from '#lib/resort/difficulty.ts';
	import { app } from '#lib/state/app.svelte.ts';

	let { profile }: { profile: Profile } = $props();

	const H = 112;
	const PAD_TOP = 8;
	let width = $state(0);
	let at = $state<number | null>(null);

	const BAND = $derived(getElevationBands(app.country));

	const lo = $derived(Math.min(...profile.points.map((p) => p.ele)));
	const hi = $derived(Math.max(...profile.points.map((p) => p.ele)));
	const x = (d: number) => (d / profile.length) * width;
	const y = (ele: number) => PAD_TOP + (1 - (ele - lo) / Math.max(1, hi - lo)) * (H - PAD_TOP);

	const areas = $derived(
		width
			? profile.stretches.map((s) => {
					const pts = profile.points.filter((p) => p.d >= s.from && p.d <= s.to);
					const line = pts.map((p) => `${x(p.d).toFixed(1)},${y(p.ele).toFixed(1)}`).join(' ');
					return {
						key: s.from,
						band: steepnessBand(s.pct),
						points: `${x(s.from).toFixed(1)},${H} ${line} ${x(s.to).toFixed(1)},${H}`
					};
				})
			: []
	);
	const outline = $derived(
		width ? profile.points.map((p) => `${x(p.d).toFixed(1)},${y(p.ele).toFixed(1)}`).join(' ') : ''
	);
	const bands = $derived(
		(Object.keys(BAND) as (keyof typeof BAND)[]).filter((b) =>
			profile.stretches.some((s) => steepnessBand(s.pct) === b)
		)
	);
	const hover = $derived.by(() => {
		if (at === null || !width) return null;
		const p = pointAt(profile, at);
		const s = stretchAt(profile, at);
		return { left: x(at), top: y(p.ele), ele: p.ele, pct: s.pct, d: at };
	});

	function track(e: PointerEvent) {
		const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const d = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)) * profile.length;
		at = d;
		app.cursor = pointAt(profile, d).at;
	}
	function leave(e: PointerEvent) {
		if (e.pointerType !== 'mouse') return;
		at = null;
		app.cursor = null;
	}
	onDestroy(() => (app.cursor = null));
</script>

<div class="mt-3 rounded-2xl bg-surface-2 px-3 pt-2 pb-2.5">
	<div class="flex items-baseline justify-between text-[11px] text-ink-soft">
		<span class="tabular">{formatMeters(profile.top)}</span>
		<span>{t.place.profile.title}</span>
	</div>
	<div
		class="relative mt-1 cursor-crosshair select-none"
		style:height="{H}px"
		style:touch-action="pan-y"
		bind:clientWidth={width}
		onpointerdown={track}
		onpointermove={(e) => (e.pointerType === 'mouse' || e.buttons ? track(e) : undefined)}
		onpointerleave={leave}
		role="img"
		aria-label={t.place.profile.ariaLabel(
			formatMeters(profile.top),
			formatMeters(profile.bottom),
			formatDistance(profile.length),
			formatPercent(profile.steepest.pct / 100)
		)}
	>
		<svg class="absolute inset-0 overflow-visible" {width} height={H} aria-hidden="true">
			{#each areas as a (a.key)}
				<polygon
					points={a.points}
					fill={BAND[a.band].color}
					opacity={a.band === 'flat' ? 0.35 : 0.85}
				/>
			{/each}
			<polyline
				points={outline}
				fill="none"
				stroke="var(--ink)"
				stroke-width="1.5"
				stroke-linejoin="round"
			/>
			{#if hover}
				<line
					x1={hover.left}
					x2={hover.left}
					y1="0"
					y2={H}
					stroke="var(--ink)"
					stroke-width="1"
					stroke-dasharray="3 3"
				/>
				<circle
					cx={hover.left}
					cy={hover.top}
					r="5"
					fill="var(--surface)"
					stroke="var(--ink)"
					stroke-width="2"
				/>
			{/if}
		</svg>
		{#if hover}
			<span
				class="tabular pointer-events-none absolute top-0 rounded-lg bg-ink px-2 py-1 text-[11px] font-medium whitespace-nowrap text-surface"
				style:left="{Math.min(Math.max(hover.left, 52), width - 52)}px"
				style:transform="translateX(-50%)"
			>
				{formatMeters(hover.ele)} · {formatPercent(hover.pct / 100)} ({formatUnit(
					Math.round(degrees(hover.pct)),
					'degree'
				)}) · {formatDistance(hover.d)}
			</span>
		{/if}
	</div>
	<p class="tabular mt-1 text-right text-[11px] text-ink-soft">
		{t.place.profile.afterDistance(formatMeters(profile.bottom), formatDistance(profile.length))}
	</p>
	<ul class="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-soft">
		{#each bands as b (b)}
			<li class="flex items-center gap-1">
				<span
					class="size-2.5 rounded-sm"
					style:background={BAND[b].color}
					style:opacity={b === 'flat' ? 0.5 : 1}
				></span>
				{BAND[b].label}
			</li>
		{/each}
	</ul>
</div>
