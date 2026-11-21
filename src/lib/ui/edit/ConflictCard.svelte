<script lang="ts">
	import type { Conflict } from '#lib/osm/types.ts';
	import { t } from '#lib/i18n/index.ts';

	let {
		conflict,
		onDismiss,
		onReload
	}: {
		conflict: Conflict;
		onDismiss: () => void;
		onReload: () => void;
	} = $props();
	const hasKeyConflicts = $derived(Boolean(conflict.keys && conflict.keys.length > 0));
</script>

<div class="rounded-2xl border-2 border-bad/40 bg-bad/10 p-4 shadow-md">
	<div class="flex items-start justify-between gap-3">
		<div>
			<div class="flex items-center gap-2">
				<span
					class="grid size-6 shrink-0 place-items-center rounded-full bg-bad text-xs font-bold text-white"
				>
					!
				</span>
				<h3 class="text-base font-bold text-bad">{t.edit.conflict.title}</h3>
			</div>
			<p class="mt-1 text-xs text-ink-soft">
				{conflict.message}
			</p>
		</div>
		<button
			type="button"
			class="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-soft hover:bg-surface"
			onclick={onDismiss}
			aria-label={t.edit.conflict.dismissAria}
		>
			✕
		</button>
	</div>

	{#if hasKeyConflicts}
		<div class="mt-3 overflow-hidden rounded-xl border border-line bg-surface">
			<div class="overflow-x-auto">
				<table class="w-full min-w-[20rem] text-left text-xs">
					<thead class="border-b border-line bg-surface-2 text-ink-soft">
						<tr>
							<th class="px-3 py-2 font-semibold">{t.edit.conflict.key}</th>
							<th class="px-3 py-2 font-semibold text-accent">{t.edit.conflict.yourEdit}</th>
							<th class="px-3 py-2 font-semibold text-warn">{t.edit.conflict.osmNow}</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-line">
						{#each conflict.keys as keyDiff (keyDiff.key)}
							<tr>
								<td class="px-3 py-2 font-mono font-medium text-ink">{keyDiff.key}</td>
								<td class="px-3 py-2">
									{#if keyDiff.userValue === null}
										<span class="rounded bg-bad/15 px-1.5 py-0.5 text-[11px] font-medium text-bad">
											{t.edit.conflict.deleted}
										</span>
									{:else}
										<span
											class="rounded bg-accent/15 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-accent"
										>
											"{keyDiff.userValue}"
										</span>
									{/if}
								</td>
								<td class="px-3 py-2">
									{#if keyDiff.upstreamValue === null}
										<span class="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-ink-soft">
											{t.edit.conflict.none}
										</span>
									{:else}
										<span
											class="rounded bg-warn/15 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-warn"
										>
											"{keyDiff.upstreamValue}"
										</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}

	<div class="mt-3.5 flex flex-wrap gap-2">
		<button
			type="button"
			class="min-h-10 flex-1 rounded-xl bg-ink px-4 py-2 text-xs font-semibold text-surface hover:opacity-90"
			onclick={onReload}
		>
			{t.edit.conflict.reload}
		</button>
		<button
			type="button"
			class="min-h-10 rounded-xl border border-line bg-surface px-4 py-2 text-xs font-medium text-ink hover:bg-surface-2"
			onclick={onDismiss}
		>
			{t.edit.conflict.keepReviewing}
		</button>
	</div>
</div>
