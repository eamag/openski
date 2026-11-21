<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { t } from '#lib/i18n/index.ts';
	import { tracking } from '#lib/state/tracking.svelte.ts';
	import Icon, { type IconName } from './Icon.svelte';

	const TAB_ICON_SIZE_PX = 22;
	const ACTIVE_TAB_STROKE_WIDTH = 2.1;
	const INACTIVE_TAB_STROKE_WIDTH = 1.7;

	let { resortId }: { resortId: string } = $props();

	const tabs = [
		{ route: '/(app)/[resort]', label: t.nav.map, icon: 'map' },
		{ route: '/(app)/[resort]/route', label: t.nav.route, icon: 'route' },
		{ route: '/(app)/[resort]/track', label: t.nav.track, icon: 'record' },
		{ route: '/(app)/[resort]/progress', label: t.nav.progress, icon: 'trophy' },
		{ route: '/(app)/[resort]/now', label: t.nav.now, icon: 'sun' }
	] as const satisfies { route: string; label: string; icon: IconName }[];
</script>

<nav
	class="z-30 flex shrink-0 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:justify-center"
	aria-label={t.nav.label}
>
	{#each tabs as tab (tab.route)}
		{@const active = page.route.id === tab.route}
		<a
			href={resolve(tab.route, { resort: resortId })}
			class="relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium md:max-w-36 {active
				? 'text-accent'
				: 'text-ink-soft'}"
			aria-current={active ? 'page' : undefined}
			data-sveltekit-reset="false"
		>
			<Icon
				name={tab.icon}
				size={TAB_ICON_SIZE_PX}
				stroke={active ? ACTIVE_TAB_STROKE_WIDTH : INACTIVE_TAB_STROKE_WIDTH}
			/>
			{tab.label}
			{#if tab.route === '/(app)/[resort]/track' && tracking.recording}
				<span class="absolute top-2 right-[calc(50%-16px)] size-2 animate-pulse rounded-full bg-bad"
				></span>
			{/if}
		</a>
	{/each}
</nav>
