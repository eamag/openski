<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { fetchElement } from '#lib/osm/api.ts';
	import { tagDiff } from '#lib/osm/change.ts';
	import {
		getActiveKey,
		LIFT_PRESETS,
		PISTE_PRESETS,
		readFieldValue,
		writeFieldValue,
		type PresetField
	} from '#lib/osm/presets.ts';
	import type {
		Conflict,
		OsmEditRequest,
		OsmEditResponse,
		OsmEditSuccess,
		OsmEditUnchanged,
		OsmElement,
		TagChange
	} from '#lib/osm/types.ts';
	import { readStoredJson, writeStored } from '#lib/browser-storage.ts';
	import { liftIcon } from '#lib/format.ts';
	import type { Difficulty, LiftType } from '#lib/resort/types.ts';
	import { app } from '#lib/state/app.svelte.ts';
	import Icon from '#lib/ui/Icon.svelte';
	import PisteBadge from '#lib/ui/PisteBadge.svelte';
	import Sheet from '#lib/ui/Sheet.svelte';
	import ConflictCard from '#lib/ui/edit/ConflictCard.svelte';
	import ReviewSheet from '#lib/ui/edit/ReviewSheet.svelte';
	import TagField from '#lib/ui/edit/TagField.svelte';
	import { t } from '#lib/i18n/index.ts';

	interface WayRef {
		id: number;
		lat: number;
		lon: number;
	}

	interface Target {
		kind: 'lift' | 'piste';
		liftType?: LiftType;
		difficulty?: Difficulty;
		index: number;
		name: string;
		ref: string;
		ways: WayRef[];
		lat: number;
		lon: number;
	}

	interface Restored {
		activeWayId: number | null;
		originalTags: Record<string, string>;
		editedTags: Record<string, string>;
		changesetComment: string;
		changesetSource: string;
	}

	const resort = $derived(app.resort);
	const resortId = $derived(page.params.resort ?? app.resort?.id ?? '');
	const kindParam = $derived(page.url.searchParams.get('kind'));
	const indexParam = $derived(page.url.searchParams.get('index'));
	const target = $derived.by((): Target | null => {
		const r = resort?.data;
		if (!r) return null;
		const idx = indexParam === null ? NaN : Number(indexParam);
		if (!Number.isInteger(idx)) return null;
		if (kindParam === 'lift') {
			const lift = r.lifts[idx];
			if (!lift) return null;
			const wayId = Number(lift.id.replace(/^l/, ''));
			if (!Number.isFinite(wayId)) return null;
			const point = lift.coords?.[0];
			return {
				kind: 'lift',
				liftType: lift.type,
				index: idx,
				name: lift.name,
				ref: lift.ref ?? '',
				ways: [
					{ id: wayId, lat: point ? point[1] : r.center[1], lon: point ? point[0] : r.center[0] }
				],
				lat: point ? point[1] : r.center[1],
				lon: point ? point[0] : r.center[0]
			};
		}
		if (kindParam === 'piste') {
			const piste = r.pistes[idx];
			if (!piste || !piste.ways?.length) return null;
			const lat = piste.label?.[1] ?? r.center[1];
			const lon = piste.label?.[0] ?? r.center[0];
			return {
				kind: 'piste',
				difficulty: piste.difficulty,
				index: idx,
				name: piste.title ?? (piste.ref ? t.edit.pisteRef(piste.ref) : piste.id),
				ref: piste.ref ?? '',
				ways: piste.ways.map((id) => ({ id, lat, lon })),
				lat,
				lon
			};
		}
		return null;
	});

	const here = $derived(`${page.url.pathname}${page.url.search}`);
	const storageKey = $derived(`openski:edit:${resortId}:${kindParam ?? '?'}:${indexParam ?? '?'}`);

	let user = $state<{
		id: string;
		name: string;
		image: string | null;
		canWrite?: boolean;
		hasEditScope?: boolean;
	} | null>(null);
	let serverName = $state('OpenStreetMap');
	let authLoading = $state(true);
	let readiness = $state<{
		writesEnabled: boolean;
		allowedToWrite: boolean;
		canWrite: boolean;
		hasEditScope: boolean;
		reason: string | null;
	}>({
		writesEnabled: false,
		allowedToWrite: false,
		canWrite: false,
		hasEditScope: false,
		reason: null
	});
	let revokeUrl = $state('https://www.openstreetmap.org/oauth2/authorized_applications');
	let activeWayId = $state<number | null>(null);
	let currentElement = $state<OsmElement | null>(null);
	let originalTags = $state<Record<string, string>>({});
	let editedTags = $state<Record<string, string>>({});
	let isFetchingLive = $state(false);
	let liveError = $state<string | null>(null);
	let changesetComment = $state('');
	let changesetSource = $state('survey');
	let customTagKey = $state('');
	let customTagValue = $state('');
	let isReviewOpen = $state(false);
	let isSaving = $state(false);
	let conflict = $state<Conflict | null>(null);
	let success = $state<OsmEditSuccess | OsmEditUnchanged | null>(null);
	let restored: Restored | null = null;
	let loaded = $state(false);

	const presets = $derived(target?.kind === 'lift' ? LIFT_PRESETS : PISTE_PRESETS);
	const missingFields = $derived(
		presets
			.filter(
				(f) => readFieldValue(f, editedTags) === undefined && (f.appliesTo?.(editedTags) ?? true)
			)
			.sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
	);
	const existingFields = $derived(
		presets.filter((f) => readFieldValue(f, editedTags) !== undefined)
	);
	const extraTags = $derived(
		Object.entries(editedTags).filter(
			([key]) => !presets.some((f) => f.key === key || f.alternateKeys?.includes(key))
		)
	);
	const diff = $derived<TagChange[]>(tagDiff(originalTags, editedTags));
	const activeWay = $derived(target?.ways.find((w) => w.id === activeWayId) ?? null);

	$effect(() => {
		void fetch('/api/me')
			.then(
				(r) =>
					r.json() as Promise<{
						user: typeof user;
						server?: string;
						readiness?: typeof readiness;
						revokeUrl?: string;
					}>
			)
			.then((j) => {
				user = j.user;
				if (j.server) serverName = j.server;
				if (j.readiness) readiness = j.readiness;
				if (j.revokeUrl) revokeUrl = j.revokeUrl;
			})
			.catch(() => {
				user = null;
			})
			.finally(() => {
				authLoading = false;
			});
	});

	$effect(() => {
		const t = target;
		if (!t || restored) return;
		restored = readStoredJson<Restored | null>(storageKey, null, 'session');
		if (restored) {
			activeWayId = restored.activeWayId;
			originalTags = restored.originalTags ?? {};
			editedTags = restored.editedTags ?? {};
			changesetComment = restored.changesetComment ?? '';
			changesetSource = restored.changesetSource ?? 'survey';
		}
		const way = restored?.activeWayId ?? t.ways[0]?.id ?? null;
		if (way) void loadWay(way);
		else loaded = true;
	});

	$effect(() => {
		if (target && loaded) persistNow();
	});

	async function loadWay(wayId: number) {
		activeWayId = wayId;
		isFetchingLive = true;
		liveError = null;
		conflict = null;
		success = null;

		currentElement = { type: 'way', id: wayId, version: 1, tags: {} };
		originalTags = {};
		editedTags = restored && restored.activeWayId === wayId ? { ...restored.editedTags } : {};
		if (!restored || !changesetComment)
			changesetComment = `Update tags for ${target?.name ?? `way ${wayId}`} (way ${wayId}) #${resortId} #openski`;
		loaded = true;

		try {
			const live = await fetchElement({ base: 'https://api.openstreetmap.org' }, 'way', wayId);
			currentElement = live;
			originalTags = { ...(live.tags ?? {}) };
			if (!restored || restored.activeWayId !== wayId) editedTags = { ...originalTags };
		} catch (err) {
			liveError = err instanceof Error ? err.message : String(err);
		} finally {
			isFetchingLive = false;
		}
	}

	function persistNow() {
		const draft: Restored = {
			activeWayId,
			originalTags,
			editedTags,
			changesetComment,
			changesetSource
		};
		writeStored(storageKey, JSON.stringify(draft), 'session');
	}

	function signIn() {
		persistNow();
		window.location.href = `/login?scope=edit&next=${encodeURIComponent(here)}`;
	}

	function change(field: PresetField, val: string | null) {
		editedTags = writeFieldValue(field, editedTags, val);
	}

	function remove(field: PresetField) {
		editedTags = writeFieldValue(field, editedTags, null);
	}

	function addCustomTag() {
		const k = customTagKey.trim();
		const v = customTagValue.trim();
		if (!k || !v) return;
		editedTags = { ...editedTags, [k]: v };
		customTagKey = '';
		customTagValue = '';
	}

	function removeCustomTag(key: string) {
		const next = { ...editedTags };
		delete next[key];
		editedTags = next;
	}

	async function save() {
		if (
			!target ||
			!currentElement ||
			!activeWay ||
			!user ||
			diff.length === 0 ||
			!readiness.canWrite
		)
			return;
		isSaving = true;
		try {
			const request: OsmEditRequest = {
				kind: target.kind,
				wayId: activeWay.id,
				element: currentElement,
				changes: diff,
				tags: editedTags,
				comment: changesetComment,
				source: changesetSource,
				lat: activeWay.lat ?? target.lat,
				lon: activeWay.lon ?? target.lon
			};
			const res = await fetch('/api/osm/edit', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(request)
			});
			const result = (await res.json().catch(() => null)) as
				OsmEditResponse | { message?: string } | null;
			if (res.status === 401) {
				isReviewOpen = false;
				signIn();
				return;
			}
			if (res.status === 409 && result && 'error' in result) {
				conflict = result.conflict;
				isReviewOpen = false;
				return;
			}
			if (!res.ok || !result || (!('ok' in result) && !('unchanged' in result))) {
				throw new Error(
					result && 'message' in result ? (result.message ?? t.edit.saveFailed) : t.edit.saveFailed
				);
			}
			success = result;
			originalTags = { ...editedTags };
			writeStored(storageKey, null, 'session');
			isReviewOpen = false;
		} catch (err) {
			liveError = err instanceof Error ? err.message : String(err);
		} finally {
			isSaving = false;
		}
	}

	function close() {
		app.selection = null;
		void goto(resolve('/(app)/[resort]', { resort: resortId }));
	}
</script>

{#if !resort}
	<div
		class="pointer-events-auto absolute inset-x-4 top-1/3 mx-auto max-w-sm rounded-2xl bg-surface p-5 text-center text-sm text-ink-soft shadow-lg"
	>
		{t.edit.loadingResort}
	</div>
{:else if target}
	<Sheet tall>
		<div class="flex items-start justify-between gap-2">
			<div class="min-w-0">
				<div class="flex items-center gap-2">
					<button
						type="button"
						class="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 text-ink"
						onclick={close}
						aria-label={t.edit.backToMap}
					>
						<span class="text-lg leading-none">‹</span>
					</button>
					<h1 class="truncate text-lg font-semibold">{t.edit.title(target.name)}</h1>
				</div>
				<p class="mt-1 text-xs text-ink-soft">
					{target.kind === 'lift' ? t.edit.lift : t.edit.piste}
					{#if currentElement}
						{t.edit.wayAndVersion(currentElement.id, currentElement.version)}{/if}
					{#if isFetchingLive}
						· <span class="text-accent">{t.edit.loadingCurrentTags}</span>{/if}
				</p>
			</div>
			{#if authLoading}
				<span class="size-10 shrink-0 animate-pulse rounded-full bg-surface-2"></span>
			{:else if user}
				<div class="flex shrink-0 items-center gap-1.5">
					{#if user.image}
						<img src={user.image} alt="" class="size-8 rounded-full" />
					{/if}
					<span class="max-w-24 truncate text-xs font-medium text-ink">{user.name}</span>
				</div>
			{:else}
				<button
					type="button"
					class="min-h-10 shrink-0 rounded-xl bg-accent px-3 text-xs font-semibold text-accent-ink"
					onclick={signIn}
				>
					{t.common.signIn}
				</button>
			{/if}
		</div>

		{#if success}
			<div
				class="mt-3 rounded-2xl border border-good/40 bg-good/10 p-3 text-xs text-good"
				role="status"
			>
				{#if 'unchanged' in success}
					<p class="font-semibold">{success.message}</p>
				{:else}
					<p class="font-semibold">
						{success.action === 'create'
							? t.edit.testNodeCreated(success.changesetId)
							: t.edit.changesSaved(success.changesetId)}
					</p>
					<a
						class="mt-1 inline-block font-medium underline"
						href={success.url}
						target="_blank"
						rel="external noreferrer"
					>
						{t.edit.openChangeset}
					</a>
				{/if}
			</div>
		{/if}

		{#if conflict}
			<div class="mt-3">
				<ConflictCard
					{conflict}
					onDismiss={() => (conflict = null)}
					onReload={() => activeWayId && loadWay(activeWayId)}
				/>
			</div>
		{/if}

		{#if !user && !authLoading}
			<div
				class="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-surface-2 p-3"
			>
				<p class="text-xs text-ink-soft">{t.edit.signInPrompt}</p>
				<button
					type="button"
					class="min-h-10 rounded-xl bg-accent px-3 text-xs font-semibold text-accent-ink"
					onclick={signIn}
				>
					{t.common.signIn}
				</button>
			</div>
		{:else if user && !readiness.canWrite}
			<div class="mt-3 rounded-2xl bg-warn/15 p-3 text-xs text-warn">
				<p class="font-semibold">{t.edit.cantSaveYet}</p>
				<p class="mt-0.5">
					{readiness.reason ?? t.edit.savingUnavailable}
				</p>
				{#if !readiness.hasEditScope}
					<button
						type="button"
						class="mt-2 min-h-9 rounded-lg bg-surface px-3 font-semibold text-ink shadow-xs"
						onclick={signIn}
					>
						{t.edit.grantEditPermission}
					</button>
				{/if}
			</div>
		{/if}

		{#if liveError}
			<p class="mt-3 rounded-xl bg-warn/10 p-3 text-xs text-warn" role="status">
				{t.edit.liveError(liveError)}
			</p>
		{/if}

		<div class="mt-3 rounded-2xl border border-line p-3">
			{#if target.kind === 'lift'}
				<div class="flex items-center gap-3">
					<span class="grid size-10 shrink-0 place-items-center rounded-full bg-ink text-surface">
						<Icon name={target.liftType ? liftIcon(target.liftType) : 'gondola'} size={20} />
					</span>
					<div class="min-w-0">
						<h2 class="truncate text-sm font-semibold">{target.name}</h2>
						{#if target.ref}<p class="text-xs text-ink-soft">{t.edit.refLabel(target.ref)}</p>{/if}
					</div>
				</div>
			{:else}
				<div class="flex items-center gap-3">
					<PisteBadge difficulty={target.difficulty ?? 'unknown'} label={target.ref} size={40} />
					<h2 class="truncate text-sm font-semibold">{target.name}</h2>
				</div>
			{/if}
			{#if target.ways.length > 1}
				<div class="mt-3 border-t border-line pt-2.5">
					<p class="mb-1.5 text-[11px] font-semibold text-ink-soft">
						{t.edit.multiWayPrompt(target.ways.length)}
					</p>
					<div class="flex flex-wrap gap-1.5">
						{#each target.ways as way, i (way.id)}
							<button
								type="button"
								class="min-h-10 rounded-lg px-2.5 py-2 font-mono text-xs font-medium {activeWayId ===
								way.id
									? 'bg-ink text-surface'
									: 'bg-surface-2 text-ink'}"
								aria-pressed={activeWayId === way.id}
								onclick={() => loadWay(way.id)}
							>
								{i + 1} · #{way.id}
							</button>
						{/each}
					</div>
				</div>
			{/if}
		</div>

		{#if missingFields.length}
			<h3 class="mt-4 text-xs font-bold tracking-wider text-accent uppercase">
				{t.edit.missingTags(missingFields.length)}
			</h3>
			<div class="mt-2 space-y-2">
				{#each missingFields as field (field.key)}
					<TagField
						{field}
						value={undefined}
						activeKey={getActiveKey(field, editedTags)}
						isMissing={true}
						onChange={(val) => change(field, val)}
						onDelete={() => remove(field)}
					/>
				{/each}
			</div>
		{/if}

		<h3 class="mt-4 text-xs font-bold tracking-wider text-ink-soft uppercase">
			{t.edit.currentTags(existingFields.length)}
		</h3>
		<div class="mt-2 space-y-2">
			{#each existingFields as field (field.key)}
				<TagField
					{field}
					value={readFieldValue(field, editedTags)}
					activeKey={getActiveKey(field, editedTags)}
					isMissing={false}
					onChange={(val) => change(field, val)}
					onDelete={() => remove(field)}
				/>
			{/each}
		</div>

		{#if extraTags.length}
			<h3 class="mt-4 text-xs font-bold tracking-wider text-ink-soft uppercase">
				{t.edit.otherTags}
			</h3>
			<div class="mt-2 divide-y divide-line overflow-hidden rounded-xl border border-line">
				{#each extraTags as [k, v] (k)}
					<div class="flex items-center justify-between gap-2 px-3 py-2 text-xs">
						<span class="truncate font-mono font-medium text-ink">{k}</span>
						<span class="flex items-center gap-2">
							<span class="max-w-36 truncate font-mono text-ink-soft">"{v}"</span>
							<button
								type="button"
								class="grid size-10 place-items-center text-ink-soft"
								onclick={() => removeCustomTag(k)}
								aria-label={t.edit.removeTagKey(k)}
							>
								✕
							</button>
						</span>
					</div>
				{/each}
			</div>
		{/if}

		<div class="mt-3 flex gap-2">
			<input
				type="text"
				placeholder={t.edit.tagKeyPlaceholder}
				class="min-h-10 w-1/3 rounded-xl border border-line bg-surface-2 px-3 py-2 text-xs text-ink focus:border-accent focus:outline-hidden"
				bind:value={customTagKey}
			/>
			<input
				type="text"
				placeholder={t.edit.tagValuePlaceholder}
				class="min-h-10 flex-1 rounded-xl border border-line bg-surface-2 px-3 py-2 text-xs text-ink focus:border-accent focus:outline-hidden"
				bind:value={customTagValue}
				onkeydown={(e) => e.key === 'Enter' && addCustomTag()}
			/>
			<button
				type="button"
				class="min-h-10 rounded-xl border border-line bg-surface px-3 text-xs font-semibold text-ink"
				onclick={addCustomTag}
			>
				{t.edit.add}
			</button>
		</div>

		{#if user}
			<div
				class="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-3 text-xs text-ink-soft"
			>
				<form method="POST" action={`/logout?next=${encodeURIComponent(here)}`}>
					<button type="submit" class="min-h-10 text-xs font-medium text-ink-soft underline">
						{t.common.signOut}
					</button>
				</form>
				<form method="POST" action={`/logout?action=unlink&next=${encodeURIComponent(here)}`}>
					<button
						type="submit"
						class="min-h-10 text-xs font-medium text-ink-soft underline hover:text-bad"
					>
						{t.edit.unlinkAccount}
					</button>
				</form>
				<a
					href={revokeUrl}
					target="_blank"
					rel="external noreferrer"
					class="min-h-10 text-xs font-medium text-ink-soft underline"
				>
					{t.edit.revokeOnOsm}
				</a>
			</div>
		{/if}

		<div
			class="sticky bottom-0 -mx-4 mt-4 flex items-center justify-between gap-3 border-t border-line bg-surface px-4 py-3"
		>
			<div>
				<p class="text-xs font-bold text-ink">
					{diff.length === 0 ? t.edit.noChanges : t.edit.changesCount(diff.length)}
				</p>
				{#if user}<p class="text-[11px] text-ink-soft">{t.edit.savesToServer(serverName)}</p>{/if}
			</div>
			<button
				type="button"
				class="min-h-11 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink disabled:opacity-40"
				disabled={diff.length === 0 || (user !== null && !readiness.canWrite)}
				onclick={() => (isReviewOpen = true)}
			>
				{t.edit.reviewAndSave}
			</button>
		</div>
	</Sheet>
	<ReviewSheet
		isOpen={isReviewOpen}
		onClose={() => (isReviewOpen = false)}
		wayId={activeWayId ?? 0}
		{diff}
		{originalTags}
		{changesetComment}
		{changesetSource}
		server={serverName}
		{user}
		{isSaving}
		canWrite={readiness.canWrite}
		writeReason={readiness.reason}
		onSave={save}
		onSignIn={signIn}
		onCommentChange={(c) => (changesetComment = c)}
		onSourceChange={(s) => (changesetSource = s)}
	/>
{:else}
	<div
		class="pointer-events-auto absolute inset-x-4 top-1/3 mx-auto max-w-sm rounded-2xl bg-surface p-5 text-center text-sm text-ink-soft shadow-lg"
	>
		{#if kindParam === 'piste' && indexParam !== null && !isNaN(Number(indexParam)) && resort?.data.pistes[Number(indexParam)] && !resort.data.pistes[Number(indexParam)].ways?.length}
			{t.edit.pisteNotEditable}
		{:else}
			{t.edit.openFromMap}
		{/if}
	</div>
{/if}
