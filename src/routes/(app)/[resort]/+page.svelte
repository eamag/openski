<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { t } from '#lib/i18n/index.ts';
	import { placeKey, search, type SearchResult } from '#lib/resort/places.ts';
	import { app } from '#lib/state/app.svelte.ts';
	import { settings } from '#lib/state/settings.svelte.ts';
	import { webcams } from '#lib/state/webcams.svelte.ts';
	import Icon from '#lib/ui/Icon.svelte';
	import MapOptions from '#lib/ui/MapOptions.svelte';
	import OfflineButton from '#lib/ui/OfflineButton.svelte';
	import WebcamCard from '#lib/ui/WebcamCard.svelte';
	import InstallPrompt from '#lib/ui/InstallPrompt.svelte';
	import Intro from '#lib/ui/Intro.svelte';
	import { install } from '#lib/state/install.svelte.ts';
	import { liftIcon } from '#lib/format.ts';
	import PisteBadge from '#lib/ui/PisteBadge.svelte';
	import PlaceCard from '#lib/ui/PlaceCard.svelte';
	import Sheet from '#lib/ui/Sheet.svelte';

	let query = $state('');
	let focused = $state(false);
	let input = $state<HTMLInputElement>();
	let menu = $state(false);

	const MAX_SEARCH_RESULTS = 10;

	let handledLinkKey = '';
	$effect(() => {
		const resort = app.resort;
		const pisteId = page.url.searchParams.get('piste');
		const liftId = page.url.searchParams.get('lift');
		const linkKey = `${resort?.id}:${pisteId}:${liftId}`;
		if (!resort || !(pisteId || liftId) || handledLinkKey === linkKey) return;
		handledLinkKey = linkKey;
		const pisteIndex = pisteId ? resort.data.pistes.findIndex((piste) => piste.id === pisteId) : -1;
		const liftIndex = liftId ? resort.data.lifts.findIndex((lift) => lift.id === liftId) : -1;
		if (pisteIndex >= 0) app.selection = { kind: 'piste', index: pisteIndex };
		else if (liftIndex >= 0) app.selection = { kind: 'lift', index: liftIndex };
	});

	const results = $derived(
		app.resort && focused ? search(app.resort, query, MAX_SEARCH_RESULTS) : []
	);

	function choose(r: SearchResult) {
		app.selection = { kind: r.kind, index: r.index };
		query = '';
		focused = false;
		input?.blur();
	}
</script>

<div
	class="pointer-events-auto absolute inset-x-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-20 mx-auto max-w-xl md:mx-0 md:max-w-md"
>
	<label
		class="flex h-12 items-center gap-2.5 rounded-full border border-line bg-surface px-4 shadow-[0_2px_12px_rgb(0_0_0/0.12)]"
	>
		<span class="text-ink-soft"><Icon name="search" size={18} /></span>
		<input
			bind:this={input}
			bind:value={query}
			onfocus={() => (focused = true)}
			onblur={() => setTimeout(() => (focused = false), 150)}
			type="search"
			enterkeyhint="search"
			autocomplete="off"
			placeholder={t.map.searchPlaceholder(app.resort?.data.name ?? '')}
			class="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-soft"
		/>
		<button
			type="button"
			class="-mr-2 grid size-10 place-items-center rounded-full text-ink-soft {menu
				? 'bg-surface-2 text-ink'
				: ''}"
			onclick={(e) => {
				e.preventDefault();
				menu = !menu;
			}}
			aria-expanded={menu}
			aria-label={t.map.options}
		>
			<Icon name="layers" size={19} />
		</button>
	</label>
	{#if menu && !results.length}
		<div class="mt-2 rounded-3xl border border-line bg-surface p-4 shadow-lg">
			<MapOptions />
			{#if install.possible}
				<hr class="my-3 border-line" />
				<InstallPrompt compact />
			{/if}
			<hr class="my-3 border-line" />
			<a
				href={resolve('/(app)/[resort]/about', { resort: page.params.resort ?? '' })}
				class="flex items-center gap-3 py-1"
				onclick={() => (menu = false)}
			>
				<span class="min-w-0 flex-1">
					<span class="block text-[15px] font-medium">
						{t.map.aboutResort(app.resort?.data.name ?? '')}
					</span>
					<span class="block text-xs leading-relaxed text-ink-soft">
						{t.map.aboutDescription}
					</span>
				</span>
				<span class="shrink-0 text-ink-soft"><Icon name="chevron" size={16} /></span>
			</a>
			<hr class="my-3 border-line" />
			<p class="text-[15px] font-medium">{t.map.offlineMap}</p>
			<OfflineButton />
			<hr class="my-3 border-line" />
			<button
				class="flex w-full items-center gap-3 py-1 text-left"
				onclick={() => {
					menu = false;
					settings.show();
				}}
			>
				<span class="min-w-0 flex-1">
					<span class="block text-[15px] font-medium">{t.map.allSettings}</span>
					<span class="block text-xs leading-relaxed text-ink-soft">
						{t.map.settingsDescription}
					</span>
				</span>
				<span class="shrink-0 text-ink-soft"><Icon name="settings" size={18} /></span>
			</button>
		</div>
	{/if}
	{#if results.length}
		<ul
			class="mt-2 max-h-[50vh] overflow-y-auto rounded-3xl border border-line bg-surface py-1 shadow-lg"
		>
			{#each results as r (placeKey(r.place))}
				<li>
					<button
						class="flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-surface-2"
						onmousedown={(e) => e.preventDefault()}
						onclick={() => choose(r)}
					>
						{#if r.kind === 'piste' && app.resort}
							{@const p = app.resort.data.pistes[r.index]}
							<PisteBadge difficulty={p.difficulty} label={p.ref} size={30} />
						{:else}
							<span class="grid size-[30px] place-items-center rounded-full bg-surface-2">
								<Icon
									name={r.kind === 'lift' && app.resort
										? liftIcon(app.resort.data.lifts[r.index].type)
										: 'pin'}
									size={17}
								/>
							</span>
						{/if}
						<span class="min-w-0 flex-1">
							<span class="block truncate text-[15px] font-medium">{r.label}</span>
							<span class="block text-xs text-ink-soft">{r.detail}</span>
						</span>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>

{#if install.due && app.resort && !app.selection && !focused && !menu && !webcams.selected}
	<div
		class="pointer-events-auto absolute inset-x-3 top-[calc(env(safe-area-inset-top)+4.75rem)] z-10 mx-auto max-w-xl md:mx-0 md:max-w-md"
	>
		<InstallPrompt />
	</div>
{/if}

{#if app.resort && app.selection}
	<Sheet>
		<PlaceCard resort={app.resort} selection={app.selection} />
	</Sheet>
{:else if webcams.selected}
	<Sheet>
		{#key webcams.selected.osm}
			<WebcamCard cam={webcams.selected} />
		{/key}
	</Sheet>
{:else if app.resort && !focused && !menu}
	<Intro />
{/if}
