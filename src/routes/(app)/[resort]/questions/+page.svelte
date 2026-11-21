<script lang="ts">
	import { onDestroy } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { fetchElements } from '#lib/osm/api.ts';
	import { pisteKeyFor } from '#lib/osm/change.ts';
	import {
		nearest,
		openQuests,
		QUEST_TYPES,
		resortElementsFromData,
		surveyablePistes,
		type Quest,
		type QuestAnswer
	} from '#lib/osm/quests.ts';
	import type {
		OsmEditRequest,
		OsmEditResponse,
		OsmEditSuccess,
		OsmEditUnchanged,
		OsmElement,
		TagChange
	} from '#lib/osm/types.ts';
	import { readStoredJson, writeStored } from '#lib/browser-storage.ts';
	import { app } from '#lib/state/app.svelte.ts';
	import { location } from '#lib/state/location.svelte.ts';
	import Icon from '#lib/ui/Icon.svelte';
	import { liftIcon } from '#lib/format.ts';
	import PisteBadge from '#lib/ui/PisteBadge.svelte';
	import Sheet from '#lib/ui/Sheet.svelte';
	import type { ResortData } from '#lib/resort/types.ts';
	import { formatDistance, t } from '#lib/i18n/index.ts';

	interface DraftAnswer {
		quest: Quest;
		value: string;
	}

	interface StoredSurveyAnswer {
		questId: string;
		typeId: string;
		kind: 'lift' | 'piste';
		index: number;
		wayIds: number[];
		value: string;
	}

	interface StoredSurveyState {
		version: 1;
		resortId: string;
		answers: StoredSurveyAnswer[];
		comment: string;
		source: string;
		isReviewOpen: boolean;
	}

	const resortId = $derived(page.params.resort ?? '');
	const doneKey = $derived(`openski:quests-done:${resortId}`);
	const draftStorageKey = $derived(`openski:survey-draft:${resortId}`);

	// Cache live OSM ways fetched during this browser session
	const liveWayCache = new Map<number, OsmElement>();
	const inFlightWayIds = new Set<number>();

	let user = $state<{ id: string; name: string; image: string | null; canWrite?: boolean } | null>(
		null
	);
	let server = $state('');
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

	let elements = $state.raw(new Map<number, OsmElement>());
	let loadState = $state<'loading' | 'ready' | 'error'>('loading');
	let loadError = $state('');
	let done = $state.raw(new Set<string>());
	let skipped = $state.raw(new Set<string>());
	let typed = $state('');
	let from = $state.raw<[number, number] | null>(null);

	let drafts = $state<DraftAnswer[]>([]);
	let isReviewOpen = $state(false);
	let isUploading = $state(false);
	let uploadError = $state<string | null>(null);
	let lastSuccess = $state<OsmEditSuccess | OsmEditUnchanged | null>(null);
	let changesetComment = $state('');
	let changesetSource = $state('survey');
	let restoredFromStorage = $state(false);

	$effect(() => {
		void fetch('/api/me')
			.then(
				(r) =>
					r.json() as Promise<{
						user: typeof user;
						server?: string;
						readiness?: typeof readiness;
					}>
			)
			.then((j) => {
				user = j.user;
				server = j.server ?? '';
				if (j.readiness) readiness = j.readiness;
			})
			.catch(() => (user = null))
			.finally(() => (authLoading = false));
	});

	$effect(() => {
		done = new Set(readStoredJson<string[]>(doneKey, []));
	});

	function rebuildElementsMap(data: ResortData): Map<number, OsmElement> {
		const base = resortElementsFromData(data);
		for (const [id, live] of liveWayCache) {
			const cur = base.get(id);
			if (cur) {
				base.set(id, {
					...cur,
					version: live.version,
					tags: { ...cur.tags, ...live.tags }
				});
			}
		}
		for (const d of drafts) {
			for (const w of d.quest.ways) {
				const el = base.get(w.id);
				if (el) {
					const targetKey =
						d.quest.kind === 'piste'
							? pisteKeyFor(d.quest.type.key, el.tags ?? {})
							: d.quest.type.key;
					el.tags = { ...(el.tags ?? {}), [targetKey]: d.value };
				}
			}
		}
		return base;
	}

	function restoreDraftsFromStorage(data: ResortData, currentElements: Map<number, OsmElement>) {
		const stored = readStoredJson<StoredSurveyState | null>(draftStorageKey, null);
		if (!stored || stored.resortId !== resortId || !Array.isArray(stored.answers)) {
			return;
		}

		const pisteLines = new Map<number, [number, number][]>();
		for (const e of data.edges as unknown as { k: string; o: number; g: number[] }[]) {
			if (e.k !== 'p' || !Array.isArray(e.g)) continue;
			const pts = pisteLines.get(e.o) ?? [];
			for (let i = 0; i + 1 < e.g.length; i += 2) pts.push([e.g[i], e.g[i + 1]]);
			pisteLines.set(e.o, pts);
		}

		const resort = app.resort;
		const pisteName = (i: number) => (resort ? resort.pisteName(data.pistes[i]) : `Piste ${i + 1}`);

		const surveyable = surveyablePistes(data);
		const restoredList: DraftAnswer[] = [];
		for (const a of stored.answers) {
			if (!a || typeof a !== 'object') continue;
			const type = QUEST_TYPES.find((t) => t.id === a.typeId);
			if (!type || (a.kind !== 'lift' && a.kind !== 'piste') || a.kind !== type.kind) continue;
			if (typeof a.index !== 'number' || !Number.isInteger(a.index) || a.index < 0) continue;
			const wayIds = Array.isArray(a.wayIds) ? [...new Set(a.wayIds)] : [];
			if (!wayIds.length || !wayIds.every((id) => Number.isSafeInteger(id) && id > 0)) continue;
			if (typeof a.value !== 'string' || !a.value.trim()) continue;

			// The stored ways must still belong to the same lift or piste.
			if (a.kind === 'lift') {
				const lift = data.lifts[a.index];
				if (!lift) continue;
				const liftWayId = Number(/^l(\d+)$/.exec(lift.id)?.[1]);
				if (wayIds.length !== 1 || liftWayId !== wayIds[0]) continue;
			} else {
				const piste = data.pistes[a.index];
				if (!piste || !surveyable.has(a.index)) continue;
				if (!wayIds.every((id) => piste.ways?.includes(id))) continue;
			}

			const ways = wayIds.flatMap((id) => currentElements.get(id) ?? []);
			if (ways.length !== wayIds.length) continue;
			const wayElement = ways[0];

			// Validate value against type answers if restricted
			if (type.answers && !type.input) {
				const allowed = type.answers(wayElement.tags ?? {}, app.country);
				if (allowed.length > 0 && !allowed.some((ans) => ans.value === a.value)) {
					continue;
				}
			}

			const points =
				a.kind === 'lift'
					? (data.lifts[a.index].coords as [number, number][])
					: (pisteLines.get(a.index) ?? [data.pistes[a.index].label as [number, number]]);
			const { at, d } = nearest(points, from);
			const name = a.kind === 'lift' ? data.lifts[a.index].name : pisteName(a.index);

			const quest: Quest = {
				id: a.questId || `${type.id}:${a.kind}${a.index}`,
				type,
				kind: a.kind,
				index: a.index,
				name,
				ways,
				distance: d,
				at
			};

			restoredList.push({ quest, value: a.value });
		}

		if (restoredList.length > 0) {
			drafts = restoredList;
			if (typeof stored.comment === 'string' && stored.comment.trim()) {
				changesetComment = stored.comment.trim();
			}
			if (typeof stored.source === 'string' && stored.source.trim()) {
				changesetSource = stored.source.trim();
			}
			if (typeof stored.isReviewOpen === 'boolean') {
				isReviewOpen = stored.isReviewOpen;
			}

			// Apply restored draft tags to elements
			const updated = new Map(currentElements);
			for (const d of restoredList) {
				for (const w of d.quest.ways) {
					const el = updated.get(w.id);
					if (el) {
						const targetKey =
							d.quest.kind === 'piste'
								? pisteKeyFor(d.quest.type.key, el.tags ?? {})
								: d.quest.type.key;
						el.tags = { ...(el.tags ?? {}), [targetKey]: d.value };
					}
				}
			}
			elements = updated;

			if (restoredList.length < stored.answers.length) {
				persistDraftState();
			}
		} else {
			writeStored(draftStorageKey, null);
		}
	}

	$effect(() => {
		const data = app.resort?.data;
		if (!data) return;
		try {
			const initial = rebuildElementsMap(data);
			elements = initial;
			loadState = 'ready';

			if (!restoredFromStorage) {
				restoredFromStorage = true;
				restoreDraftsFromStorage(data, initial);
			}
		} catch (err) {
			loadError = err instanceof Error ? err.message : String(err);
			loadState = 'error';
		}
	});

	location.start();
	$effect(() => {
		const fix = location.fix;
		if (fix && !from) from = [fix.lon, fix.lat];
	});

	const quests = $derived.by(() => {
		const resort = app.resort;
		if (!resort) return [];
		const pisteName = (i: number) => resort.pisteName(resort.data.pistes[i]);
		return openQuests(resort.data, elements, from, done, pisteName).filter(
			(q) => !skipped.has(q.id)
		);
	});
	const current = $derived<Quest | null>(quests[0] ?? null);

	// Batch-fetch live OSM tags for upcoming quests and merge into elements
	$effect(() => {
		const qList = quests;
		if (!qList.length) return;
		const candidateWayIds: number[] = [];
		for (const q of qList.slice(0, 25)) {
			for (const w of q.ways) {
				if (!liveWayCache.has(w.id) && !inFlightWayIds.has(w.id)) {
					candidateWayIds.push(w.id);
				}
			}
		}
		if (candidateWayIds.length > 0) {
			void fetchLiveWaysBatch(candidateWayIds);
		}
	});

	async function fetchLiveWaysBatch(ids: number[]) {
		const uniqueIds = Array.from(new Set(ids)).slice(0, 50);
		for (const id of uniqueIds) inFlightWayIds.add(id);

		try {
			const refs = uniqueIds.map((id) => ({ type: 'way' as const, id }));
			const liveList = await fetchElements(
				{ base: server || 'https://api.openstreetmap.org' },
				refs
			);
			if (!liveList || !liveList.length) return;

			for (const live of liveList) {
				liveWayCache.set(live.id, live);
			}

			if (app.resort) {
				elements = rebuildElementsMap(app.resort.data);
			}
		} catch {
			// Tolerate offline mode: fall back to skeleton elements
		} finally {
			for (const id of uniqueIds) inFlightWayIds.delete(id);
		}
	}

	$effect(() => {
		const q = current;
		app.selection = q ? { kind: q.kind, index: q.index } : null;
	});
	onDestroy(() => (app.selection = null));

	function next() {
		typed = '';
		const fix = location.fix;
		if (fix) from = [fix.lon, fix.lat];
	}

	function rememberQuests(answeredQuests: Quest[]) {
		const all = new Set(done);
		for (const q of answeredQuests) {
			for (const w of q.ways) {
				const targetKey = q.kind === 'piste' ? pisteKeyFor(q.type.key, w.tags ?? {}) : q.type.key;
				all.add(`${w.id}:${q.type.key}`);
				all.add(`${w.id}:${targetKey}`);
			}
		}
		done = all;
		writeStored(doneKey, JSON.stringify([...all]));
	}

	function persistDraftState() {
		if (!resortId) return;
		if (drafts.length === 0) {
			writeStored(draftStorageKey, null);
			return;
		}
		const state: StoredSurveyState = {
			version: 1,
			resortId,
			answers: drafts.map((d) => ({
				questId: d.quest.id,
				typeId: d.quest.type.id,
				kind: d.quest.kind,
				index: d.quest.index,
				wayIds: d.quest.ways.map((w) => w.id),
				value: d.value
			})),
			comment: changesetComment,
			source: changesetSource,
			isReviewOpen
		};
		writeStored(draftStorageKey, JSON.stringify(state));
	}

	function draftAnswer(value: string) {
		const q = current;
		if (!q) return;
		lastSuccess = null;
		uploadError = null;

		drafts = [...drafts, { quest: q, value }];

		const updated = new Map(elements);
		for (const w of q.ways) {
			const existing = updated.get(w.id) ?? w;
			const targetKey =
				q.kind === 'piste' ? pisteKeyFor(q.type.key, existing.tags ?? {}) : q.type.key;
			updated.set(w.id, {
				...existing,
				tags: { ...(existing.tags ?? {}), [targetKey]: value }
			});
		}
		elements = updated;

		persistDraftState();
		next();
	}

	function removeDraft(index: number) {
		const item = drafts[index];
		drafts = drafts.filter((_, i) => i !== index);
		if (item && app.resort) {
			elements = rebuildElementsMap(app.resort.data);
		}
		persistDraftState();
	}

	function skip() {
		if (!current) return;
		skipped = new Set([...skipped, current.id]);
		next();
	}

	function signIn() {
		persistDraftState();
		window.location.href = `/login?scope=edit&next=${encodeURIComponent(page.url.pathname)}`;
	}

	const defaultComment = () =>
		`Survey ${drafts.length} lift and piste ${drafts.length === 1 ? 'detail' : 'details'} at ${app.resort?.data.name ?? resortId} #${resortId} #openski`;

	async function uploadSurvey() {
		if (!drafts.length || isUploading) return;
		isUploading = true;
		uploadError = null;

		try {
			const wayMap = new Map<
				number,
				{ element: OsmElement; changes: TagChange[]; kind: 'lift' | 'piste'; quest: Quest }
			>();

			for (const d of drafts) {
				for (const w of d.quest.ways) {
					const existing = wayMap.get(w.id);
					const el = existing?.element ?? elements.get(w.id) ?? w;
					const targetKey =
						d.quest.kind === 'piste'
							? pisteKeyFor(d.quest.type.key, el.tags ?? {})
							: d.quest.type.key;
					const change: TagChange = { key: targetKey, value: d.value };
					if (existing) {
						existing.changes.push(change);
					} else {
						wayMap.set(w.id, {
							element: el,
							changes: [change],
							kind: d.quest.kind,
							quest: d.quest
						});
					}
				}
			}

			const wayEntries = Array.from(wayMap.entries());
			if (!wayEntries.length) return;

			const refs = wayEntries.map(([id]) => ({ type: 'way' as const, id }));
			const liveElements = await fetchElements(
				{ base: server || 'https://api.openstreetmap.org' },
				refs
			).catch(() => []);
			for (const live of liveElements) {
				liveWayCache.set(live.id, live);
				const entry = wayMap.get(live.id);
				if (entry) {
					entry.element = live;
					entry.changes = entry.changes.map((c) => ({
						...c,
						key: entry.kind === 'piste' ? pisteKeyFor(c.key, live.tags ?? {}) : c.key
					}));
				}
			}

			const [firstWayId, firstEntry] = wayEntries[0];
			const leadQuest = firstEntry.quest;

			const also = wayEntries.slice(1).map(([wayId, entry]) => ({
				wayId,
				kind: entry.kind,
				element: entry.element,
				changes: entry.changes
			}));

			const comment = changesetComment.trim() || defaultComment();
			// Every survey request must send surveyWayIds: wayId plus each also[].wayId, each way once
			const surveyWayIds = [firstWayId, ...also.map((a) => a.wayId)];

			const request: OsmEditRequest = {
				kind: firstEntry.kind,
				wayId: firstWayId,
				element: firstEntry.element,
				changes: firstEntry.changes,
				tags: { ...(firstEntry.element.tags ?? {}) },
				fillMissingTags: true,
				comment,
				source: changesetSource,
				lon: leadQuest.at[0],
				lat: leadQuest.at[1],
				surveyWayIds,
				also
			};
			for (const c of firstEntry.changes) {
				if (c.value !== null) request.tags[c.key] = c.value;
			}

			const res = await fetch('/api/osm/edit', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(request)
			});

			const result = (await res.json().catch(() => null)) as
				OsmEditResponse | { message?: string } | null;

			if (res.ok && result && ('ok' in result || 'unchanged' in result)) {
				rememberQuests(drafts.map((d) => d.quest));
				lastSuccess = result;
				drafts = [];
				writeStored(draftStorageKey, null);
				isReviewOpen = false;
				return;
			}

			if (res.status === 401) {
				uploadError = t.questions.errors.signInRequired;
				return;
			}
			if (res.status === 409) {
				uploadError = t.questions.errors.conflict;
				return;
			}
			uploadError =
				result && 'message' in result && result.message
					? result.message
					: t.questions.errors.savingFailed(res.status);
		} catch {
			uploadError = t.questions.errors.noConnection;
		} finally {
			isUploading = false;
		}
	}

	const toneColour = (a: QuestAnswer) => (a.tone ? `var(--piste-${a.tone})` : null);
	const distanceLabel = (d: number | null) =>
		d == null ? '' : t.questions.distanceAway(formatDistance(d));
</script>

<Sheet>
	<div class="flex items-center justify-between gap-2">
		<div class="flex min-w-0 items-center gap-2">
			<a
				href={resolve('/(app)/[resort]', { resort: resortId })}
				class="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 text-lg text-ink"
				aria-label={t.questions.backToMap}
			>
				‹
			</a>
			<div class="min-w-0">
				<h1 class="truncate text-lg font-semibold">
					{t.questions.title(app.resort?.data.name ?? t.questions.thisResort)}
				</h1>
				<p class="text-xs text-ink-soft">
					{t.questions.questionsLeft(quests.length)}
					{#if drafts.length}
						· <span class="font-semibold text-accent">
							{t.questions.drafted(drafts.length)}
						</span>{/if}
				</p>
			</div>
		</div>
		{#if !authLoading && user}
			<span class="flex shrink-0 items-center gap-1.5 text-xs font-medium">
				{#if user.image}<img src={user.image} alt="" class="size-7 rounded-full" />{/if}
				<span class="max-w-20 truncate">{user.name}</span>
			</span>
		{/if}
	</div>

	{#if lastSuccess}
		<div
			class="mt-3 rounded-2xl border border-good/40 bg-good/10 p-3.5 text-xs text-good"
			role="status"
		>
			{#if 'unchanged' in lastSuccess}
				<p class="font-semibold">{lastSuccess.message}</p>
			{:else}
				<p class="font-semibold">
					{lastSuccess.action === 'create'
						? t.questions.testNodeCreated(lastSuccess.changesetId)
						: t.questions.answersSaved(lastSuccess.changesetId)}
				</p>
				<a
					class="mt-1 inline-block font-medium underline"
					href={lastSuccess.url}
					target="_blank"
					rel="external noreferrer"
				>
					{t.questions.viewChangeset}
				</a>
			{/if}
		</div>
	{/if}

	{#if drafts.length > 0}
		<div
			class="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-accent/40 bg-accent/10 p-3"
		>
			<div class="min-w-0">
				<p class="text-xs font-bold text-ink">
					{t.questions.answersNotSaved(drafts.length)}
				</p>
				<p class="text-[11px] text-ink-soft">{t.questions.checkAndSaveHint}</p>
			</div>
			<button
				type="button"
				class="min-h-10 shrink-0 rounded-xl bg-accent px-3.5 text-xs font-semibold text-accent-ink"
				onclick={() => {
					isReviewOpen = true;
					if (!changesetComment) changesetComment = defaultComment();
					persistDraftState();
				}}
			>
				{t.questions.reviewAndSave}
			</button>
		</div>
	{/if}

	{#if !authLoading && !user}
		<div class="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-surface-2 p-3">
			<p class="text-xs leading-snug text-ink-soft">
				{t.questions.signInPrompt}
			</p>
			<button
				class="min-h-11 shrink-0 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink"
				onclick={signIn}
			>
				{t.common.signIn}
			</button>
		</div>
	{:else if user && !readiness.canWrite}
		<div class="mt-3 rounded-2xl bg-warn/15 p-3 text-xs text-warn">
			<p class="font-semibold">{t.questions.cantSaveYet}</p>
			<p class="mt-0.5">
				{readiness.reason ?? t.questions.savingUnavailable}
			</p>
			{#if !readiness.hasEditScope}
				<button
					type="button"
					class="mt-2 min-h-9 rounded-lg bg-surface px-3 font-semibold text-ink shadow-xs"
					onclick={signIn}
				>
					{t.questions.grantEditPermission}
				</button>
			{/if}
		</div>
	{/if}

	{#if loadState === 'error'}
		<p class="mt-3 rounded-xl bg-warn/10 p-3 text-xs text-warn" role="status">
			{t.questions.loadError(loadError)}
		</p>
	{:else if current}
		{@const q = current}
		<div class="mt-3 rounded-3xl border border-line p-4">
			<div class="flex items-center gap-3">
				{#if q.kind === 'piste' && app.resort}
					{@const p = app.resort.data.pistes[q.index]}
					<PisteBadge difficulty={p.difficulty} label={p.ref} size={36} />
				{:else if app.resort}
					<span class="grid size-9 shrink-0 place-items-center rounded-full bg-ink text-surface">
						<Icon name={liftIcon(app.resort.data.lifts[q.index].type)} size={18} />
					</span>
				{/if}
				<div class="min-w-0">
					<p class="truncate text-sm font-semibold">{q.name}</p>
					<p class="text-xs text-ink-soft">
						{q.kind === 'lift' ? t.questions.lift : t.questions.piste}{q.distance != null
							? ` · ${distanceLabel(q.distance)}`
							: ''}
						{#if q.ways.length > 1}
							· {t.questions.sections(q.ways.length)}{/if}
					</p>
				</div>
			</div>
			<p class="mt-3 text-[17px] leading-snug font-semibold">{q.type.question(q.name)}</p>
			{#if q.type.hint}<p class="mt-1 text-xs leading-snug text-ink-soft">{q.type.hint}</p>{/if}

			{#if q.type.answers}
				{@const answers = q.type.answers(q.ways[0]?.tags ?? {}, app.country)}
				<div
					class="mt-3 grid gap-2 {answers.length > 3
						? 'grid-cols-3'
						: answers.length === 2
							? 'grid-cols-2'
							: 'grid-cols-1'}"
				>
					{#each answers as a (a.value)}
						<button
							class="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-surface-2 px-3 text-[15px] font-semibold {a
								.label.length > 12
								? 'col-span-full'
								: ''}"
							onclick={() => draftAnswer(a.value)}
						>
							{#if toneColour(a)}<span
									class="size-3.5 shrink-0 rounded-full"
									style:background={toneColour(a)}
								></span>{/if}
							{a.label}
						</button>
					{/each}
				</div>
			{/if}
			{#if q.type.input}
				<form
					class="mt-3 flex gap-2"
					onsubmit={(e) => {
						e.preventDefault();
						if (typed.trim()) draftAnswer(typed.trim());
					}}
				>
					<input
						class="min-h-12 min-w-0 flex-1 rounded-2xl border border-line bg-surface-2 px-4 text-[15px] focus:border-accent focus:outline-hidden"
						inputmode={q.type.input === 'number' ? 'numeric' : 'text'}
						placeholder={q.type.answers ? t.questions.anotherNumber : t.questions.typeItHere}
						bind:value={typed}
					/>
					<button
						class="min-h-12 rounded-2xl bg-accent px-5 text-[15px] font-semibold text-accent-ink disabled:opacity-40"
						disabled={!typed.trim()}
					>
						{t.questions.ok}
					</button>
				</form>
			{/if}
			<button
				class="mt-3 min-h-11 w-full rounded-2xl text-sm font-medium text-ink-soft"
				onclick={skip}
			>
				{t.questions.skip}
			</button>
		</div>
	{:else if loadState === 'ready'}
		<p class="mt-4 rounded-2xl bg-good/10 p-4 text-sm text-good">
			{t.questions.allAnswered}
		</p>
	{/if}

	<a
		href={resolve(`/contribute/webcam?resort=${resortId}`)}
		class="mt-3 flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-line text-sm font-semibold"
	>
		<Icon name="camera" size={17} />
		{t.questions.addWebcam}
	</a>

	{#if user && server}
		<p class="mt-3 text-[11px] leading-snug text-ink-soft">
			{t.questions.savingToServer(server.replace(/^https:\/\//, ''), server.includes('dev.'))}
		</p>
	{/if}
</Sheet>

{#if isReviewOpen}
	<div
		class="pointer-events-auto fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs"
	>
		<div
			class="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border border-line bg-surface shadow-2xl"
			role="dialog"
			aria-modal="true"
			aria-label={t.questions.review.ariaLabel}
		>
			<div class="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
				<div class="min-w-0">
					<h2 class="text-base font-bold text-ink">{t.questions.review.title}</h2>
					<p class="truncate text-xs text-ink-soft">
						{t.questions.review.answersTogether(drafts.length)}
					</p>
				</div>
				<button
					type="button"
					class="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-soft"
					onclick={() => {
						isReviewOpen = false;
						persistDraftState();
					}}
					aria-label={t.questions.review.close}
				>
					✕
				</button>
			</div>

			<div class="no-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
				{#if uploadError}
					<div class="rounded-2xl bg-bad/15 p-3 text-xs text-bad" role="alert">
						<p class="font-semibold">{t.questions.review.notSaved}</p>
						<p class="mt-0.5">{uploadError}</p>
					</div>
				{/if}

				<div>
					<h3 class="mb-2 text-xs font-bold tracking-wider text-ink-soft uppercase">
						{t.questions.review.tagsToAdd}
					</h3>
					<div class="divide-y divide-line overflow-hidden rounded-2xl border border-line">
						{#each drafts as d, idx (idx)}
							{@const way = d.quest.ways[0]}
							{@const targetKey =
								d.quest.kind === 'piste'
									? pisteKeyFor(d.quest.type.key, way?.tags ?? {})
									: d.quest.type.key}
							<div class="flex items-center justify-between gap-2 px-3 py-2.5 text-xs">
								<div class="min-w-0 flex-1">
									<p class="truncate font-semibold text-ink">{d.quest.name}</p>
									<p class="font-mono text-[11px] text-ink-soft">
										{targetKey} → <span class="font-semibold text-good">"{d.value}"</span>
										<span class="text-[10px] text-ink-soft">
											· {d.quest.ways.length > 1
												? t.questions.review.waysCount(d.quest.ways.length)
												: t.questions.review.wayRef(way?.id ?? 0)}
										</span>
									</p>
								</div>
								<button
									type="button"
									class="grid size-8 place-items-center text-ink-soft hover:text-bad"
									onclick={() => removeDraft(idx)}
									aria-label={t.questions.review.removeAnswer}
								>
									✕
								</button>
							</div>
						{/each}
					</div>
				</div>

				<div class="space-y-2">
					<label class="block text-xs font-medium text-ink" for="survey-comment">
						{t.questions.review.comment}
					</label>
					<input
						id="survey-comment"
						type="text"
						class="min-h-11 w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-hidden"
						bind:value={changesetComment}
						oninput={persistDraftState}
					/>
					<label class="block text-xs font-medium text-ink" for="survey-source">
						{t.questions.review.source}
					</label>
					<input
						id="survey-source"
						type="text"
						class="min-h-11 w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-hidden"
						bind:value={changesetSource}
						oninput={persistDraftState}
					/>
					<p class="text-[11px] text-ink-soft">{t.questions.review.surveyHint}</p>
				</div>

				<div class="rounded-2xl border border-line bg-surface-2 p-3.5 text-xs text-ink-soft">
					<p>
						{t.questions.review.surveyExplanation}
					</p>
				</div>
			</div>

			<div class="space-y-2 border-t border-line bg-surface-2 p-4">
				{#if user}
					<button
						type="button"
						class="min-h-12 w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-accent-ink disabled:opacity-40"
						disabled={!drafts.length || isUploading || !readiness.canWrite}
						onclick={uploadSurvey}
					>
						{isUploading ? t.questions.review.saving : t.questions.review.saveToOsm}
					</button>
					{#if !readiness.canWrite}
						<p class="text-center text-xs text-warn">
							{readiness.reason ?? t.questions.review.savingUnavailable}
						</p>
					{/if}
				{:else}
					<button
						type="button"
						class="min-h-12 w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-accent-ink"
						onclick={signIn}
					>
						{t.questions.review.signInToSave}
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}
