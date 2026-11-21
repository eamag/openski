<script lang="ts">
	import { t } from '#lib/i18n/index.ts';
	import { app } from '#lib/state/app.svelte.ts';
	import { offline } from '#lib/state/offline.svelte.ts';
	import Icon from './Icon.svelte';

	const resort = $derived(app.resort);
	const download = $derived(resort ? offline.downloadFor(resort.id) : null);
	const percent = $derived(
		download?.progress && download.progress.total > 0
			? Math.round((download.progress.done / download.progress.total) * 100)
			: null
	);
</script>

{#if resort}
	<p class="mt-0.5 text-xs leading-relaxed text-ink-soft">
		{t.offline.description(resort.data.name)}
	</p>
	<button
		class="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-surface-2 text-sm font-medium disabled:opacity-60"
		onclick={() => offline.save(resort.data)}
		disabled={download?.state === 'busy'}
	>
		<Icon name={download?.state === 'done' ? 'check' : 'download'} size={17} />
		{#if download?.state === 'busy'}
			{percent === null ? t.offline.saving : t.offline.savingPercent(percent)}
		{:else if download?.state === 'done'}
			{t.offline.updateMap}
		{:else if download?.state === 'error' && download?.progress?.failed}
			{t.offline.retryFailed(download.progress.failed)}
		{:else}
			{t.offline.downloadForOffline}
		{/if}
	</button>
	{#if download?.state === 'error'}
		<p class="mt-2 text-xs text-bad" role="alert">{download.message}</p>
	{/if}
{/if}
