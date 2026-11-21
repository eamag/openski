<script lang="ts">
	import { t } from '#lib/i18n/index.ts';
	import { status } from '#lib/state/status.svelte.ts';

	let { class: className = '' }: { class?: string } = $props();
	const source = $derived(status.data?.source);
</script>

{#if source}
	<p class="text-[11px] text-ink-soft {className}">
		{t.status.liftStatus}

		<a href={source.url} target="_blank" rel="external noopener" class="underline">{source.name}</a>
	</p>
{/if}
