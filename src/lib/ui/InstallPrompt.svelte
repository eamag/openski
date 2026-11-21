<script lang="ts">
	import { t } from '#lib/i18n/index.ts';
	import { install } from '#lib/state/install.svelte.ts';
	import Icon from './Icon.svelte';

	const APP_ICON_SRC = '/icons/icon-192.png';
	const SHARE_ACTION_ICON_SIZE_PX = 13;

	let { compact = false }: { compact?: boolean } = $props();
</script>

{#if install.possible}
	<div class="rounded-3xl border border-line bg-surface p-4 {compact ? '' : 'shadow-lg'}">
		<div class="flex items-start gap-3">
			<img src={APP_ICON_SRC} alt="" class="size-11 shrink-0 rounded-xl" />
			<div class="min-w-0 flex-1">
				<p class="text-[15px] font-semibold">{t.install.title}</p>
				<p class="mt-0.5 text-xs leading-relaxed text-ink-soft">
					{t.install.description}
				</p>
			</div>
		</div>
		{#if install.native}
			<div class="mt-3 flex gap-2">
				<button
					class="h-10 flex-1 rounded-2xl bg-accent text-sm font-semibold text-accent-ink"
					onclick={() => install.install()}
				>
					{t.install.install}
				</button>
				{#if !compact}
					<button
						class="h-10 rounded-2xl bg-surface-2 px-4 text-sm font-medium"
						onclick={() => install.dismiss()}
					>
						{t.install.notNow}
					</button>
				{/if}
			</div>
		{:else}
			<ol class="mt-3 space-y-1.5 text-sm">
				<li class="flex items-center gap-2">
					<span
						class="grid size-5 shrink-0 place-items-center rounded-full bg-surface-2 text-[11px] font-semibold"
					>
						1
					</span>
					{t.install.step1Tap}
					<span
						class="inline-flex items-center gap-1 rounded-md bg-surface-2 px-1.5 py-0.5 text-xs font-medium"
					>
						<Icon name="upload" size={SHARE_ACTION_ICON_SIZE_PX} />
						{t.install.step1Share}
					</span>
					{t.install.step1InBrowser}
				</li>
				<li class="flex items-center gap-2">
					<span
						class="grid size-5 shrink-0 place-items-center rounded-full bg-surface-2 text-[11px] font-semibold"
					>
						2
					</span>
					{t.install.step2Choose} <b class="font-semibold">{t.install.step2AddToHomeScreen}</b>
				</li>
			</ol>
			{#if !compact}
				<button
					class="mt-3 h-10 w-full rounded-2xl bg-surface-2 text-sm font-medium"
					onclick={() => install.dismiss()}
				>
					{t.install.notNow}
				</button>
			{/if}
		{/if}
	</div>
{/if}
