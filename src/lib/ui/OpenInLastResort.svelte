<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { app } from '#lib/state/app.svelte.ts';

	let { screen }: { screen: 'now' | 'track' | 'progress' | 'route' } = $props();

	const target = (resort: string, search: string) =>
		({
			now: resolve(`${resort}/now${search}`),
			track: resolve(`${resort}/track${search}`),
			progress: resolve(`${resort}/progress${search}`),
			route: resolve(`${resort}/route${search}`)
		})[screen];

	onMount(() => {
		void goto(target(app.lastResort, page.url.search), { replace: true });
	});
</script>
