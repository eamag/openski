<script lang="ts">
	import type { PresetField } from '#lib/osm/presets.ts';
	import { app } from '#lib/state/app.svelte.ts';
	import { getEditorDifficultyLabel } from '#lib/resort/difficulty.ts';
	import { t } from '#lib/i18n/index.ts';

	const AERIALWAY_DURATION_MINUTES_PRESETS = ['3', '4:30', '5', '7', '10'];
	const AERIALWAY_CAPACITY_PERSONS_PER_HOUR_PRESETS = ['1200', '1800', '2400', '3000'];
	const AERIALWAY_OCCUPANCY_SEATS_PRESETS = ['2', '4', '6', '8', '10'];

	let {
		field,
		value,
		activeKey,
		isMissing,
		onChange,
		onDelete
	}: {
		field: PresetField;
		value: string | undefined;
		activeKey: string;
		isMissing: boolean;
		onChange: (val: string | null) => void;
		onDelete: () => void;
	} = $props();

	let textInputValue = $derived(value ?? '');

	function handleTextSubmit() {
		onChange(textInputValue.trim());
	}

	function tagValueLabel(key: string, val: string): string {
		if (key === 'piste:difficulty') return getEditorDifficultyLabel(val, app.country);
		if (key === 'aerialway' && val in t.lifts.type)
			return t.lifts.type[val as keyof typeof t.lifts.type];
		if (key === 'piste:grooming') {
			if (val === 'classic') return t.osm.presets.piste.grooming.classic;
			if (val === 'mogul') return t.osm.presets.piste.grooming.mogul;
			if (val === 'backcountry') return t.osm.presets.piste.grooming.backcountry;
		}
		if (key === 'aerialway:bicycle' && val === 'summer') return t.osm.presets.lift.bicycle.summer;
		if (val === 'yes') return t.common.yes;
		if (val === 'no') return t.common.no;
		return val.replace(/_/g, ' ');
	}
</script>

{#if isMissing}
	<div class="rounded-2xl border border-line bg-surface-2 p-3.5 shadow-xs">
		<div class="flex items-start justify-between gap-2">
			<div>
				<p class="text-sm leading-snug font-semibold text-ink">{field.question}</p>
				<p class="mt-0.5 text-xs text-ink-soft">
					{t.edit.fields.tagLabel}<span class="font-mono text-ink">{activeKey}</span>
					{#if field.unit}
						<span class="ml-1 text-ink-soft">({field.unit})</span>
					{/if}
				</p>
			</div>
		</div>

		<div class="mt-2.5">
			{#if field.type === 'bool'}
				<div class="flex gap-2">
					<button
						type="button"
						class="min-h-10 flex-1 rounded-xl border border-line bg-surface py-2 text-sm font-medium text-ink shadow-xs transition-colors hover:border-ink"
						onclick={() => onChange('yes')}
					>
						{t.common.yes}
					</button>
					<button
						type="button"
						class="min-h-10 flex-1 rounded-xl border border-line bg-surface py-2 text-sm font-medium text-ink shadow-xs transition-colors hover:border-ink"
						onclick={() => onChange('no')}
					>
						{t.common.no}
					</button>
				</div>
			{:else if field.type === 'enum' && field.allowedValues}
				<div class="flex flex-wrap gap-1.5">
					{#each field.allowedValues as val (val)}
						<button
							type="button"
							class="flex min-h-10 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-medium text-ink shadow-xs transition-colors hover:border-ink"
							onclick={() => onChange(val)}
						>
							{#if field.key === 'piste:difficulty'}
								<span class="size-2.5 rounded-full" style:background="var(--piste-{val})"></span>
							{/if}
							{tagValueLabel(field.key, val)}
						</button>
					{/each}
				</div>
			{:else if field.type === 'number'}
				<div class="flex flex-col gap-2">
					{#if field.key === 'aerialway:duration'}
						<div class="flex flex-wrap gap-1.5">
							{#each AERIALWAY_DURATION_MINUTES_PRESETS as preset (preset)}
								<button
									type="button"
									class="min-h-10 rounded-lg border border-line bg-surface px-2.5 py-2 text-xs font-medium text-ink hover:border-ink"
									onclick={() => onChange(preset)}
								>
									{t.edit.fields.durationMinutesPreset(preset)}
								</button>
							{/each}
						</div>
					{:else if field.key === 'aerialway:capacity'}
						<div class="flex flex-wrap gap-1.5">
							{#each AERIALWAY_CAPACITY_PERSONS_PER_HOUR_PRESETS as preset (preset)}
								<button
									type="button"
									class="min-h-10 rounded-lg border border-line bg-surface px-2.5 py-2 text-xs font-medium text-ink hover:border-ink"
									onclick={() => onChange(preset)}
								>
									{t.edit.fields.capacityPersonsPerHourPreset(preset)}
								</button>
							{/each}
						</div>
					{:else if field.key === 'aerialway:occupancy'}
						<div class="flex flex-wrap gap-1.5">
							{#each AERIALWAY_OCCUPANCY_SEATS_PRESETS as preset (preset)}
								<button
									type="button"
									class="min-h-10 rounded-lg border border-line bg-surface px-2.5 py-2 text-xs font-medium text-ink hover:border-ink"
									onclick={() => onChange(preset)}
								>
									{t.edit.fields.occupancySeatsPreset(preset)}
								</button>
							{/each}
						</div>
					{/if}
					<div class="flex gap-2">
						<input
							type="text"
							class="min-h-10 flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-soft focus:border-accent focus:outline-hidden"
							placeholder={field.unit
								? t.edit.fields.placeholderWithUnit(field.unit)
								: t.edit.fields.genericPlaceholder}
							bind:value={textInputValue}
							onkeydown={(e) => e.key === 'Enter' && handleTextSubmit()}
						/>
						<button
							type="button"
							class="min-h-10 rounded-xl bg-ink px-4 py-2 text-sm font-medium text-surface"
							onclick={handleTextSubmit}
						>
							{t.edit.fields.set}
						</button>
					</div>
				</div>
			{:else}
				<div class="flex gap-2">
					<input
						type="text"
						class="min-h-10 flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-soft focus:border-accent focus:outline-hidden"
						placeholder={field.type === 'url'
							? t.edit.fields.urlPlaceholder
							: field.type === 'opening_hours'
								? t.edit.fields.openingHoursPlaceholder
								: t.edit.fields.genericPlaceholder}
						bind:value={textInputValue}
						onkeydown={(e) => e.key === 'Enter' && handleTextSubmit()}
					/>
					<button
						type="button"
						class="min-h-10 rounded-xl bg-ink px-4 py-2 text-sm font-medium text-surface"
						onclick={handleTextSubmit}
					>
						{t.edit.fields.set}
					</button>
				</div>
			{/if}
		</div>
	</div>
{:else}
	<div class="flex flex-col gap-1.5 rounded-xl border border-line bg-surface p-2.5 shadow-2xs">
		<div class="flex items-center justify-between gap-2">
			<span class="text-xs font-medium text-ink">{field.label}</span>
			<span class="font-mono text-[11px] text-ink-soft">{activeKey}</span>
		</div>

		<div class="flex items-center gap-2">
			{#if field.type === 'bool'}
				<div class="flex flex-1 gap-1 rounded-lg bg-surface-2 p-1">
					<button
						type="button"
						class="min-h-9 flex-1 rounded-md py-1.5 text-xs font-medium transition-colors {value ===
						'yes'
							? 'bg-surface font-semibold text-good shadow-2xs'
							: 'text-ink-soft'}"
						onclick={() => onChange('yes')}
					>
						{t.common.yes}
					</button>
					<button
						type="button"
						class="min-h-9 flex-1 rounded-md py-1.5 text-xs font-medium transition-colors {value ===
						'no'
							? 'bg-surface font-semibold text-bad shadow-2xs'
							: 'text-ink-soft'}"
						onclick={() => onChange('no')}
					>
						{t.common.no}
					</button>
				</div>
			{:else if field.type === 'enum' && field.allowedValues}
				<select
					class="min-h-10 flex-1 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-ink focus:border-accent focus:outline-hidden"
					{value}
					onchange={(e) => onChange(e.currentTarget.value)}
				>
					{#each field.allowedValues as val (val)}
						<option value={val}>
							{tagValueLabel(field.key, val)}
						</option>
					{/each}
				</select>
			{:else}
				<input
					type="text"
					class="min-h-10 flex-1 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-xs text-ink focus:border-accent focus:outline-hidden"
					bind:value={textInputValue}
					onblur={handleTextSubmit}
					onkeydown={(e) => e.key === 'Enter' && handleTextSubmit()}
				/>
				{#if field.unit}
					<span class="shrink-0 text-xs text-ink-soft">{field.unit}</span>
				{/if}
			{/if}

			<button
				type="button"
				class="grid size-10 shrink-0 place-items-center rounded-lg text-ink-soft hover:bg-surface-2 hover:text-bad"
				onclick={onDelete}
				aria-label={t.edit.fields.removeTag}
				title={t.edit.fields.removeTag}
			>
				✕
			</button>
		</div>
	</div>
{/if}
