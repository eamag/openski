<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { install } from '#lib/state/install.svelte.ts';
	import { theme } from '#lib/state/theme.svelte.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	onMount(() => {
		install.init();
		theme.init();
		return () => theme.destroy();
	});

	$effect(() => theme.apply(theme.dark));
</script>

{@render children()}
