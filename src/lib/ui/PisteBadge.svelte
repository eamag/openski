<script lang="ts">
	import type { Difficulty } from '#lib/resort/types.ts';
	import { app } from '#lib/state/app.svelte.ts';
	import { getDifficultySystem } from '#lib/resort/difficulty.ts';

	const DEFAULT_BADGE_SIZE = 28;
	const UNKNOWN_DIFFICULTY_COLOR = '#9ca3af';
	const LONG_LABEL_CHAR_THRESHOLD = 2;
	const LONG_LABEL_FONT_RATIO = 0.36;
	const SHORT_LABEL_FONT_RATIO = 0.43;

	let {
		difficulty,
		label = '',
		size = DEFAULT_BADGE_SIZE,
		country
	}: { difficulty: Difficulty; label?: string; size?: number; country?: string } = $props();

	const activeCountry = $derived(country ?? app.country);
	const system = $derived(getDifficultySystem(activeCountry));
	const isNorthAmerica = $derived(system === 'north_america');

	const isExpertOrAdvanced = $derived(difficulty === 'advanced' || difficulty === 'expert');
	const badgeBackgroundColor = $derived(
		difficulty === 'unknown' ? UNKNOWN_DIFFICULTY_COLOR : `var(--piste-${difficulty})`
	);
	const fontScale = $derived(
		label.length > LONG_LABEL_CHAR_THRESHOLD ? LONG_LABEL_FONT_RATIO : SHORT_LABEL_FONT_RATIO
	);
	const fontSizePx = $derived(size * fontScale);
</script>

<span
	class="tabular inline-flex shrink-0 items-center justify-center font-bold"
	class:rounded-full={!isNorthAmerica || difficulty !== 'intermediate'}
	class:rounded-md={isNorthAmerica && difficulty === 'intermediate'}
	class:text-surface={isExpertOrAdvanced}
	class:text-white={!isExpertOrAdvanced}
	style:background={badgeBackgroundColor}
	style:width="{size}px"
	style:height="{size}px"
	style:font-size="{fontSizePx}px"
>
	{label}
</span>
