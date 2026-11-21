<script lang="ts">
	import { formatNumber, t } from '#lib/i18n/index.ts';
	import { scoreColor, scoreWord } from '#lib/conditions/model.ts';

	export interface HourStripCell {
		index: number;
		hour: number;
		score: number | null;
	}

	const NO_CELL_SELECTED = -1;

	let {
		cells,
		selected = NO_CELL_SELECTED,
		compact = false,
		onselect
	}: {
		cells: HourStripCell[];
		selected?: number;
		compact?: boolean;
		onselect?: (index: number) => void;
	} = $props();
</script>

<div class="flex gap-1" role={onselect ? 'radiogroup' : 'img'} aria-label={t.conditions.byHour}>
	{#each cells as cell (cell.index)}
		{@const isSelected = cell.index === selected}
		<svelte:element
			this={onselect ? 'button' : 'div'}
			class="flex min-w-0 flex-1 flex-col items-center gap-1"
			role={onselect ? 'radio' : undefined}
			aria-checked={onselect ? isSelected : undefined}
			aria-label={t.conditions.hourCellAria(
				cell.hour,
				cell.score === null ? t.conditions.noForecast : scoreWord(cell.score)
			)}
			onclick={onselect ? () => onselect(cell.index) : undefined}
		>
			<span
				class="w-full rounded-lg transition-[height,box-shadow] duration-150 {compact
					? 'h-2.5'
					: isSelected
						? 'h-9'
						: 'h-7'} {isSelected && !compact
					? 'shadow-[0_0_0_2px_var(--surface),0_0_0_4px_var(--ink)]'
					: ''}"
				style:background={cell.score === null ? 'var(--surface-2)' : scoreColor(cell.score)}
			></span>
			<span
				class="tabular text-[11px] leading-none {isSelected
					? 'font-semibold text-ink'
					: 'text-ink-soft'}"
			>
				{formatNumber(cell.hour)}
			</span>
		</svelte:element>
	{/each}
</div>
