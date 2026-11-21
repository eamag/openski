<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { t } from '#lib/i18n/index.ts';

	interface OsmUserSession {
		name: string;
		image: string | null;
		canWrite?: boolean;
		hasEditScope?: boolean;
	}
	interface OsmEditReadiness {
		writesEnabled: boolean;
		allowedToWrite: boolean;
		canWrite: boolean;
		reason: string | null;
	}
	interface MeApiResponse {
		user: OsmUserSession;
		readiness?: OsmEditReadiness;
		revokeUrl?: string;
	}

	let user = $state<OsmUserSession | null>(null);
	let readiness = $state<OsmEditReadiness | null>(null);
	let revokeUrl = $state('https://www.openstreetmap.org/oauth2/authorized_applications');
	let isSessionLoaded = $state(false);

	onMount(() => {
		fetch('/api/me')
			.then((response) => (response.ok ? (response.json() as Promise<MeApiResponse>) : null))
			.then((sessionData) => {
				if (!sessionData) return;
				user = sessionData.user;
				if (sessionData.readiness) readiness = sessionData.readiness;
				if (sessionData.revokeUrl) revokeUrl = sessionData.revokeUrl;
				isSessionLoaded = true;
			})
			.catch(() => {});
	});

	const here = $derived(`${page.url.pathname}${page.url.search}`);
</script>

{#if isSessionLoaded}
	<div class="mt-4 rounded-2xl bg-surface-2 p-3.5">
		{#if user}
			<div class="flex items-center gap-3">
				{#if user.image}
					<img src={user.image} alt="" class="size-9 shrink-0 rounded-full" />
				{/if}
				<div class="min-w-0 flex-1 text-sm">
					<span class="block truncate font-medium">{user.name}</span>
					<span class="block text-xs text-ink-soft">
						{t.account.signedIn}
						{#if user.canWrite}
							· <span class="font-semibold text-good">{t.account.canSaveEdits}</span>
						{/if}
					</span>
				</div>
				<form method="POST" action={`/logout?next=${encodeURIComponent(here)}`}>
					<button class="h-10 rounded-xl bg-surface px-3 text-sm font-medium">
						{t.common.signOut}
					</button>
				</form>
			</div>

			{#if readiness && !readiness.canWrite}
				<p class="mt-2 text-xs text-warn">
					{readiness.reason ?? t.account.savingUnavailable}
					{#if !user.hasEditScope}
						<a
							href={resolve(`/login?scope=edit&next=${encodeURIComponent(here)}`)}
							data-sveltekit-reload
							class="font-semibold underline"
						>
							{t.account.grantEditPermission}
						</a>
					{/if}
				</p>
			{/if}

			<form
				method="POST"
				action={`/logout?action=unlink&next=${encodeURIComponent(here)}`}
				class="mt-3 border-t border-line/60 pt-2.5 text-[11px] leading-relaxed text-ink-soft"
			>
				{t.account.unlink.signOutNote}
				<button type="submit" class="font-medium text-ink underline hover:text-bad">
					{t.account.unlink.forgetLogin}
				</button>
				{t.account.unlink.revokeNote}
				<a
					href={revokeUrl}
					target="_blank"
					rel="external noreferrer"
					class="font-medium text-ink underline"
				>
					{t.account.unlink.osmAppSettings}
				</a>.
			</form>
		{:else}
			<div class="flex items-center justify-between gap-3">
				<p class="min-w-0 flex-1 text-xs text-ink-soft">
					{t.account.signInPrompt}
				</p>
				<a
					href={resolve(`/login?next=${encodeURIComponent(here)}`)}
					data-sveltekit-reload
					class="flex h-10 shrink-0 items-center rounded-xl bg-accent px-3 text-sm font-semibold text-accent-ink"
				>
					{t.common.signIn}
				</a>
			</div>
		{/if}
	</div>
{/if}
