<script lang="ts" module>
	let pocketNoticeShown = false;
</script>

<script lang="ts">
	import { clock, km, kmh } from '#lib/format.ts';
	import { parseTrackFile, toGpx } from '#lib/gpx.ts';
	import { formatDate, formatNumber, t, unitSymbol } from '#lib/i18n/index.ts';
	import { app } from '#lib/state/app.svelte.ts';
	import { location } from '#lib/state/location.svelte.ts';
	import { progress } from '#lib/state/progress.svelte.ts';
	import { tracking } from '#lib/state/tracking.svelte.ts';
	import { loadPoints, type Session } from '#lib/storage.ts';
	import Icon from '#lib/ui/Icon.svelte';
	import Sheet from '#lib/ui/Sheet.svelte';

	const MIN_POINTS_INSIDE_RESORT_RATIO = 0.3;
	const MIN_TRACK_POINTS_COUNT = 10;
	const REVOKE_BLOB_URL_DELAY_MS = 5000;

	let notice = $state<{ text: string; bad?: boolean } | null>(null);
	let fileInput = $state<HTMLInputElement>();
	let confirmDelete = $state<string | null>(null);
	let now = $state(Date.now());
	let pocketNotice = $state<'why' | 'stores' | null>(null);

	const SPONSOR_URL = 'https://github.com/sponsors/eamag';
	const CONTACT_URL = 'https://eamag.me';

	$effect(() => {
		if (!tracking.recording) return;
		const timer = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(timer);
	});

	function askStart() {
		if (pocketNoticeShown) return void start();
		pocketNoticeShown = true;
		pocketNotice = 'why';
	}

	async function start(resume = false) {
		pocketNotice = null;
		notice = null;
		await tracking.start(resume);
		app.follow = true;
	}

	async function stop() {
		const kept = await tracking.stop();
		notice = kept ? { text: t.track.notice.saved } : { text: t.track.notice.tooShort, bad: true };
	}

	async function importFiles(files: FileList | null) {
		const resort = app.resort;
		if (!files?.length || !resort) return;
		let added = 0;
		let elsewhere = 0;
		let failed = 0;
		const before = progress.covered.size;
		for (const file of files) {
			try {
				for (const track of parseTrackFile(await file.text())) {
					const points = track.points.filter((p) => p.t > 0);
					if (points.length < MIN_TRACK_POINTS_COUNT) continue;
					const inside = points.filter((p) => resort.contains(p.lon, p.lat)).length;
					if (inside < points.length * MIN_POINTS_INSIDE_RESORT_RATIO) {
						elsewhere++;
						continue;
					}
					const name = track.name?.trim() || file.name.replace(/\.[^.]+$/, '');
					if (await progress.addSession(name, 'import', points)) added++;
				}
			} catch {
				failed++;
			}
		}
		if (fileInput) fileInput.value = '';
		const gained = progress.covered.size - before;
		if (added)
			notice = {
				text: t.track.notice.imported(added, gained)
			};
		else if (elsewhere) notice = { text: t.track.notice.notInResort(resort.data.name), bad: true };
		else
			notice = {
				text: failed ? t.track.notice.couldNotRead : t.track.notice.noTrackFound,
				bad: true
			};
	}

	async function exportGpx(s: Session) {
		const points = await loadPoints(s.id);
		if (!points.length)
			return void (notice = {
				text: t.track.notice.pointsNoLongerStored,
				bad: true
			});
		const gpx = toGpx(`${app.resort?.data.name ?? 'Ski'} ${s.name}`, points, {
			creator: 'openski.org'
		});
		const stamp = new Date(s.start).toISOString().slice(0, 10);
		const file = new File([gpx], `openski-${stamp}.gpx`, { type: 'application/gpx+xml' });
		const canShareFile = navigator.canShare?.({ files: [file] });
		if (canShareFile) {
			try {
				await navigator.share({ files: [file], title: file.name });
				return;
			} catch (err) {
				if ((err as Error).name === 'AbortError') return;
			}
		}
		const url = URL.createObjectURL(file);
		const a = document.createElement('a');
		a.href = url;
		a.download = file.name;
		a.click();
		setTimeout(() => URL.revokeObjectURL(url), REVOKE_BLOB_URL_DELAY_MS);
	}

	const stats = $derived(tracking.stats);
	const elapsed = $derived(tracking.recording ? (now - tracking.startedAt) / 1000 : 0);
	const date = (t: number) => formatDate(t, { weekday: 'short', day: 'numeric', month: 'short' });
</script>

<Sheet tall={!tracking.recording}>
	{#if tracking.recording}
		<div class="flex items-center justify-between">
			<p class="flex items-center gap-2 text-sm font-medium">
				<span class="size-2.5 animate-pulse rounded-full bg-bad"></span>
				{tracking.activity === 'lift'
					? t.track.activity.lift
					: tracking.activity === 'ride'
						? t.track.activity.ride
						: t.track.activity.recording}
				{#if tracking.on}<span class="text-ink-soft">· {tracking.on}</span>{/if}
			</p>
			<p class="tabular text-sm text-ink-soft">{clock(elapsed)}</p>
		</div>
		<div class="mt-2 flex items-end gap-2">
			<p class="tabular text-6xl leading-none font-semibold">{kmh(tracking.speed)}</p>
			<p class="pb-1 text-sm text-ink-soft">{unitSymbol('kilometer-per-hour')}</p>
		</div>
		<dl class="mt-4 grid grid-cols-4 gap-2 text-center">
			{#each [[t.track.stats.max, `${kmh(stats.maxSpeed)}`, unitSymbol('kilometer-per-hour')], [t.track.stats.distance, km(stats.distance), unitSymbol('kilometer')], [t.track.stats.vertical, formatNumber(Math.round(stats.descent)), unitSymbol('meter')], [t.track.stats.runs, formatNumber(stats.runs), t.track.liftsCount(stats.liftRides)]] as [label, value, unit] (label)}
				<div class="rounded-2xl bg-surface-2 py-2">
					<dt class="text-[11px] text-ink-soft">{label}</dt>
					<dd class="tabular text-lg leading-tight font-semibold">{value}</dd>
					<dd class="text-[10px] text-ink-soft">{unit}</dd>
				</div>
			{/each}
		</dl>
		{#if location.status === 'denied'}
			<p class="mt-3 rounded-2xl bg-bad/15 px-3 py-2 text-[13px] text-bad">
				{t.track.locationBlocked}
			</p>
		{:else if tracking.wakeLockFailed}
			<p class="mt-3 rounded-2xl bg-warn/15 px-3 py-2 text-[13px] text-warn">
				{t.track.wakeLockFailed}
			</p>
		{/if}
		<button
			class="mt-4 flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-ink py-3.5 font-semibold text-surface"
			onclick={stop}
		>
			<Icon name="stop" size={18} />
			{t.track.stopAndSave}
		</button>
	{:else}
		{#if tracking.recoverable}
			<div class="mb-3 rounded-2xl bg-warn/15 p-3">
				<p class="text-sm font-medium">
					{t.track.unfinishedRecording(date(tracking.recoverable.start))}
				</p>
				<p class="text-xs text-ink-soft">{t.track.pointsKept(tracking.recoverable.points)}</p>
				<div class="mt-2 flex gap-2">
					<button
						class="h-9 flex-1 rounded-xl bg-ink text-sm font-medium text-surface"
						onclick={() => start(true)}
					>
						{t.track.resume}
					</button>
					<button
						class="h-9 flex-1 rounded-xl bg-surface text-sm font-medium"
						onclick={() => tracking.saveDraftAsSession()}
					>
						{t.common.save}
					</button>
					<button
						class="h-9 flex-1 rounded-xl bg-surface text-sm font-medium text-bad"
						onclick={() => tracking.discardDraft()}
					>
						{t.track.discard}
					</button>
				</div>
			</div>
		{/if}
		{#if pocketNotice}
			<div class="mb-3 rounded-2xl bg-surface-2 p-4" role="dialog" aria-labelledby="app-notice">
				{#if pocketNotice === 'why'}
					<p id="app-notice" class="text-[15px] font-semibold">
						{t.track.pocket.whyTitle}
					</p>
					<p class="mt-1 text-sm leading-relaxed text-ink-soft">
						{t.track.pocket.whyBody}
					</p>
					<div class="mt-3 flex flex-col gap-2">
						<button
							class="h-11 rounded-xl bg-accent text-sm font-semibold text-accent-ink"
							onclick={() => (pocketNotice = 'stores')}
						>
							{t.track.pocket.getPhoneApp}
						</button>
						<button class="h-11 rounded-xl bg-surface text-sm font-medium" onclick={() => start()}>
							{t.track.pocket.recordScreenOn}
						</button>
					</div>
				{:else}
					<p id="app-notice" class="text-[15px] font-semibold">
						{t.track.pocket.storesTitle}
					</p>
					<p class="mt-1 text-sm leading-relaxed text-ink-soft">
						{t.track.pocket.storesBody}
					</p>
					<div class="mt-3 flex flex-col gap-2">
						<a
							href={SPONSOR_URL}
							target="_blank"
							rel="external noopener"
							class="flex h-11 items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-accent-ink"
						>
							<Icon name="heart" size={17} />
							{t.track.pocket.sponsorGithub}
						</a>
						<a
							href={CONTACT_URL}
							target="_blank"
							rel="external noopener"
							class="flex h-11 items-center justify-center gap-2 rounded-xl bg-surface text-sm font-medium"
						>
							<Icon name="external" size={16} />
							{t.track.pocket.writeMe}
						</a>
						<button
							class="h-11 rounded-xl text-sm font-medium text-ink-soft"
							onclick={() => start()}
						>
							{t.track.pocket.recordScreenOn}
						</button>
					</div>
				{/if}
			</div>
		{/if}
		<div class="flex gap-2">
			<button
				class="flex h-13 flex-1 items-center justify-center gap-2 rounded-2xl bg-accent py-3.5 font-semibold text-accent-ink"
				onclick={askStart}
			>
				<Icon name="record" size={19} />
				{t.track.startRecording}
			</button>
			<button
				class="flex items-center gap-2 rounded-2xl bg-surface-2 px-4 font-medium"
				onclick={() => fileInput?.click()}
			>
				<Icon name="upload" size={18} />
				{t.track.import}
			</button>
			<input
				bind:this={fileInput}
				type="file"
				accept=".gpx,.tcx,application/gpx+xml,text/xml,application/xml"
				multiple
				class="hidden"
				onchange={(e) => importFiles(e.currentTarget.files)}
			/>
		</div>
		<p class="mt-2 text-xs leading-relaxed text-ink-soft">
			{t.track.screenNotice}
		</p>
		{#if notice}
			<p
				class="mt-3 rounded-2xl px-3 py-2 text-[13px] {notice.bad
					? 'bg-bad/15 text-bad'
					: 'bg-good/15 text-good'}"
				role="status"
			>
				{notice.text}
			</p>
		{/if}

		<h2 class="mt-5 mb-1 text-xs font-semibold tracking-wide text-ink-soft uppercase">
			{t.track.sessions}
		</h2>
		{#if !progress.here.length}
			<p class="py-3 text-sm text-ink-soft">{t.track.emptySessions}</p>
		{/if}
		<ul>
			{#each progress.here as s (s.id)}
				<li class="border-t border-line py-3 first:border-t-0">
					<div class="flex items-center gap-2">
						<div class="min-w-0 flex-1">
							<p class="truncate text-[15px] font-medium">{s.name}</p>
							<p class="text-xs text-ink-soft">
								{date(s.start)} · {s.source === 'import'
									? t.track.source.import
									: t.track.source.live}
								{#if s.stats.avgHr}· <span class="inline-flex items-center gap-0.5">
										{formatNumber(s.stats.avgHr)}
										{t.track.bpm}
									</span>{/if}
							</p>
						</div>
						<button
							class="grid size-9 place-items-center rounded-full bg-surface-2"
							onclick={() => exportGpx(s)}
							aria-label={t.track.exportGpx}
						>
							<Icon name="download" size={17} />
						</button>
						{#if confirmDelete === s.id}
							<button
								class="h-9 rounded-full bg-bad px-3 text-sm font-medium text-white"
								onclick={() => progress.removeSession(s.id)}
							>
								{t.common.delete}
							</button>
						{:else}
							<button
								class="grid size-9 place-items-center rounded-full bg-surface-2 text-ink-soft"
								onclick={() => (confirmDelete = s.id)}
								aria-label={t.track.deleteSession}
							>
								<Icon name="trash" size={17} />
							</button>
						{/if}
					</div>
					<p class="tabular mt-1.5 text-[13px] text-ink-soft">
						<b class="font-semibold text-ink">{formatNumber(s.stats.runs)}</b>
						{t.track.runs(s.stats.runs)}
						{t.common.separator}
						<b class="font-semibold text-ink">{km(s.stats.distance)}</b>
						{unitSymbol('kilometer')}
						{t.common.separator}
						<b class="font-semibold text-ink">{formatNumber(Math.round(s.stats.descent))}</b>
						{unitSymbol('meter')}
						{t.track.vertical}
						{t.common.separator}
						{t.track.max}
						<b class="font-semibold text-ink">{formatNumber(kmh(s.stats.maxSpeed))}</b>
						{unitSymbol('kilometer-per-hour')}
					</p>
				</li>
			{/each}
		</ul>
	{/if}
</Sheet>
