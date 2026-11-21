<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { haversine } from '#lib/geo.ts';
	import type { ResortData, Lift } from '#lib/resort/types.ts';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import { asset, resolve } from '$app/paths';
	import type { CameraSource } from '#lib/queues/types.ts';
	import type { Suggestion } from '#lib/queues/suggest.ts';
	import type { ResolvedWebcam } from '#lib/webcams/types.ts';
	import { app } from '#lib/state/app.svelte.ts';
	import { loadCatalog } from '#lib/state/catalog.ts';
	import { formatMeters, formatUnit, t } from '#lib/i18n/index.ts';
	import WebcamMap from './WebcamMap.svelte';

	interface RegionItem {
		lift: string | null;
		label: string;
		box: [number, number, number, number];
		upscale: number;
	}

	interface ResortCatalogItem {
		id: string;
		name: string;
	}

	interface SavedWebcam {
		id: string;
		pageUrl: string;
		provider: string;
		name: string;
		lat: number;
		lon: number;
		elevation: number | null;
		direction: number | null;
		fov: number | null;
		source: CameraSource;
		mine: boolean;
		regions: {
			id: string;
			liftOsm: string | null;
			liftName: string | null;
			label: string;
			box: [number, number, number, number];
			upscale: number;
			status: 'suggested' | 'confirmed' | 'rejected';
		}[];
	}

	let me = $state<{ id: string; name: string; image: string | null } | null>(null);
	let accountState = $state<'loading' | 'ready' | 'off'>('loading');
	let saved = $state<SavedWebcam[]>([]);
	let savedError = $state<string | null>(null);
	let loadingSaved = $state(false);
	let editingId = $state<string | null>(null);
	let saving = $state(false);
	let saveMessage = $state<{ ok: boolean; text: string } | null>(null);
	let publishing = $state<string | null>(null);
	let publishMessage = $state<{ ok: boolean; text: string } | null>(null);
	let savedRequest = 0;

	let selectedResortId = $state(page.url.searchParams.get('resort') || app.lastResort);
	let resort = $state<ResortData | null>(null);
	let catalog = $state<ResortCatalogItem[]>([]);

	let inputUrl = $state(page.url.searchParams.get('url') ?? '');
	let resolving = $state(false);
	let resolveError = $state<string | null>(null);
	let resolved = $state<ResolvedWebcam | null>(null);

	let cameraName = $state('');
	let cameraLat = $state(0);
	let cameraLon = $state(0);
	let cameraElevation = $state<number | null>(null);
	let viewingDirection = $state(0);
	let is360 = $state(false);

	let panomaxResolution = $state('h2800');
	let panomaxCols = $state(13);
	let panomaxRows = $state(2);
	let panomaxTileW = $state(1341);
	let panomaxTileH = $state(1400);
	let panomaxCompW = $state(16095);
	let panomaxCompH = $state(2800);

	let regions = $state<RegionItem[]>([]);
	let activeRegionIndex = $state<number | null>(null);

	let isDrawing = $state(false);
	let drawStart = $state<[number, number] | null>(null);
	let drawCurrent = $state<[number, number] | null>(null);

	async function loadResort(resortId: string) {
		try {
			const res = await fetch(`/data/${resortId}.json`);
			if (res.ok) {
				resort = await res.json();
			} else {
				console.error(`Failed to load resort ${resortId}: HTTP ${res.status}`);
			}
		} catch (err) {
			console.error(`Error loading resort ${resortId}:`, err);
		}
		await loadSaved(resortId);
	}

	async function loadMe() {
		try {
			const res = await fetch('/api/me');
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			me = ((await res.json()) as { user: typeof me }).user;
			accountState = 'ready';
		} catch {
			me = null;
			accountState = 'off';
		}
	}

	async function loadSaved(resortId: string) {
		const request = ++savedRequest;
		loadingSaved = true;
		savedError = null;
		try {
			const res = await fetch(`/api/contrib/webcams?resort=${encodeURIComponent(resortId)}`);
			const data = (await res.json().catch(() => ({}))) as {
				webcams?: SavedWebcam[];
				message?: string;
			};
			if (request !== savedRequest) return;
			if (!res.ok) throw new Error(data.message || t.contribute.errorStatus(res.status));
			saved = data.webcams ?? [];
		} catch (err) {
			if (request !== savedRequest) return;
			saved = [];
			savedError = err instanceof Error ? err.message : String(err);
		} finally {
			if (request === savedRequest) loadingSaved = false;
		}
	}

	async function resolveUrl(urlToResolve: string): Promise<boolean> {
		resolving = true;
		resolveError = null;

		try {
			const endpoint = `/api/webcam-resolve?url=${encodeURIComponent(urlToResolve.trim())}`;
			const res = await fetch(endpoint);
			const data = (await res.json()) as { message?: string } & Partial<ResolvedWebcam>;

			if (!res.ok) {
				resolveError = data.message || t.contribute.url.pageDidNotAnswer(res.status);
				return false;
			}

			resolved = data as ResolvedWebcam;

			cameraName = resolved.name || '';
			if (resolved.position) {
				cameraLat = resolved.position.lat;
				cameraLon = resolved.position.lon;
			} else if (resort) {
				cameraLat = resort.center[1];
				cameraLon = resort.center[0];
			}
			cameraElevation = resolved.elevation;
			viewingDirection = resolved.viewingDirection ?? 0;
			is360 =
				resolved.panorama && (resolved.fieldOfView === 360 || resolved.viewingDirection == null);

			if (resolved.provider === 'panomax' && resolved.tileLayout) {
				panomaxCols = resolved.tileLayout.cols;
				panomaxRows = resolved.tileLayout.rows;
				panomaxTileW = resolved.tileLayout.tileWidth;
				panomaxTileH = resolved.tileLayout.tileHeight;
				panomaxCompW = resolved.tileLayout.compositeWidth;
				panomaxCompH = resolved.tileLayout.compositeHeight;
				panomaxResolution = 'full';
			}

			regions = [];
			activeRegionIndex = null;
			editingId = null;
			saveMessage = null;
			return true;
		} catch (err) {
			resolveError = err instanceof Error ? err.message : String(err);
			return false;
		} finally {
			resolving = false;
		}
	}

	function getLiftDistance(lift: Lift): number {
		if (!cameraLat || !cameraLon || !lift.coords.length) return Infinity;
		let minDist = Infinity;
		for (const point of lift.coords) {
			const distance = haversine([cameraLon, cameraLat], point);
			if (distance < minDist) minDist = distance;
		}
		return minDist;
	}

	const sortedLifts = $derived(() => {
		if (!resort?.lifts) return [];
		return [...resort.lifts]
			.map((lift) => ({ lift, dist: getLiftDistance(lift) }))
			.sort((a, b) => a.dist - b.dist);
	});

	const displayImageUrl = $derived(() => {
		if (!resolved?.imageUrl) return '';
		if (resolved.cors === 'none') {
			return `/api/webcam-resolve/picture?url=${encodeURIComponent(resolved.imageUrl)}`;
		}
		return resolved.imageUrl;
	});

	const DEFAULT_STAGE_HEIGHT_PX = 300;
	const DEFAULT_FALLBACK_IMAGE_WIDTH = 1000;
	const DEFAULT_FALLBACK_IMAGE_HEIGHT = 600;
	const HIT_HANDLE_PADDING_PX = 12;

	let drawMode = $state(true);
	let stageH = $state(DEFAULT_STAGE_HEIGHT_PX);
	let imgNatural = $state<[number, number] | null>(null);
	let stage = $state<HTMLDivElement | null>(null);
	let viewport = $state<HTMLDivElement | null>(null);
	let drawPointer: number | null = null;
	let panPointer: number | null = null;
	let panStartX = 0;
	let panStartScroll = 0;
	let editAction: 'move' | 'resize' | null = null;
	let editIndex = -1;
	let editCorner = '';
	let editStartRel: [number, number] | null = null;
	let editStartBox: [number, number, number, number] | null = null;

	const base = $derived.by((): [number, number] => {
		if (resolved?.provider === 'panomax') return [panomaxCompW, panomaxCompH];
		return [
			resolved?.width || imgNatural?.[0] || DEFAULT_FALLBACK_IMAGE_WIDTH,
			resolved?.height || imgNatural?.[1] || DEFAULT_FALLBACK_IMAGE_HEIGHT
		];
	});
	const stageW = $derived(Math.round((stageH * base[0]) / base[1]));

	function pointAt(e: PointerEvent): [number, number] {
		const rect = stage!.getBoundingClientRect();
		return [
			Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
			Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
		];
	}

	function hitRegion(rel: [number, number]): { idx: number; corner: string } | null {
		const [bw, bh] = base;
		const padX = HIT_HANDLE_PADDING_PX / stageW;
		const padY = HIT_HANDLE_PADDING_PX / stageH;
		for (let i = regions.length - 1; i >= 0; i--) {
			const box = regions[i].box;
			const x0 = box[0] / bw;
			const y0 = box[1] / bh;
			const x1 = box[2] / bw;
			const y1 = box[3] / bh;
			if (rel[0] < x0 - padX || rel[0] > x1 + padX || rel[1] < y0 - padY || rel[1] > y1 + padY)
				continue;
			const isNearLeft = Math.abs(rel[0] - x0) <= padX;
			const isNearRight = Math.abs(rel[0] - x1) <= padX;
			const isNearTop = Math.abs(rel[1] - y0) <= padY;
			const isNearBottom = Math.abs(rel[1] - y1) <= padY;
			let corner = '';
			if (isNearTop && isNearLeft) corner = 'nw';
			else if (isNearTop && isNearRight) corner = 'ne';
			else if (isNearBottom && isNearLeft) corner = 'sw';
			else if (isNearBottom && isNearRight) corner = 'se';
			return { idx: i, corner };
		}
		return null;
	}

	function handlePointerDown(e: PointerEvent) {
		if (!stage || (e.pointerType === 'mouse' && e.button !== 0)) return;
		e.preventDefault();
		stage.setPointerCapture(e.pointerId);
		if (!drawMode) {
			if (e.pointerType !== 'mouse') return;
			panPointer = e.pointerId;
			panStartX = e.clientX;
			panStartScroll = viewport?.scrollLeft ?? 0;
			return;
		}
		drawPointer = e.pointerId;
		const rel = pointAt(e);
		const hit = hitRegion(rel);
		if (hit) {
			editAction = hit.corner ? 'resize' : 'move';
			editIndex = hit.idx;
			editCorner = hit.corner;
			activeRegionIndex = hit.idx;
			editStartRel = rel;
			editStartBox = [...regions[hit.idx].box] as [number, number, number, number];
			return;
		}
		isDrawing = true;
		drawStart = rel;
		drawCurrent = rel;
	}

	function handlePointerMove(e: PointerEvent) {
		if (panPointer === e.pointerId) {
			if (viewport) viewport.scrollLeft = panStartScroll - (e.clientX - panStartX);
			return;
		}
		if (e.pointerId !== drawPointer) return;
		if (editAction) {
			if (!editStartRel || !editStartBox || editIndex < 0) return;
			const rel = pointAt(e);
			const [bw, bh] = base;
			const dx = (rel[0] - editStartRel[0]) * bw;
			const dy = (rel[1] - editStartRel[1]) * bh;
			const [x0, y0, x1, y1] = editStartBox;
			let nx0 = x0;
			let ny0 = y0;
			let nx1 = x1;
			let ny1 = y1;
			if (editAction === 'move') {
				nx0 += dx;
				nx1 += dx;
				ny0 += dy;
				ny1 += dy;
			} else {
				if (editCorner.includes('w')) nx0 += dx;
				if (editCorner.includes('e')) nx1 += dx;
				if (editCorner.includes('n')) ny0 += dy;
				if (editCorner.includes('s')) ny1 += dy;
			}
			const min = 4;
			regions[editIndex].box = [
				Math.max(0, Math.min(bw - min, Math.round(Math.min(nx0, nx1 - min)))),
				Math.max(0, Math.min(bh - min, Math.round(Math.min(ny0, ny1 - min)))),
				Math.min(bw, Math.max(min, Math.round(Math.max(nx0 + min, nx1)))),
				Math.min(bh, Math.max(min, Math.round(Math.max(ny0 + min, ny1))))
			];
			return;
		}
		if (!isDrawing) return;
		drawCurrent = pointAt(e);
	}

	function handlePointerCancel() {
		drawPointer = null;
		panPointer = null;
		editAction = null;
		editStartRel = null;
		editStartBox = null;
		isDrawing = false;
		drawStart = null;
		drawCurrent = null;
	}

	function handlePointerUp(e: PointerEvent) {
		if (panPointer === e.pointerId) {
			panPointer = null;
			return;
		}
		if (e.pointerId !== drawPointer) return;
		drawPointer = null;
		if (editAction) {
			editAction = null;
			editStartRel = null;
			editStartBox = null;
			return;
		}
		if (!isDrawing || !drawStart || !drawCurrent) {
			isDrawing = false;
			return;
		}
		isDrawing = false;

		const x0Rel = Math.min(drawStart[0], drawCurrent[0]);
		const x1Rel = Math.max(drawStart[0], drawCurrent[0]);
		const y0Rel = Math.min(drawStart[1], drawCurrent[1]);
		const y1Rel = Math.max(drawStart[1], drawCurrent[1]);

		if (x1Rel - x0Rel < 0.01 || y1Rel - y0Rel < 0.01) {
			drawStart = null;
			drawCurrent = null;
			return;
		}

		const [baseW, baseH] = base;
		const x0 = Math.round(x0Rel * baseW);
		const y0 = Math.round(y0Rel * baseH);
		const x1 = Math.round(x1Rel * baseW);
		const y1 = Math.round(y1Rel * baseH);

		addRegion([x0, y0, x1, y1], 2);
		drawStart = null;
		drawCurrent = null;
	}

	function addBoxManually() {
		let baseW = resolved?.width || 1000;
		let baseH = resolved?.height || 600;
		if (resolved?.provider === 'panomax') {
			baseW = panomaxCompW;
			baseH = panomaxCompH;
		}

		addRegion(
			[
				Math.round(baseW * 0.45),
				Math.round(baseH * 0.45),
				Math.round(baseW * 0.55),
				Math.round(baseH * 0.55)
			],
			2
		);
	}

	function addRegion(box: RegionItem['box'], upscale: number) {
		const nearest = sortedLifts()[0]?.lift ?? null;
		regions = [
			...regions,
			{
				lift: nearest?.name ?? null,
				label: nearest ? t.contribute.boxes.defaultLabelWithLift : t.contribute.boxes.defaultLabel,
				box,
				upscale
			}
		];
		activeRegionIndex = regions.length - 1;
	}

	function removeRegion(idx: number) {
		regions = regions.filter((_, i) => i !== idx);
		if (activeRegionIndex === idx) activeRegionIndex = null;
		else if (activeRegionIndex != null && activeRegionIndex > idx) activeRegionIndex--;
	}

	let suggestions = $state<Suggestion[]>([]);
	let suggesting = $state<string | null>(null);
	let suggestError = $state<string | null>(null);
	let suggestAbort: AbortController | null = null;

	function currentSource(): CameraSource | null {
		if (!resolved) return null;
		if (resolved.provider === 'panomax') {
			return {
				kind: 'panomax',
				panomaxId: parseInt(resolved.cameraId, 10),
				resolution: panomaxResolution,
				tile: { width: panomaxTileW, height: panomaxTileH, rows: panomaxRows, cols: panomaxCols },
				composite: { width: panomaxCompW, height: panomaxCompH }
			};
		}
		const url = displayImageUrl();
		if (!url) return null;
		return { kind: 'still', url, width: base[0], height: base[1], proxy: false, rotates: false };
	}

	async function suggestBoxes() {
		const source = currentSource();
		if (!source || !resort) return;
		suggestAbort?.abort();
		const abort = (suggestAbort = new AbortController());
		suggestError = null;
		suggestions = [];
		suggesting = t.contribute.suggest.loadingDetector;
		let detector: Awaited<ReturnType<typeof import('#lib/queues/detect.ts').loadDetector>> | null =
			null;
		try {
			const [{ loadDetector }, { suggestRegions }] = await Promise.all([
				import('#lib/queues/detect.ts'),
				import('#lib/queues/suggest.ts')
			]);
			detector = await loadDetector(asset('models/yolo11n.onnx' as never));
			const found = await suggestRegions(
				{ id: resort.id, timezone: resort.timezone },
				source,
				detector,
				{
					signal: abort.signal,
					onProgress: (done, total) =>
						(suggesting =
							source.kind === 'panomax'
								? t.contribute.suggest.progressPanomax(done, total)
								: t.contribute.suggest.progressStill)
				}
			);
			if (abort.signal.aborted) return;
			const covered = (b: Suggestion['box']) =>
				regions.some(
					(r) => r.box[0] <= b[0] && r.box[1] <= b[1] && r.box[2] >= b[2] && r.box[3] >= b[3]
				);
			suggestions = found.filter((f) => !covered(f.box));
			if (!suggestions.length)
				suggestError =
					source.kind === 'panomax'
						? t.contribute.suggest.noneFoundPanomax
						: t.contribute.suggest.noneFoundStill;
		} catch (err) {
			if (!abort.signal.aborted) suggestError = err instanceof Error ? err.message : String(err);
		} finally {
			void detector?.release();
			if (suggestAbort === abort) suggesting = null;
		}
	}

	function useSuggestion(i: number) {
		const s = suggestions[i];
		addRegion([...s.box], s.upscale);
		suggestions = suggestions.filter((_, j) => j !== i);
	}

	function osmRef(lift: Lift): string | undefined {
		const way = /^l(\d+)$/.exec(lift.id)?.[1];
		return way ? `way/${way}` : undefined;
	}

	function regionPayload() {
		return regions.map((r) => {
			const lift = r.lift ? sortedLifts().find((i) => i.lift.name === r.lift)?.lift : undefined;
			return {
				liftOsm: lift ? osmRef(lift) : undefined,
				liftName: r.lift ?? undefined,
				label: r.label.trim() || r.lift || 'Queue area',
				box: r.box.map((n) => Math.round(Number(n))),
				upscale: r.upscale
			};
		});
	}

	async function saveWebcam() {
		if (!resolved) return;
		saving = true;
		saveMessage = null;
		const adding = editingId === null;
		try {
			const body = adding
				? {
						resort: selectedResortId,
						pageUrl: inputUrl.trim(),
						name: cameraName,
						lat: cameraLat,
						lon: cameraLon,
						elevation: cameraElevation,
						direction: is360 ? (resolved.viewingDirection ?? null) : viewingDirection,
						fov: is360
							? 360
							: resolved.fieldOfView && resolved.fieldOfView < 360
								? resolved.fieldOfView
								: null,
						regions: regionPayload()
					}
				: { regions: regionPayload() };
			const res = await fetch(
				adding ? '/api/contrib/webcams' : `/api/contrib/webcams/${editingId}`,
				{
					method: adding ? 'POST' : 'PUT',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(body)
				}
			);
			const data = (await res.json().catch(() => ({}))) as { message?: string; id?: string };
			if (!res.ok) {
				saveMessage = { ok: false, text: data.message || t.contribute.save.failed(res.status) };
				return;
			}
			saveMessage = {
				ok: true,
				text: adding ? t.contribute.save.savedAndPublished : t.contribute.save.savedSuggestions
			};
			if (adding && data.id) editingId = data.id;
			await loadSaved(selectedResortId);
		} catch (err) {
			saveMessage = { ok: false, text: err instanceof Error ? err.message : String(err) };
		} finally {
			saving = false;
		}
	}

	async function startEdit(w: SavedWebcam) {
		inputUrl = w.pageUrl;
		if (!(await resolveUrl(w.pageUrl))) return;
		editingId = w.id;
		cameraName = w.name;
		cameraLat = w.lat;
		cameraLon = w.lon;
		cameraElevation = w.elevation;
		viewingDirection = w.direction ?? viewingDirection;
		is360 = w.fov === 360;
		if (w.source.kind === 'panomax') {
			panomaxResolution = w.source.resolution;
			panomaxCols = w.source.tile.cols;
			panomaxRows = w.source.tile.rows;
			panomaxTileW = w.source.tile.width;
			panomaxTileH = w.source.tile.height;
			panomaxCompW = w.source.composite.width;
			panomaxCompH = w.source.composite.height;
		}
		regions = w.regions.map((r) => ({
			lift: r.liftName,
			label: r.label,
			box: [...r.box],
			upscale: r.upscale
		}));
		activeRegionIndex = regions.length ? 0 : null;
		await tick();
		document.getElementById('editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	function stopEdit() {
		editingId = null;
		saveMessage = null;
		resolved = null;
		regions = [];
		activeRegionIndex = null;
		suggestAbort?.abort();
		suggestions = [];
		suggestError = null;
	}

	async function deleteSaved(w: SavedWebcam) {
		if (!confirm(t.contribute.saved.confirmDelete(w.name))) return;
		const res = await fetch(`/api/contrib/webcams/${w.id}`, { method: 'DELETE' });
		if (!res.ok) {
			const data = (await res.json().catch(() => ({}))) as { message?: string };
			savedError = data.message || t.contribute.errorStatus(res.status);
			return;
		}
		if (editingId === w.id) stopEdit();
		await loadSaved(selectedResortId);
	}

	async function publishWebcam(w: SavedWebcam) {
		publishing = w.id;
		publishMessage = null;
		try {
			const res = await fetch(`/api/contrib/webcams/${w.id}`, { method: 'POST' });
			const data = (await res.json().catch(() => ({}))) as { message?: string };
			if (!res.ok) {
				publishMessage = { ok: false, text: data.message || t.contribute.errorStatus(res.status) };
				return;
			}
			publishMessage = { ok: true, text: t.contribute.saved.publishSuccess(w.name) };
			await loadSaved(selectedResortId);
		} catch (err) {
			publishMessage = { ok: false, text: err instanceof Error ? err.message : String(err) };
		} finally {
			publishing = null;
		}
	}

	let resortQuery = $state('');
	let resortSearchOpen = $state(false);
	const resortMatches = $derived.by(() => {
		const q = resortQuery.trim().toLowerCase();
		if (!q) return [];
		return catalog.filter((r) => r.name.toLowerCase().includes(q) || r.id.includes(q)).slice(0, 8);
	});
	const resortName = $derived(
		catalog.find((r) => r.id === selectedResortId)?.name ?? selectedResortId
	);

	function chooseResort(id: string) {
		selectedResortId = id;
		resortQuery = '';
		resortSearchOpen = false;
		void loadResort(id);
		const query = new SvelteURLSearchParams(page.url.search);
		query.set('resort', id);
		void goto(resolve(`/contribute/webcam?${query}${page.url.hash}`), {
			replace: true,
			reset: false
		});
	}

	onMount(async () => {
		loadMe();
		catalog = ((await loadCatalog()) ?? []).map(({ id, name }) => ({ id, name }));

		selectedResortId = page.url.searchParams.get('resort') || app.lastResort;
		await loadResort(selectedResortId);

		const linkedWebcamUrl = page.url.searchParams.get('url');
		if (linkedWebcamUrl) {
			inputUrl = linkedWebcamUrl;
			resolveUrl(linkedWebcamUrl);
		}
	});
</script>

<svelte:head>
	<title>{t.contribute.pageTitle}</title>
</svelte:head>

<div
	class="wc fixed inset-0 overflow-x-hidden overflow-y-auto overscroll-contain bg-surface pb-24 font-sans text-ink"
>
	<header class="border-b border-line bg-surface px-4 py-3">
		<div class="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
			<div class="flex min-w-0 items-center gap-2">
				<a
					href={resolve('/(app)/[resort]', { resort: selectedResortId })}
					class="flex h-10 items-center text-sm font-medium text-ink-soft hover:text-ink"
				>
					{t.contribute.backToMap}
				</a>
				<span class="text-line">/</span>
				<h1 class="truncate text-base font-semibold text-ink">{t.contribute.title}</h1>
			</div>

			<div class="relative w-full sm:w-72">
				<label for="resort-search" class="sr-only">{t.contribute.resortSearchLabel}</label>
				<input
					id="resort-search"
					type="search"
					autocomplete="off"
					bind:value={resortQuery}
					onfocus={() => (resortSearchOpen = true)}
					onblur={() => setTimeout(() => (resortSearchOpen = false), 150)}
					placeholder={t.contribute.resortPlaceholder(resortName)}
					class="w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-ink placeholder:text-ink focus:ring-1 focus:ring-accent focus:outline-none"
				/>
				{#if resortSearchOpen && resortMatches.length}
					<ul
						class="absolute inset-x-0 top-full z-40 mt-1 overflow-hidden rounded-xl border border-line bg-surface shadow-lg"
					>
						{#each resortMatches as r (r.id)}
							<li>
								<button
									type="button"
									class="block w-full truncate px-3 text-left text-sm hover:bg-surface-2"
									onclick={() => chooseResort(r.id)}
								>
									{r.name}
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</div>

			<div class="flex w-full items-center gap-2 text-xs sm:order-last sm:w-auto">
				{#if accountState === 'loading'}
					<span class="text-ink-soft">{t.contribute.account.checking}</span>
				{:else if accountState === 'off'}
					<span class="text-ink-soft">{t.contribute.account.notConfigured}</span>
				{:else if me}
					{#if me.image}
						<img src={me.image} alt="" class="h-6 w-6 rounded-full border border-line" />
					{/if}
					<span class="text-ink-soft">
						{t.contribute.account.signedInAs} <strong class="text-ink">{me.name}</strong>
					</span>
					<form method="POST" action="/logout?next=/contribute/webcam">
						<button
							type="submit"
							class="rounded-lg border border-line bg-surface-2 px-2.5 py-1 font-medium text-ink hover:bg-surface"
						>
							{t.contribute.account.logOut}
						</button>
					</form>
				{:else}
					<span class="text-ink-soft">{t.contribute.account.notSignedIn}</span>
					<a
						href={resolve(`/login?next=${encodeURIComponent(resolve('/contribute/webcam'))}`)}
						class="rounded-lg bg-accent px-2.5 py-1 font-semibold text-accent-ink hover:opacity-90"
					>
						{t.contribute.account.signInWithOsm}
					</a>
				{/if}
			</div>
		</div>
	</header>

	<main class="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
		<section class="space-y-3 rounded-2xl border border-line bg-surface-2/60 p-4 shadow-sm sm:p-5">
			<h2 class="text-sm font-semibold tracking-wider text-ink uppercase">
				{t.contribute.saved.title(
					catalog.find((r) => r.id === selectedResortId)?.name ?? selectedResortId
				)}
			</h2>
			{#if savedError}
				<p class="text-xs text-bad">{savedError}</p>
			{:else if loadingSaved && !saved.length}
				<p class="text-xs text-ink-soft">{t.common.loading}</p>
			{:else if !saved.length}
				<p class="text-xs text-ink-soft">{t.contribute.saved.empty}</p>
			{/if}
			<ul class="space-y-2">
				{#each saved as w (w.id)}
					{@const confirmed = w.regions.filter((r) => r.status === 'confirmed').length}
					{@const suggested = w.regions.filter((r) => r.status === 'suggested').length}
					<li
						class="rounded-xl border p-3 {editingId === w.id
							? 'border-accent bg-accent/5'
							: 'border-line bg-surface'} flex flex-wrap items-center justify-between gap-2 text-xs"
					>
						<div class="min-w-0">
							<a
								href={w.pageUrl}
								target="_blank"
								rel="external noreferrer"
								class="font-semibold text-ink hover:underline"
							>
								{w.name}
							</a>
							<span class="text-ink-soft">
								· {w.provider} · {t.contribute.saved.boxesCount(confirmed)}{suggested
									? w.mine
										? t.contribute.saved.suggestedMine(suggested)
										: t.contribute.saved.suggestedReview(suggested)
									: ''}
								{w.mine ? t.contribute.saved.yours : ''}
							</span>
						</div>
						{#if w.mine}
							<div class="flex items-center gap-2">
								{#if suggested}
									<button
										type="button"
										onclick={() => publishWebcam(w)}
										disabled={publishing === w.id}
										class="rounded-lg bg-accent px-2.5 py-1 font-medium text-accent-ink disabled:opacity-50"
									>
										{publishing === w.id
											? t.contribute.saved.publishing
											: t.contribute.saved.publishBoxes}
									</button>
								{/if}
								<button
									type="button"
									onclick={() => startEdit(w)}
									disabled={resolving}
									class="rounded-lg border border-line bg-surface-2 px-2.5 py-1 font-medium text-ink hover:bg-surface disabled:opacity-50"
								>
									{t.contribute.saved.editBoxes}
								</button>
								<button
									type="button"
									onclick={() => deleteSaved(w)}
									class="font-medium text-bad hover:underline"
								>
									{t.common.delete}
								</button>
							</div>
						{:else if suggested}
							<span
								class="rounded-md border border-line bg-surface-2 px-2 py-0.5 text-[11px] text-ink-soft"
							>
								{t.contribute.saved.waitingForReview}
							</span>
						{/if}
					</li>
				{/each}
			</ul>
			{#if publishMessage}
				<p class="text-xs font-medium {publishMessage.ok ? 'text-good' : 'text-bad'}" role="status">
					{publishMessage.text}
				</p>
			{/if}
			<p class="text-[11px] text-ink-soft">
				{t.contribute.saved.reviewHint}
			</p>
		</section>

		<section class="space-y-4 rounded-2xl border border-line bg-surface-2/60 p-4 shadow-sm sm:p-5">
			<div class="flex items-center justify-between gap-2">
				<h2 class="flex items-center gap-2 text-sm font-semibold tracking-wider text-ink uppercase">
					<span
						class="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-ink"
					>
						1
					</span>
					{t.contribute.url.title}
				</h2>
			</div>

			<form
				onsubmit={(e) => {
					e.preventDefault();
					resolveUrl(inputUrl);
				}}
				class="flex flex-col gap-2 sm:flex-row"
			>
				<input
					type="url"
					bind:value={inputUrl}
					placeholder={t.contribute.url.placeholder}
					required
					class="flex-1 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-soft focus:ring-2 focus:ring-accent focus:outline-none"
				/>
				<button
					type="submit"
					disabled={resolving || !inputUrl}
					class="flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink transition hover:opacity-90 active:scale-95 disabled:opacity-50"
				>
					{#if resolving}
						<svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24">
							<circle
								class="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="4"
								fill="none"
							/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
						</svg>
						{t.contribute.url.reading}
					{:else}
						{t.contribute.url.read}
					{/if}
				</button>
			</form>

			{#if resolveError}
				<div class="space-y-1 rounded-xl border border-bad/30 bg-bad/10 p-3.5 text-xs text-bad">
					<p class="flex items-center gap-1.5 font-semibold">
						<svg
							class="h-4 w-4"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line
								x1="12"
								y1="16"
								x2="12.01"
								y2="16"
							/>
						</svg>
						{t.contribute.url.errorTitle}
					</p>
					<p>{resolveError}</p>
				</div>
			{/if}
		</section>

		{#if resolved || regions.length > 0}
			{#if editingId}
				<div
					class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-accent/40 bg-accent/5 p-3.5 text-xs"
				>
					<span class="text-ink">
						{t.contribute.editing.noticeBefore}<strong>{cameraName}</strong>{t.contribute.editing
							.noticeAfter}
					</span>
					<button type="button" onclick={stopEdit} class="font-medium text-accent hover:underline">
						{t.contribute.editing.stopEditing}
					</button>
				</div>
			{:else}
				<section
					class="space-y-4 rounded-2xl border border-line bg-surface-2/60 p-4 shadow-sm sm:p-5"
				>
					<h2
						class="flex items-center gap-2 text-sm font-semibold tracking-wider text-ink uppercase"
					>
						<span
							class="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-ink"
						>
							2
						</span>
						{t.contribute.position.title}
					</h2>

					{#if resolved}
						<div class="grid grid-cols-3 gap-2.5 text-xs">
							<div class="rounded-xl border border-line bg-surface p-2.5">
								<span class="block text-[10px] text-ink-soft uppercase">
									{t.contribute.position.provider}
								</span>
								<span class="font-semibold text-ink capitalize">{resolved.provider}</span>
							</div>
							<div class="rounded-xl border border-line bg-surface p-2.5">
								<span class="block text-[10px] text-ink-soft uppercase">
									{t.contribute.position.picture}
								</span>
								<span class="font-semibold text-ink">
									{t.contribute.position.dimensions(resolved.width, resolved.height)}
								</span>
							</div>
							<div class="rounded-xl border border-line bg-surface p-2.5">
								<span class="block text-[10px] text-ink-soft uppercase">
									{t.contribute.position.elevation}
								</span>
								<span class="font-semibold text-ink">
									{cameraElevation != null ? formatMeters(cameraElevation) : t.common.unknown}
								</span>
							</div>
						</div>
					{/if}

					<div class="text-xs">
						<label for="cam-name" class="mb-1 block font-medium text-ink-soft">
							{t.contribute.position.cameraName}
						</label>
						<input
							id="cam-name"
							type="text"
							bind:value={cameraName}
							maxlength="120"
							class="w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink focus:ring-1 focus:ring-accent focus:outline-none"
						/>
					</div>

					{#if resort}
						<div class="space-y-2">
							<div class="flex items-center justify-between text-xs">
								<span class="font-medium text-ink-soft">
									{t.contribute.position.resortMap(resort.name)}
								</span>
								<span class="font-mono text-ink-soft">
									{t.contribute.position.coords(cameraLat, cameraLon)}
								</span>
							</div>

							<WebcamMap
								{resort}
								bind:lat={cameraLat}
								bind:lon={cameraLon}
								bind:direction={viewingDirection}
								bind:is360
							/>
						</div>
					{/if}

					<div class="space-y-3 rounded-xl border border-line bg-surface p-3.5">
						<div class="flex flex-wrap items-center justify-between gap-3 text-xs">
							<label class="flex cursor-pointer items-center gap-2 font-medium text-ink">
								<input
									type="checkbox"
									bind:checked={is360}
									class="h-4 w-4 rounded border-line text-accent focus:ring-accent"
								/>
								<span>{t.contribute.position.is360}</span>
							</label>
						</div>

						{#if !is360}
							<div class="space-y-2">
								<div class="flex items-center justify-between text-xs">
									<label for="direction-slider" class="font-medium text-ink">
										{t.contribute.position.direction}
									</label>
									<span class="font-semibold text-accent">
										{formatUnit(viewingDirection, 'degree')}
									</span>
								</div>
								<input
									id="direction-slider"
									type="range"
									min="0"
									max="359"
									bind:value={viewingDirection}
									class="w-full accent-violet-600"
								/>
								<div class="flex gap-2">
									{#each [{ l: 'north', a: 0 }, { l: 'east', a: 90 }, { l: 'south', a: 180 }, { l: 'west', a: 270 }] as const as dir (dir.l)}
										<button
											type="button"
											onclick={() => (viewingDirection = dir.a)}
											class="flex-1 rounded border border-line bg-surface-2 py-1 text-xs text-ink hover:bg-surface"
										>
											{t.contribute.position.compassButton(
												t.contribute.position.cardinal[dir.l],
												dir.a
											)}
										</button>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				</section>
			{/if}

			<section
				id="editor"
				class="space-y-4 rounded-2xl border border-line bg-surface-2/60 p-4 shadow-sm sm:p-5"
			>
				<div class="flex flex-wrap items-center justify-between gap-2">
					<h2
						class="flex items-center gap-2 text-sm font-semibold tracking-wider text-ink uppercase"
					>
						<span
							class="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-ink"
						>
							3
						</span>
						{t.contribute.boxes.title}
					</h2>
					<button
						type="button"
						onclick={addBoxManually}
						class="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink shadow-sm transition hover:bg-surface-2"
					>
						{t.contribute.boxes.addBox}
					</button>
				</div>

				<div
					class="flex flex-wrap items-center gap-2"
					role="group"
					aria-label={t.contribute.boxes.pictureTool}
				>
					<button
						type="button"
						class="rounded-xl px-4 text-sm font-semibold {drawMode
							? 'bg-accent text-accent-ink'
							: 'border border-line bg-surface text-ink'}"
						aria-pressed={drawMode}
						onclick={() => (drawMode = true)}
					>
						{t.contribute.boxes.drawBox}
					</button>
					<button
						type="button"
						class="rounded-xl border border-line bg-surface px-4 text-sm font-semibold {!drawMode
							? 'bg-accent text-accent-ink'
							: 'text-ink'}"
						aria-pressed={!drawMode}
						onclick={() => (drawMode = false)}
					>
						{t.contribute.boxes.panPicture}
					</button>
					<button
						type="button"
						class="rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-ink disabled:opacity-50"
						disabled={!!suggesting || !resolved || !resort}
						onclick={suggestBoxes}
					>
						{t.contribute.boxes.suggestBoxes}
					</button>
					<button
						type="button"
						class="w-11 rounded-xl border border-line bg-surface text-lg font-semibold text-ink"
						aria-label={t.contribute.boxes.smallerPicture}
						onclick={() => (stageH = Math.max(200, stageH - 100))}
					>
						−
					</button>
					<button
						type="button"
						class="w-11 rounded-xl border border-line bg-surface text-lg font-semibold text-ink"
						aria-label={t.contribute.boxes.biggerPicture}
						onclick={() => (stageH = Math.min(1200, stageH + 100))}
					>
						+
					</button>
					<p class="basis-full text-xs text-ink-soft">
						{t.contribute.boxes.drawHintBefore}<strong>{t.contribute.boxes.drawHintPan}</strong>{t
							.contribute.boxes.drawHintAfter}
					</p>
				</div>

				<div
					bind:this={viewport}
					data-picture-viewport
					class="pan-viewport w-full overflow-x-auto overscroll-x-contain rounded-xl border border-line bg-black"
					role="region"
					aria-label={t.contribute.boxes.viewportAriaLabel}
				>
					{#if displayImageUrl()}
						<div
							bind:this={stage}
							data-draw-stage
							role="application"
							aria-label={t.contribute.boxes.stageAriaLabel}
							class="draw-stage relative select-none {drawMode ? 'cursor-crosshair' : ''}"
							style:width="{stageW}px"
							style:height="{stageH}px"
							style:touch-action={drawMode ? 'none' : 'pan-x pan-y'}
							onpointerdown={handlePointerDown}
							onpointermove={handlePointerMove}
							onpointerup={handlePointerUp}
							onpointercancel={handlePointerCancel}
						>
							<img
								src={displayImageUrl()}
								alt={cameraName || t.contribute.boxes.defaultAlt}
								draggable="false"
								class="pointer-events-none block h-full w-full"
								onload={(e) => {
									const img = e.currentTarget as HTMLImageElement;
									imgNatural = [img.naturalWidth, img.naturalHeight];
								}}
							/>

							<svg
								class="pointer-events-none absolute inset-0 h-full w-full"
								viewBox="0 0 100 100"
								preserveAspectRatio="none"
							>
								{#each regions as r, idx (idx)}
									{@const baseW =
										resolved?.provider === 'panomax' ? panomaxCompW : resolved?.width || 1000}
									{@const baseH =
										resolved?.provider === 'panomax' ? panomaxCompH : resolved?.height || 600}
									{@const rx0 = (r.box[0] / baseW) * 100}
									{@const ry0 = (r.box[1] / baseH) * 100}
									{@const rw = ((r.box[2] - r.box[0]) / baseW) * 100}
									{@const rh = ((r.box[3] - r.box[1]) / baseH) * 100}
									<rect
										x={rx0}
										y={ry0}
										width={rw}
										height={rh}
										fill={activeRegionIndex === idx
											? 'rgba(124, 58, 237, 0.3)'
											: 'rgba(2, 132, 199, 0.25)'}
										stroke={activeRegionIndex === idx ? '#a78bfa' : '#38bdf8'}
										stroke-width="2"
										vector-effect="non-scaling-stroke"
									/>
									{#if activeRegionIndex === idx}
										{#each [[rx0, ry0], [rx0 + rw, ry0], [rx0, ry0 + rh], [rx0 + rw, ry0 + rh]] as [hx, hy], corner (corner)}
											<rect
												data-handle
												x={hx - (6 / stageW) * 100}
												y={hy - (6 / stageH) * 100}
												width={(12 / stageW) * 100}
												height={(12 / stageH) * 100}
												fill="#ffffff"
												stroke="#7c3aed"
												stroke-width="0.4"
												vector-effect="non-scaling-stroke"
											/>
										{/each}
									{/if}
								{/each}

								{#each suggestions as sug, si (si)}
									<rect
										x={(sug.box[0] / base[0]) * 100}
										y={(sug.box[1] / base[1]) * 100}
										width={((sug.box[2] - sug.box[0]) / base[0]) * 100}
										height={((sug.box[3] - sug.box[1]) / base[1]) * 100}
										fill="rgba(245, 158, 11, 0.18)"
										stroke="#f59e0b"
										stroke-width="2"
										stroke-dasharray="6 4"
										vector-effect="non-scaling-stroke"
									/>
								{/each}

								{#if isDrawing && drawStart && drawCurrent}
									{@const x0 = Math.min(drawStart[0], drawCurrent[0]) * 100}
									{@const y0 = Math.min(drawStart[1], drawCurrent[1]) * 100}
									{@const w = Math.abs(drawCurrent[0] - drawStart[0]) * 100}
									{@const h = Math.abs(drawCurrent[1] - drawStart[1]) * 100}
									<rect
										x={x0}
										y={y0}
										width={w}
										height={h}
										fill="rgba(34, 197, 94, 0.25)"
										stroke="#22c55e"
										stroke-width="2"
										stroke-dasharray="6 4"
										vector-effect="non-scaling-stroke"
									/>
								{/if}
							</svg>
							{#each regions as r, idx (idx)}
								<span
									class="pointer-events-none absolute -translate-y-full truncate rounded bg-black/60 px-1.5 py-0.5 text-xs font-semibold text-white"
									style:left="{(r.box[0] / base[0]) * 100}%"
									style:top="{Math.max(6, (r.box[1] / base[1]) * 100)}%"
									style:max-width="{Math.max(80, ((r.box[2] - r.box[0]) / base[0]) * stageW)}px"
								>
									#{idx + 1}: {r.lift || r.label}
								</span>
							{/each}
							{#each suggestions as sug, si (si)}
								<span
									class="pointer-events-none absolute -translate-y-full rounded bg-warn/90 px-1.5 py-0.5 text-xs font-semibold text-black"
									style:left="{(sug.box[0] / base[0]) * 100}%"
									style:top="{Math.max(6, (sug.box[1] / base[1]) * 100)}%"
								>
									{t.contribute.suggest.badge(si + 1)}
								</span>
							{/each}
						</div>
					{:else}
						<div class="flex h-48 items-center justify-center text-xs text-ink-soft">
							{t.contribute.boxes.noPicture}
						</div>
					{/if}
				</div>
				<p class="text-[11px] text-ink-soft">
					{t.contribute.boxes.placementHint}
				</p>

				{#if suggesting}
					<p class="text-xs text-ink-soft" role="status">{suggesting}</p>
				{:else if suggestError}
					<p class="text-xs text-warn" role="status">{suggestError}</p>
				{/if}
				{#if suggestions.length}
					<div class="space-y-2">
						<h3 class="text-xs font-semibold tracking-wider text-ink uppercase">
							{t.contribute.suggest.title(suggestions.length)}
						</h3>
						<p class="text-[11px] text-ink-soft">
							{t.contribute.suggest.hint}
						</p>
						{#each suggestions as sug, si (si)}
							<div
								class="flex items-center gap-2 rounded-xl border border-warn/40 bg-surface p-2 text-xs"
							>
								<span class="rounded bg-warn/90 px-1.5 py-0.5 font-bold text-black">
									{t.contribute.suggest.badge(si + 1)}
								</span>
								<span class="min-w-0 flex-1 text-ink-soft">
									{t.contribute.suggest.summary(sug.people, sug.frames, sug.upscale > 1)}
								</span>
								<button
									type="button"
									class="min-h-10 rounded-lg bg-accent px-3 font-semibold text-accent-ink"
									onclick={() => useSuggestion(si)}
								>
									{t.contribute.suggest.use}
								</button>
								<button
									type="button"
									class="min-h-10 rounded-lg border border-line px-3 font-medium text-ink"
									onclick={() => (suggestions = suggestions.filter((_, j) => j !== si))}
								>
									{t.contribute.suggest.dismiss}
								</button>
							</div>
						{/each}
					</div>
				{/if}

				{#if regions.length > 0}
					<div class="space-y-3">
						<h3 class="text-xs font-semibold tracking-wider text-ink uppercase">
							{t.contribute.boxes.countTitle(regions.length)}
						</h3>

						<div class="space-y-2">
							{#each regions as reg, idx (idx)}
								<div
									class="rounded-xl border p-3 {activeRegionIndex === idx
										? 'border-accent bg-accent/5'
										: 'border-line bg-surface'} space-y-2 transition-colors"
								>
									<div class="flex flex-wrap items-center justify-between gap-2">
										<button
											type="button"
											onclick={() => (activeRegionIndex = idx)}
											class="flex items-center gap-1.5 px-1 text-xs font-bold text-ink"
										>
											<span
												class="flex h-5 w-5 items-center justify-center rounded-full bg-accent/20 text-[10px] text-accent"
											>
												{idx + 1}
											</span>
											<span class="max-w-[150px] truncate">
												{reg.label || reg.lift || t.contribute.boxes.defaultLabel}
											</span>
										</button>
										<div class="flex items-center gap-2">
											<button
												type="button"
												onclick={() => {
													removeRegion(idx);
													drawMode = true;
													document
														.querySelector('[data-picture-viewport]')
														?.scrollIntoView({ behavior: 'smooth', block: 'center' });
												}}
												class="px-2 text-xs font-medium text-accent hover:underline"
											>
												{t.contribute.boxes.redraw}
											</button>
											<button
												type="button"
												onclick={() => removeRegion(idx)}
												class="px-2 text-xs font-medium text-bad hover:underline"
											>
												{t.common.delete}
											</button>
										</div>
									</div>

									<div class="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
										<div>
											<label for="reg-lift-{idx}" class="mb-0.5 block font-medium text-ink-soft">
												{t.contribute.boxes.liftLabel}
											</label>
											<select
												id="reg-lift-{idx}"
												bind:value={reg.lift}
												class="w-full rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 font-medium text-ink"
											>
												<option value={null}>{t.contribute.boxes.noneLift}</option>
												{#each sortedLifts() as item (item.lift.id)}
													<option value={item.lift.name}>
														{t.contribute.boxes.liftOption(item.lift.name, item.dist)}
													</option>
												{/each}
											</select>
										</div>

										<div>
											<label for="reg-label-{idx}" class="mb-0.5 block font-medium text-ink-soft">
												{t.contribute.boxes.label}
											</label>
											<input
												id="reg-label-{idx}"
												type="text"
												bind:value={reg.label}
												placeholder={t.contribute.boxes.labelPlaceholder}
												class="w-full rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-ink"
											/>
										</div>

										<div>
											<label for="reg-upscale-{idx}" class="mb-0.5 block font-medium text-ink-soft">
												{t.contribute.boxes.upscaleLabel}
											</label>
											<select
												id="reg-upscale-{idx}"
												bind:value={reg.upscale}
												class="w-full rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-ink"
											>
												<option value={1}>{t.contribute.boxes.upscaleOptions[1]}</option>
												<option value={2}>{t.contribute.boxes.upscaleOptions[2]}</option>
												<option value={3}>{t.contribute.boxes.upscaleOptions[3]}</option>
												<option value={4}>{t.contribute.boxes.upscaleOptions[4]}</option>
											</select>
										</div>
									</div>

									<div class="space-y-1">
										<span class="block text-[11px] font-medium text-ink-soft">
											{t.contribute.boxes.cornersLabel}
										</span>
										<div class="grid grid-cols-4 gap-1.5 font-mono text-xs">
											<input
												type="number"
												bind:value={reg.box[0]}
												class="rounded border border-line bg-surface-2 px-2 py-1 text-center"
												placeholder={t.contribute.boxes.cornerX0}
											/>
											<input
												type="number"
												bind:value={reg.box[1]}
												class="rounded border border-line bg-surface-2 px-2 py-1 text-center"
												placeholder={t.contribute.boxes.cornerY0}
											/>
											<input
												type="number"
												bind:value={reg.box[2]}
												class="rounded border border-line bg-surface-2 px-2 py-1 text-center"
												placeholder={t.contribute.boxes.cornerX1}
											/>
											<input
												type="number"
												bind:value={reg.box[3]}
												class="rounded border border-line bg-surface-2 px-2 py-1 text-center"
												placeholder={t.contribute.boxes.cornerY1}
											/>
										</div>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</section>

			<section
				class="space-y-3 rounded-2xl border border-line bg-surface-2/60 p-4 shadow-sm sm:p-5"
			>
				<h2 class="flex items-center gap-2 text-sm font-semibold tracking-wider text-ink uppercase">
					<span
						class="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-ink"
					>
						4
					</span>
					{editingId ? t.contribute.save.titleBoxes : t.contribute.save.titleCamera}
				</h2>
				{#if me}
					<div class="flex flex-wrap items-center gap-3">
						<button
							type="button"
							onclick={saveWebcam}
							disabled={saving || !resolved}
							class="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink transition hover:opacity-90 active:scale-95 disabled:opacity-50"
						>
							{#if saving}
								{t.contribute.save.saving}
							{:else if editingId}
								{t.contribute.save.saveBoxesCount(regions.length)}
							{:else}
								{t.contribute.save.saveCameraWithBoxes(regions.length)}
							{/if}
						</button>
						{#if !resolved}
							<span class="text-xs text-ink-soft">{t.contribute.save.pasteFirst}</span>
						{/if}
					</div>
				{:else if accountState === 'ready'}
					<p class="text-xs text-ink-soft">
						{t.contribute.save.signInBefore}<a
							href={resolve(`/login?next=${encodeURIComponent(resolve('/contribute/webcam'))}`)}
							class="font-medium text-accent hover:underline"
						>
							{t.contribute.save.signInLink}
						</a>{t.contribute.save.signInAfter}
					</p>
				{:else}
					<p class="text-xs text-ink-soft">
						{t.contribute.save.noAccount}
					</p>
				{/if}
				{#if saveMessage}
					<p class="text-xs font-medium {saveMessage.ok ? 'text-good' : 'text-bad'}" role="status">
						{saveMessage.text}
					</p>
				{/if}
			</section>
		{/if}
	</main>
</div>

<style>
	.wc :global(button),
	.wc :global(a[href]),
	.wc :global(input),
	.wc :global(select) {
		min-height: 40px;
		min-width: 40px;
	}
	.wc :global(a[href]) {
		display: inline-flex;
		align-items: center;
	}
	.wc :global(input[type='range']) {
		min-width: 0;
	}
	.wc :global(input[type='checkbox']) {
		width: 40px;
		height: 40px;
	}
	.pan-viewport {
		overscroll-behavior-x: contain;
		scrollbar-width: thin;
	}
</style>
