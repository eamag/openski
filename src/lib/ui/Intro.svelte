<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { readStored, writeStored } from '#lib/browser-storage.ts';
	import { t } from '#lib/i18n/index.ts';
	import { INTRO_SEEN, install } from '#lib/state/install.svelte.ts';
	import Icon, { type IconName } from './Icon.svelte';
	import Sheet from './Sheet.svelte';

	// Decided synchronously (the app is client-only) so the sheet mounts in the same
	// frame as the map controls; a deferred mount visibly shifts them.
	let isIntroVisible = $state(readStored(INTRO_SEEN) !== '1');

	function dismissIntro() {
		isIntroVisible = false;
		install.introSeen = true;
		writeStored(INTRO_SEEN, '1');
	}

	const resortParam = $derived(page.params.resort ?? '');

	type IntroRoute =
		'/(app)/[resort]/now' | '/(app)/[resort]/now?tab=lifts' | '/(app)/[resort]/route';

	interface IntroFeature {
		icon: IconName;
		title: string;
		description: string;
		route: IntroRoute;
	}

	const highlightFeatures: IntroFeature[] = $derived([
		{
			icon: 'sun',
			title: t.intro.conditions.title,
			description: t.intro.conditions.description,
			route: '/(app)/[resort]/now'
		},
		{
			icon: 'users',
			title: t.intro.queues.title,
			description: t.intro.queues.description,
			route: '/(app)/[resort]/now?tab=lifts'
		},
		{
			icon: 'route',
			title: t.intro.routes.title,
			description: t.intro.routes.description,
			route: '/(app)/[resort]/route'
		}
	]);
</script>

{#if isIntroVisible}
	<Sheet>
		<h1 class="text-[17px] leading-tight font-semibold">{t.intro.title}</h1>
		<ul class="mt-2">
			{#each highlightFeatures as feature (feature.title)}
				<li class="border-t border-line first:border-t-0">
					<a
						href={resolve(feature.route, { resort: resortParam })}
						class="flex items-center gap-3 py-2.5"
						onclick={dismissIntro}
					>
						<span
							class="grid size-9 shrink-0 place-items-center rounded-full bg-accent/12 text-accent"
						>
							<Icon name={feature.icon} size={19} />
						</span>
						<span class="min-w-0 flex-1">
							<span class="block text-[15px] font-medium">{feature.title}</span>
							<span class="block text-xs leading-snug text-ink-soft">{feature.description}</span>
						</span>
						<span class="shrink-0 text-ink-soft"><Icon name="chevron" size={16} /></span>
					</a>
				</li>
			{/each}
		</ul>
		<div class="mt-2 flex items-center gap-3">
			<p class="min-w-0 flex-1 text-[11px] leading-relaxed text-ink-soft">
				{t.intro.offlineNote}
			</p>
			<button
				class="h-10 shrink-0 rounded-2xl bg-surface-2 px-4 text-sm font-semibold"
				onclick={dismissIntro}
			>
				{t.intro.showMap}
			</button>
		</div>
	</Sheet>
{/if}
