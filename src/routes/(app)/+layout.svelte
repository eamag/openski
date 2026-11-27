<script lang="ts">
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { initVitalsTracking, trackPageView } from '#lib/analytics.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	onMount(() => initVitalsTracking());

	afterNavigate(({ to }) => {
		const routeId = to?.route.id ?? page.route.id ?? '';
		const pathname = to?.url.pathname ?? page.url.pathname;
		const resort = to?.params?.resort ?? page.params.resort;
		trackPageView({ routeId, path: pathname, resort });
	});
</script>

{@render children()}
