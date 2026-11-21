<script lang="ts">
	import type { TagChange } from '#lib/osm/types.ts';
	import { t } from '#lib/i18n/index.ts';

	let {
		isOpen,
		onClose,
		wayId,
		diff,
		originalTags,
		changesetComment,
		changesetSource,
		server,
		user,
		isSaving,
		canWrite = true,
		writeReason = null,
		onSave,
		onSignIn,
		onCommentChange,
		onSourceChange
	}: {
		isOpen: boolean;
		onClose: () => void;
		wayId: number;
		diff: TagChange[];
		originalTags: Record<string, string>;
		changesetComment: string;
		changesetSource: string;
		server: string;
		user: { name: string; image: string | null } | null;
		isSaving: boolean;
		canWrite?: boolean;
		writeReason?: string | null;
		onSave: () => void;
		onSignIn: () => void;
		onCommentChange: (c: string) => void;
		onSourceChange: (s: string) => void;
	} = $props();
</script>

{#if isOpen}
	<div
		class="pointer-events-auto fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs"
	>
		<div
			class="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border border-line bg-surface shadow-2xl"
			role="dialog"
			aria-modal="true"
			aria-label={t.edit.review.ariaLabel}
		>
			<div class="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
				<div class="min-w-0">
					<h2 class="text-base font-bold text-ink">{t.edit.review.title}</h2>
					<p class="truncate text-xs text-ink-soft">
						{t.edit.review.tagChanges(diff.length, wayId)}
					</p>
				</div>
				<button
					type="button"
					class="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-soft"
					onclick={onClose}
					aria-label={t.edit.review.closeAria}
				>
					✕
				</button>
			</div>

			<div class="no-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
				{#if user && !canWrite}
					<div class="rounded-2xl bg-warn/15 p-3 text-xs text-warn" role="alert">
						<p class="font-semibold">{t.edit.review.cantSaveYet}</p>
						<p class="mt-0.5">
							{writeReason ?? t.edit.review.savingUnavailable}
						</p>
					</div>
				{/if}

				<div>
					<h3 class="mb-2 text-xs font-bold tracking-wider text-ink-soft uppercase">
						{t.edit.review.changesHeading}
					</h3>
					<div class="divide-y divide-line overflow-hidden rounded-2xl border border-line">
						{#each diff as change (change.key)}
							{@const isDeletion = change.delete}
							{@const isAddition = !(change.key in originalTags)}
							<div class="flex items-center justify-between gap-2 px-3 py-2 text-xs">
								<span class="flex min-w-0 items-center gap-1.5">
									{#if isDeletion}
										<span class="rounded bg-bad/15 px-1 py-0.5 text-[10px] font-bold text-bad">
											{t.edit.review.delBadge}
										</span>
										<span class="truncate font-mono text-bad line-through">{change.key}</span>
									{:else if isAddition}
										<span class="rounded bg-good/15 px-1 py-0.5 text-[10px] font-bold text-good">
											{t.edit.review.addBadge}
										</span>
										<span class="truncate font-mono font-medium text-good">{change.key}</span>
									{:else}
										<span class="rounded bg-warn/15 px-1 py-0.5 text-[10px] font-bold text-warn">
											{t.edit.review.modBadge}
										</span>
										<span class="truncate font-mono font-medium text-ink">{change.key}</span>
									{/if}
								</span>
								<span class="shrink-0 text-right font-mono text-[11px] text-ink">
									{#if isDeletion}
										<span class="text-ink-soft">
											{t.edit.review.wasValue(originalTags[change.key])}
										</span>
									{:else if isAddition}
										<span class="font-semibold text-good">"{change.value}"</span>
									{:else}
										<span class="text-ink-soft line-through">"{originalTags[change.key]}"</span>
										<span class="mx-1 text-ink-soft">→</span>
										<span class="font-semibold text-warn">"{change.value}"</span>
									{/if}
								</span>
							</div>
						{/each}
					</div>
				</div>

				<div class="space-y-2">
					<label class="block text-xs font-medium text-ink" for="edit-comment">
						{t.edit.review.comment}
					</label>
					<input
						id="edit-comment"
						type="text"
						class="min-h-11 w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-hidden"
						value={changesetComment}
						oninput={(e) => onCommentChange(e.currentTarget.value)}
					/>
					<label class="block text-xs font-medium text-ink" for="edit-source">
						{t.edit.review.source}
					</label>
					<input
						id="edit-source"
						type="text"
						class="min-h-11 w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-hidden"
						value={changesetSource}
						oninput={(e) => onSourceChange(e.currentTarget.value)}
					/>
				</div>

				<div class="rounded-2xl bg-surface-2 p-3 text-xs text-ink-soft">
					<p>
						{t.edit.review.savesTo} <span class="font-mono font-medium text-ink">{server}</span>
					</p>
					<p class="mt-1">
						{#if user}
							{t.edit.review.signedInAs} <span class="font-semibold text-ink">{user.name}</span>
						{:else}
							{t.edit.review.signInPrompt}
						{/if}
					</p>
				</div>
			</div>

			<div class="space-y-2 border-t border-line bg-surface-2 p-4">
				{#if user}
					<button
						type="button"
						class="min-h-12 w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-accent-ink disabled:opacity-40"
						disabled={diff.length === 0 || isSaving || !canWrite}
						onclick={onSave}
					>
						{isSaving ? t.edit.review.saving : t.edit.review.saveChanges}
					</button>
				{:else}
					<button
						type="button"
						class="min-h-12 w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-accent-ink"
						onclick={onSignIn}
					>
						{t.edit.review.signInToSave}
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}
