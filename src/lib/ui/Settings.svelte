<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import {
		chooseLocale,
		chosenLocale,
		LOCALE_NAMES,
		LOCALES,
		matchLocale,
		t,
		type Locale
	} from '#lib/i18n/index.ts';
	import { loadCatalog } from '#lib/state/catalog.ts';
	import { app } from '#lib/state/app.svelte.ts';
	import { install } from '#lib/state/install.svelte.ts';
	import { offline } from '#lib/state/offline.svelte.ts';
	import { progress } from '#lib/state/progress.svelte.ts';
	import { settings } from '#lib/state/settings.svelte.ts';
	import { theme, type ThemeChoice } from '#lib/state/theme.svelte.ts';
	import Account from './Account.svelte';
	import Icon, { type IconName } from './Icon.svelte';
	import InstallPrompt from './InstallPrompt.svelte';
	import MapOptions from './MapOptions.svelte';
	import OfflineButton from './OfflineButton.svelte';
	import Sheet from './Sheet.svelte';

	const themes: { value: ThemeChoice; title: string; hint: string; icon: IconName }[] = [
		{
			value: 'auto',
			title: t.settings.theme.auto,
			hint: t.settings.theme.autoHint,
			icon: 'monitor'
		},
		{
			value: 'light',
			title: t.settings.theme.light,
			hint: t.settings.theme.lightHint,
			icon: 'sun'
		},
		{ value: 'dark', title: t.settings.theme.dark, hint: t.settings.theme.darkHint, icon: 'moon' },
		{
			value: 'sunset',
			title: t.settings.theme.sunset,
			hint: t.settings.theme.sunsetHint,
			icon: 'moon'
		}
	];

	const AUTO_LANGUAGE = 'auto';
	const deviceLocale = matchLocale(navigator.languages ?? [navigator.language]);
	const languageChoice: Locale | typeof AUTO_LANGUAGE = chosenLocale() ?? AUTO_LANGUAGE;

	function onLanguageChange(event: Event & { currentTarget: HTMLSelectElement }) {
		const value = event.currentTarget.value;
		chooseLocale(value === AUTO_LANGUAGE ? null : (value as Locale));
	}

	let saved = $state<{ id: string; name: string }[]>([]);
	let confirmClear = $state(false);

	$effect(() => {
		if (!settings.open) return;
		const ids = Object.keys(offline.saved).sort();
		confirmClear = false;
		void loadCatalog().then((catalog) => {
			const names = new Map(catalog?.map((resort) => [resort.id, resort.name]) ?? []);
			saved = ids.map((id) => ({ id, name: names.get(id) ?? id }));
		});
	});

	async function clearDays() {
		const currentResortId = app.resort?.data.id;
		if (!currentResortId) return;
		await progress.clearDays(currentResortId);
		confirmClear = false;
	}
</script>

{#if settings.open}
	<Sheet tall heightAware={false}>
		<div class="mb-2 flex items-center justify-between gap-3">
			<h1 class="text-lg font-semibold">{t.settings.title}</h1>
			<button
				class="grid size-9 place-items-center rounded-full bg-surface-2 text-ink-soft"
				onclick={() => settings.close()}
				aria-label={t.settings.close}
			>
				<Icon name="x" size={18} />
			</button>
		</div>

		<section class="mt-4">
			<h2 class="text-[13px] font-semibold tracking-wide text-ink-soft uppercase">
				{t.settings.language}
			</h2>
			<label class="mt-2 flex items-center gap-3 rounded-2xl bg-surface-2 px-3 py-2">
				<span class="text-ink-soft"><Icon name="globe" size={19} /></span>
				<span class="sr-only">{t.settings.language}</span>
				<select
					class="min-w-0 flex-1 bg-transparent py-1 text-[15px] font-medium"
					value={languageChoice}
					onchange={onLanguageChange}
				>
					<option value={AUTO_LANGUAGE}>
						{t.settings.languageAuto(LOCALE_NAMES[deviceLocale])}
					</option>
					{#each LOCALES as code (code)}
						<option value={code} lang={code}>{LOCALE_NAMES[code]}</option>
					{/each}
				</select>
			</label>
			<p class="mt-1.5 px-1 text-xs text-ink-soft">{t.settings.languageHint}</p>
		</section>

		<section class="mt-5">
			<h2 class="text-[13px] font-semibold tracking-wide text-ink-soft uppercase">
				{t.settings.appearance}
			</h2>
			<div class="mt-2 space-y-1">
				{#each themes as t (t.value)}
					<button
						class="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left {theme.choice ===
						t.value
							? 'bg-surface-2'
							: ''}"
						onclick={() => theme.set(t.value)}
						aria-pressed={theme.choice === t.value}
					>
						<span class="text-ink-soft"><Icon name={t.icon} size={19} /></span>
						<span class="min-w-0 flex-1">
							<span class="block text-[15px] font-medium">{t.title}</span>
							<span class="block text-xs text-ink-soft">{t.hint}</span>
						</span>
						<span
							class="grid size-5 shrink-0 place-items-center rounded-full border-2 {theme.choice ===
							t.value
								? 'border-accent bg-accent text-accent-ink'
								: 'border-line'}"
						>
							{#if theme.choice === t.value}<Icon name="check" size={13} stroke={2.8} />{/if}
						</span>
					</button>
				{/each}
			</div>
		</section>

		<section class="mt-5">
			<h2 class="text-[13px] font-semibold tracking-wide text-ink-soft uppercase">
				{t.settings.mapDisplay}
			</h2>
			<div class="mt-1">
				<MapOptions />
			</div>
		</section>

		<section class="mt-5">
			<h2 class="text-[13px] font-semibold tracking-wide text-ink-soft uppercase">
				{t.settings.account}
			</h2>
			<Account />
		</section>

		<section class="mt-5">
			<h2 class="text-[13px] font-semibold tracking-wide text-ink-soft uppercase">
				{t.settings.offlineData}
			</h2>
			<div class="mt-2"><OfflineButton /></div>
			{#if saved.length}
				<ul class="mt-3 space-y-1">
					{#each saved as item (item.id)}
						<li class="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2">
							<span class="text-good"><Icon name="check" size={15} /></span>
							<span class="min-w-0 flex-1 truncate text-sm">{item.name}</span>
							<button
								class="text-xs font-medium text-ink-soft"
								onclick={() => void offline.forget(item.id)}
								aria-label={t.settings.removeSaved(item.name)}
							>
								{t.common.remove}
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<section class="mt-5">
			<h2 class="text-[13px] font-semibold tracking-wide text-ink-soft uppercase">
				{t.settings.savedDays}
			</h2>
			{#if confirmClear}
				<div class="mt-2 rounded-2xl border border-warn/40 bg-warn/10 p-3">
					<p class="text-sm">{t.settings.forgetDays(app.resort?.data.name ?? '')}</p>
					<div class="mt-2 flex gap-2">
						<button
							class="h-9 flex-1 rounded-xl bg-bad text-sm font-semibold text-white"
							onclick={() => void clearDays()}
						>
							{t.settings.confirmClear}
						</button>
						<button
							class="h-9 flex-1 rounded-xl bg-surface text-sm font-medium"
							onclick={() => (confirmClear = false)}
						>
							{t.settings.keepDays}
						</button>
					</div>
				</div>
			{:else}
				<button
					class="mt-2 flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left hover:bg-surface-2"
					onclick={() => (confirmClear = true)}
				>
					<span class="text-ink-soft"><Icon name="trash" size={18} /></span>
					<span>
						<span class="block text-[15px] font-medium">{t.settings.clearDays}</span>
						<span class="block text-xs text-ink-soft">{t.settings.clearDaysHint}</span>
					</span>
				</button>
			{/if}
		</section>

		{#if install.possible}
			<section class="mt-5">
				<InstallPrompt compact />
			</section>
		{/if}

		{#if app.resort}
			<section class="mt-5">
				<a
					href={resolve('/(app)/[resort]/about', { resort: page.params.resort ?? '' })}
					class="flex items-center gap-3 rounded-2xl px-3 py-2 hover:bg-surface-2"
					onclick={() => settings.close()}
				>
					<span class="text-ink-soft"><Icon name="info" size={19} /></span>
					<span class="min-w-0 flex-1">
						<span class="block text-[15px] font-medium">
							{t.settings.aboutResort(app.resort.data.name)}
						</span>
						<span class="block text-xs text-ink-soft">{t.settings.aboutResortHint}</span>
					</span>
					<Icon name="chevron" size={16} />
				</a>
			</section>
		{/if}

		<section class="mt-5">
			<a
				href="https://github.com/eamag/openski"
				class="flex items-center gap-3 rounded-2xl px-3 py-2 hover:bg-surface-2"
			>
				<span class="text-ink-soft"><Icon name="external" size={19} /></span>
				<span class="min-w-0 flex-1">
					<span class="block text-[15px] font-medium">{t.settings.sourceCode}</span>
					<span class="block text-xs text-ink-soft">{t.settings.sourceCodeHint}</span>
				</span>
			</a>
		</section>
	</Sheet>
{/if}
