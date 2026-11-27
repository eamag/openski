<script lang="ts">
	import 'maplibre-gl/dist/maplibre-gl.css';
	import {
		addProtocol,
		AttributionControl,
		Map as MapLibre,
		Marker,
		setWorkerUrl,
		type ExpressionSpecification,
		type GeoJSONSource,
		type LngLatBoundsLike
	} from 'maplibre-gl';
	import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
	import mlcontour from 'maplibre-contour';
	import { onMount, untrack } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import { goto } from '$app/navigation';
	import { asset, resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { LngLat } from '#lib/geo.ts';
	import type { CatalogResort } from '#lib/resort/catalog.ts';
	import type { Resort } from '#lib/resort/model.ts';
	import type { ResortData } from '#lib/resort/types.ts';
	import { app, type Selection } from '#lib/state/app.svelte.ts';
	import { loadCatalog } from '#lib/state/catalog.ts';
	import { location } from '#lib/state/location.svelte.ts';
	import { progress } from '#lib/state/progress.svelte.ts';
	import { route } from '#lib/state/route.svelte.ts';
	import { tracking } from '#lib/state/tracking.svelte.ts';
	import { conditions } from '#lib/state/conditions.svelte.ts';
	import { status } from '#lib/state/status.svelte.ts';
	import { webcams } from '#lib/state/webcams.svelte.ts';
	import { addImages } from './images.ts';
	import {
		circle,
		EMPTY,
		fc,
		line,
		neighbourFeatures,
		resortSources,
		webcamSources
	} from './sources.ts';
	import {
		baseStyle,
		catalogLayers,
		CURRENT_HIDE_ZOOM,
		demSource,
		DEM_MAXZOOM,
		DEM_TILES,
		hillshadeLayer,
		NEIGHBOUR_ZOOM,
		neighbourLayers,
		RESORTS_MAXZOOM,
		resortLayers
	} from './style.ts';
	import { theme as appearance } from '#lib/state/theme.svelte.ts';
	import { markTimeToMap } from '#lib/analytics.ts';
	import { ACCENT, DARK, LIGHT, getPisteColors, type MapTheme } from './theme.ts';
	import { setupSlopes, SLOPE_TILES } from './slope.ts';

	let { onpick }: { onpick?: (at: LngLat) => void } = $props();

	let container: HTMLDivElement;
	let map = $state.raw<MapLibre | null>(null);
	let styleEpoch = $state(0);
	let firstStyleLoad = true;
	// Only light/dark needs a new style; piste colours follow the resort's region and are repainted.
	const baseTheme = $derived<MapTheme>(appearance.dark ? DARK : LIGHT);
	const theme = $derived<MapTheme>({
		...baseTheme,
		piste: getPisteColors(app.country, appearance.dark)
	});

	let marker: Marker | null = null;
	let markerEl: HTMLDivElement | null = null;
	let contourUrl: string | null = null;
	let demUrl = DEM_TILES;
	let coveredOnMap = new Set<number>();
	let scoredOnMap = false;

	const CLICK_LAYERS = ['piste-label', 'poi', 'station', 'lift', 'piste', 'piste-area'];

	const RESORT_HIT_RADIUS_PX = 14;
	const NEIGHBOUR_HIT_RADIUS_PX = 10;
	const WEBCAM_HIT_RADIUS_PX = 16;
	const NEIGHBOUR_PADDING_RATIO = 0.25;
	const TERRAIN_3D_PITCH_DEGREES = 58;
	const TERRAIN_FLAT_PITCH_DEGREES = 0;
	const DEFAULT_FOLLOW_ZOOM = 14.5;

	let catalog = $state.raw<CatalogResort[] | null>(null);

	let keepCameraResortId: string | null = null;

	function openResort(id: string, stay: boolean) {
		keepCameraResortId = stay ? id : null;
		const current = resolve('/(app)/[resort]', { resort: page.params.resort ?? app.lastResort });
		const suffix = page.url.pathname.slice(current.length);
		void goto(resolve(`${id}${suffix}`));
	}

	const neighbours = new Map<string, Promise<GeoJSON.Feature<GeoJSON.LineString>[]>>();
	const MAX_NEIGHBOURS = 14;
	const MAX_CACHED = 40;
	let neighbourRun = 0;

	function neighbourLines(id: string) {
		let lines = neighbours.get(id);
		if (!lines) {
			lines = fetch(asset(`data/${id}.json` as never))
				.then(async (res) => (res.ok ? neighbourFeatures((await res.json()) as ResortData) : []))
				.catch(() => {
					neighbours.delete(id);
					return [];
				});
			neighbours.set(id, lines);
		}
		return lines;
	}

	async function updateNeighbours(m: MapLibre) {
		const resorts = catalog;
		const src = m.getSource<GeoJSONSource>('others');
		if (!resorts || !src || m.getZoom() < NEIGHBOUR_ZOOM) return;
		const run = ++neighbourRun;
		const current = page.params.resort ?? app.resort?.id;
		if (!current) return;
		const view = m.getBounds();
		const padLon = (view.getEast() - view.getWest()) * NEIGHBOUR_PADDING_RATIO;
		const padLat = (view.getNorth() - view.getSouth()) * NEIGHBOUR_PADDING_RATIO;
		const [cx, cy] = [m.getCenter().lng, m.getCenter().lat];
		const inView = resorts
			.filter(
				(r) =>
					r.id !== current &&
					r.bbox[0] < view.getEast() + padLon &&
					r.bbox[2] > view.getWest() - padLon &&
					r.bbox[1] < view.getNorth() + padLat &&
					r.bbox[3] > view.getSouth() - padLat
			)
			.sort(
				(a, b) =>
					Math.hypot(a.center[0] - cx, a.center[1] - cy) -
					Math.hypot(b.center[0] - cx, b.center[1] - cy)
			)
			.slice(0, MAX_NEIGHBOURS);
		const lines = await Promise.all(inView.map((r) => neighbourLines(r.id)));
		while (neighbours.size > MAX_CACHED) neighbours.delete(neighbours.keys().next().value!);
		if (run !== neighbourRun) return;
		src.setData(fc(lines.flat()));
	}

	function resortAt(m: MapLibre, point: { x: number; y: number }): boolean {
		const candidates =
			m.getZoom() >= RESORTS_MAXZOOM
				? ['resort-name']
				: ['resort-dot', 'resort-name', 'resort-cluster'];
		const layers = candidates.filter((id) => m.getLayer(id));
		if (!layers.length) return false;
		const r = RESORT_HIT_RADIUS_PX;
		const hidden = (current: unknown) => current === true && m.getZoom() >= CURRENT_HIDE_ZOOM;
		const hit = m
			.queryRenderedFeatures(
				[
					[point.x - r, point.y - r],
					[point.x + r, point.y + r]
				],
				{ layers }
			)
			.find((h) => !hidden(h.properties.current));
		if (!hit) return false;
		const at = (hit.geometry as GeoJSON.Point).coordinates as [number, number];
		if (hit.properties.cluster) {
			void m
				.getSource<GeoJSONSource>('resorts')
				?.getClusterExpansionZoom(hit.properties.cluster_id as number)
				.then((zoom) => m.easeTo({ center: at, zoom: zoom + 0.5, duration: 600 }));
			return true;
		}
		const id = hit.properties.id as string;
		if (id === app.resort?.id) frameResort(m, app.resort, true);
		else openResort(id, false);
		return true;
	}

	function neighbourAt(m: MapLibre, point: { x: number; y: number }): string | undefined {
		const layers = ['other-piste', 'other-lift'].filter((id) => m.getLayer(id));
		if (!layers.length) return undefined;
		const r = NEIGHBOUR_HIT_RADIUS_PX;
		const hit = m.queryRenderedFeatures(
			[
				[point.x - r, point.y - r],
				[point.x + r, point.y + r]
			],
			{ layers }
		)[0];
		return hit?.properties.resort as string | undefined;
	}

	const onMapScreen = $derived(page.route.id === '/(app)/[resort]');
	const wide = new MediaQuery('min-width: 768px');
	const sheetOffsetPx = $derived(app.sheetHeight ? app.sheetHeight + (wide.current ? 16 : 0) : 0);

	function webcamAt(m: MapLibre, point: { x: number; y: number }) {
		if (!m.getLayer('webcam')) return undefined;
		const r = WEBCAM_HIT_RADIUS_PX;
		const hits = m.queryRenderedFeatures(
			[
				[point.x - r, point.y - r],
				[point.x + r, point.y + r]
			],
			{ layers: ['webcam'] }
		);
		let best: { osm: string; d: number } | undefined;
		for (const h of hits) {
			const [lon, lat] = (h.geometry as GeoJSON.Point).coordinates;
			const at = m.project([lon, lat]);
			const d = Math.hypot(at.x - point.x, at.y - point.y);
			if (!best || d < best.d) best = { osm: h.properties.osm as string, d };
		}
		return best && webcams.byOsm(best.osm);
	}

	function setupContours() {
		try {
			const dem = new mlcontour.DemSource({
				url: DEM_TILES,
				encoding: 'terrarium',
				maxzoom: DEM_MAXZOOM - 1,
				worker: true,
				cacheSize: 60
			});
			dem.setupMaplibre({ addProtocol });
			contourUrl = dem.contourProtocolUrl({
				thresholds: { 11: [200, 1000], 12: [100, 500], 13: [50, 200], 14: [20, 100] },
				elevationKey: 'ele',
				levelKey: 'level',
				contourLayer: 'contours'
			});
			demUrl = dem.sharedDemProtocolUrl;
		} catch (err) {
			console.warn('contours unavailable', err);
		}
	}

	function ensureDem(m: MapLibre) {
		if (!m.getSource('dem')) m.addSource('dem', demSource(demUrl));
	}

	function ensureHillshade(m: MapLibre) {
		if (m.getLayer('hillshade')) return;
		ensureDem(m);
		m.addLayer(hillshadeLayer(untrack(() => theme)), 'border');
	}

	function resortBounds(resort: Resort): LngLatBoundsLike {
		const [w, s, e, n] = resort.data.bbox;
		return [
			[w, s],
			[e, n]
		];
	}

	function frameResort(m: MapLibre, resort: Resort, animate: boolean) {
		m.fitBounds(resortBounds(resort), {
			padding: { top: 70, bottom: 40, left: 20, right: 20 },
			maxZoom: 14.5,
			duration: animate ? 900 : 0
		});
	}

	onMount(() => {
		setWorkerUrl(workerUrl);
		setupContours();
		setupSlopes(addProtocol);

		const m = new MapLibre({
			container,
			style: style(untrack(() => theme)),
			center: [10.96, 46.948],
			zoom: 11.6,
			minZoom: 2,
			maxZoom: 17.5,
			maxPitch: 70,
			attributionControl: false,
			dragRotate: true,
			pitchWithRotate: true
		});
		m.touchZoomRotate.enable();
		m.addControl(
			new AttributionControl({
				compact: false,
				customAttribution:
					'<a href="https://openskimap.org/" target="_blank" rel="noopener">OpenSkiMap</a>'
			}),
			'bottom-left'
		);
		m.on('style.load', () => {
			addImages(
				m,
				untrack(() => theme)
			);
			if (firstStyleLoad) {
				firstStyleLoad = false;
				m.once('idle', () => {
					if (map === m) ensureHillshade(m);
				});
			} else {
				ensureHillshade(m);
			}
			styleEpoch++;
		});
		m.on('click', (e) => {
			if (app.picking) return onpick?.([e.lngLat.lng, e.lngLat.lat]);
			if (resortAt(m, e.point)) return void (app.selection = null);
			const cam = webcamAt(m, e.point);
			webcams.selected = cam ?? null;
			if (cam) return void (app.selection = null);
			const r = 12;
			const hits = m.queryRenderedFeatures(
				[
					[e.point.x - r, e.point.y - r],
					[e.point.x + r, e.point.y + r]
				],
				{ layers: CLICK_LAYERS.filter((id) => m.getLayer(id)) }
			);
			const order = (id: string) => CLICK_LAYERS.indexOf(id);
			hits.sort((a, b) => order(a.layer.id) - order(b.layer.id));
			const p = hits.find((h) => h.properties.kind !== 'piste' || h.properties.o >= 0)?.properties;
			const other = p ? undefined : neighbourAt(m, e.point);
			if (other) openResort(other, true);
			if (!p) app.selection = null;
			else if (p.kind === 'poi') app.selection = { kind: 'poi', index: p.poi };
			else if (p.kind === 'lift') app.selection = { kind: 'lift', index: p.lift };
			else app.selection = { kind: 'piste', index: p.o };
		});
		m.on('dragstart', () => (app.follow = false));
		m.on('moveend', () => void updateNeighbours(m));
		void loadCatalog().then((resorts) => (catalog = resorts?.filter((r) => r.built) ?? null));
		map = m;
		(window as unknown as { __map: MapLibre }).__map = m;
		m.on('error', (e) => {
			if (!navigator.onLine && /fetch|network/i.test(String(e.error?.message ?? e.error))) return;
			console.error(e.error ?? e);
		});

		return () => {
			marker?.remove();
			m.remove();
			map = null;
		};
	});

	function style(t: MapTheme) {
		return baseStyle(t, contourUrl);
	}

	let firstTheme = true;
	$effect(() => {
		const base = baseTheme;
		if (!map) return;
		if (firstTheme) {
			firstTheme = false;
			return;
		}
		// Layers wait for the next style.load; adding them to a style mid-reload throws.
		styleEpoch = 0;
		map.setStyle(style({ ...base, piste: untrack(() => theme.piste) }), { diff: false });
	});

	$effect(() => {
		const m = map;
		const t = theme;
		if (!m || !styleEpoch) return;
		untrack(() => addImages(m, t));
	});

	let installed = $state(0);
	$effect(() => {
		const m = map;
		const resort = app.resort;
		if (!m || !resort || !styleEpoch) return;
		const t = untrack(() => theme);
		const src = resortSources(resort);
		const add = (id: string, data: GeoJSON.FeatureCollection | GeoJSON.Feature) => {
			if (!m.getSource(id)) m.addSource(id, { type: 'geojson', data });
		};
		const put = (id: string, data: GeoJSON.FeatureCollection) => {
			const existing = m.getSource<GeoJSONSource>(id);
			if (existing) existing.setData(data);
			else add(id, data);
		};
		put('areas', src.areas);
		if (m.getSource('segments')) m.removeFeatureState({ source: 'segments' });
		put('segments', src.segments);
		put('lifts', src.lifts);
		put('stations', src.stations);
		put('labels', src.labels);
		put('pois', src.pois);
		add('webcams', EMPTY);
		add('webcam-cones', EMPTY);
		add('selection', EMPTY);
		add('route', EMPTY);
		add('track', EMPTY);
		add('accuracy', EMPTY);
		add('cursor', EMPTY);
		if (!m.getSource('slopes'))
			m.addSource('slopes', {
				type: 'raster',
				tiles: [SLOPE_TILES],
				tileSize: 512,
				maxzoom: DEM_MAXZOOM
			});
		if (!m.getLayer('accuracy')) {
			m.addLayer({
				id: 'accuracy',
				type: 'fill',
				source: 'accuracy',
				paint: { 'fill-color': t.route, 'fill-opacity': 0.12 }
			});
		}
		for (const layer of resortLayers(t)) if (!m.getLayer(layer.id)) m.addLayer(layer);
		if (!m.getLayer('cursor'))
			m.addLayer({
				id: 'cursor',
				type: 'circle',
				source: 'cursor',
				paint: {
					'circle-radius': 7,
					'circle-color': t.dark ? '#10141a' : '#ffffff',
					'circle-stroke-color': t.dark ? '#ffffff' : '#10141a',
					'circle-stroke-width': 3
				}
			});
		coveredOnMap = new Set();
		scoredOnMap = false;
		installed = untrack(() => installed) + 1;
	});

	let mapTimed = false;
	$effect(() => {
		const m = map;
		if (!m || !installed || mapTimed) return;
		const record = () => {
			if (mapTimed) return;
			mapTimed = true;
			markTimeToMap(performance.now());
		};
		if (m.loaded() && !m.isMoving()) record();
		else m.once('idle', record);
		return () => void m.off('idle', record);
	});

	$effect(() => {
		const id = app.resort?.id ?? null;
		untrack(() => webcams.load(id));
	});

	$effect(() => {
		const m = map;
		const cams = onMapScreen ? webcams.cams : [];
		if (!m || !installed) return;
		const { points, cones } = webcamSources(cams);
		m.getSource<GeoJSONSource>('webcams')?.setData(points);
		m.getSource<GeoJSONSource>('webcam-cones')?.setData(cones);
	});

	$effect(() => {
		if (app.selection || !onMapScreen) webcams.selected = null;
	});

	$effect(() => {
		const m = map;
		const osm = webcams.selected?.osm ?? '';
		if (!m || !installed || !m.getLayer('webcam-selected')) return;
		m.setFilter('webcam-selected', ['==', ['get', 'osm'], osm]);
	});

	let centredOn: string | null = null;
	$effect(() => {
		const m = map;
		const cam = webcams.selected;
		const sheet = app.sheetHeight;
		if (!cam) centredOn = null;
		if (!m || !cam || !sheet || centredOn === cam.osm) return;
		centredOn = cam.osm;
		const at = m.project([cam.lon, cam.lat]);
		if (at.y > m.getContainer().clientHeight - sheet - 28 || at.y < 90)
			m.easeTo({ center: [cam.lon, cam.lat], duration: 500 });
	});

	let framed: string | null = null;
	$effect(() => {
		const resort = app.resort;
		if (!map || !resort || framed === resort.id) return;
		const first = framed === null;
		framed = resort.id;
		if (keepCameraResortId === resort.id) keepCameraResortId = null;
		else frameResort(map, resort, !first);
	});

	$effect(() => {
		const m = map;
		const resorts = catalog;
		const id = app.resort?.id ?? null;
		if (!m || !resorts || !styleEpoch) return;
		const data = fc(
			resorts.map((r): GeoJSON.Feature<GeoJSON.Point> => ({
				type: 'Feature',
				properties: { id: r.id, name: r.name, km: r.km, current: r.id === id },
				geometry: { type: 'Point', coordinates: r.center }
			}))
		);
		const existing = m.getSource<GeoJSONSource>('resorts');
		if (existing) existing.setData(data);
		else
			m.addSource('resorts', {
				type: 'geojson',
				data,
				cluster: true,
				clusterMaxZoom: 6,
				clusterRadius: 42
			});
		if (!m.getSource('others')) m.addSource('others', { type: 'geojson', data: EMPTY });
		const t = untrack(() => theme);
		const before = m.getLayer('piste-area') ? 'piste-area' : undefined;
		for (const layer of [...neighbourLayers(t), ...catalogLayers(t, t.dark ? '#a78bfa' : ACCENT)])
			if (!m.getLayer(layer.id)) m.addLayer(layer, before);
		untrack(() => void updateNeighbours(m));
	});

	$effect(() => {
		const m = map;
		if (!m) return;
		const want = { top: 64, bottom: app.sheetHeight + 8, left: 0, right: 0 };
		const apply = () => {
			const p = m.getPadding();
			if (p.top !== want.top || p.bottom !== want.bottom || p.left || p.right) m.setPadding(want);
		};
		if (!m.isMoving()) return apply();
		m.once('moveend', apply);
		return () => void m.off('moveend', apply);
	});

	$effect(() => {
		const m = map;
		const on = app.slopes;
		if (!m || !installed) return;
		const has = !!m.getLayer('slopes');
		if (on && !has)
			m.addLayer(
				{
					id: 'slopes',
					type: 'raster',
					source: 'slopes',
					minzoom: 11,
					paint: { 'raster-opacity': 0.85, 'raster-fade-duration': 0 }
				},
				'piste-area'
			);
		else if (!on && has) m.removeLayer('slopes');
	});

	$effect(() => {
		const m = map;
		const at = app.cursor;
		if (!m || !installed) return;
		m.getSource<GeoJSONSource>('cursor')?.setData(
			at ? { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: at } } : EMPTY
		);
	});

	$effect(() => {
		const m = map;
		const on = app.terrain;
		if (!m || !styleEpoch) return;
		if (on) ensureDem(m);
		m.setTerrain(on ? { source: 'dem', exaggeration: 1.25 } : null);
		m.easeTo({ pitch: on ? TERRAIN_3D_PITCH_DEGREES : TERRAIN_FLAT_PITCH_DEGREES, duration: 600 });
	});

	const dimmed = $derived.by(() => {
		const resort = app.resort;
		const pistes: number[] = [];
		const lifts: number[] = [];
		if (!resort) return { pistes, lifts };
		const doneToo = app.dimDone && app.mode !== 'progress';
		resort.data.pistes.forEach((_, i) => {
			if ((app.dimClosed && status.pistes[i] === false) || (doneToo && progress.pistes[i]?.done))
				pistes.push(i);
		});
		resort.data.lifts.forEach((_, i) => {
			if ((app.dimClosed && status.lifts[i] === false) || (doneToo && progress.lifts[i]))
				lifts.push(i);
		});
		return { pistes, lifts };
	});

	$effect(() => {
		const m = map;
		if (!m || !installed || !m.getLayer('piste')) return;
		const t = theme;
		const hasRoute = !!route.result;
		const difficulty: ExpressionSpecification = [
			'match',
			['get', 'd'],
			'novice',
			t.piste.novice,
			'easy',
			t.piste.easy,
			'intermediate',
			t.piste.intermediate,
			'freeride',
			t.piste.freeride,
			t.piste.advanced
		];
		const faded = t.dark ? '#3b4452' : '#c4ccd7';
		let color: ExpressionSpecification = difficulty;
		if (app.mode === 'progress')
			color = ['case', ['boolean', ['feature-state', 'done'], false], difficulty, faded];
		else if (app.mode === 'conditions')
			color = [
				'case',
				['==', ['feature-state', 'score'], null],
				faded,
				[
					'interpolate',
					['linear'],
					['feature-state', 'score'],
					0,
					'#c62f2f',
					45,
					'#f08c2e',
					65,
					'#e9c62b',
					85,
					'#3fae5a',
					100,
					'#12804a'
				]
			];
		const dimPiste: ExpressionSpecification = ['in', ['get', 'o'], ['literal', dimmed.pistes]];
		const dimLift: ExpressionSpecification = ['in', ['get', 'lift'], ['literal', dimmed.lifts]];
		const fade = (
			when: ExpressionSpecification,
			low: number,
			normal: number
		): ExpressionSpecification => ['case', when, low, normal];
		const pisteOpacity = hasRoute ? 0.3 : 1;
		const liftOpacity = hasRoute ? 0.35 : 1;
		m.setPaintProperty('piste', 'line-color', color);
		if (m.getLayer('piste-area')) m.setPaintProperty('piste-area', 'fill-color', color);
		if (m.getLayer('other-piste')) m.setPaintProperty('other-piste', 'line-color', difficulty);
		m.setPaintProperty('piste', 'line-opacity', fade(dimPiste, pisteOpacity * 0.22, pisteOpacity));
		m.setPaintProperty('piste-casing', 'line-opacity', fade(dimPiste, 0.3, 0.9));
		m.setPaintProperty(
			'piste-area',
			'fill-opacity',
			fade(dimPiste, 0.02, app.mode === 'pistes' && !hasRoute ? (t.dark ? 0.2 : 0.13) : 0.04)
		);
		m.setPaintProperty('piste-label', 'icon-opacity', fade(dimPiste, 0.35, 1));
		m.setPaintProperty('piste-label', 'text-opacity', fade(dimPiste, 0.5, 1));
		m.setPaintProperty('lift', 'line-opacity', fade(dimLift, liftOpacity * 0.28, liftOpacity));
		m.setPaintProperty('lift-label', 'text-opacity', fade(dimLift, 0.4, 1));
		m.setPaintProperty('station', 'circle-opacity', fade(dimLift, 0.3, 1));
		m.setPaintProperty('station', 'circle-stroke-opacity', fade(dimLift, 0.3, 1));
		m.setLayoutProperty(
			'piste-label',
			'visibility',
			app.mode === 'conditions' ? 'none' : 'visible'
		);
	});

	$effect(() => {
		const m = map;
		const covered = progress.covered;
		if (!m || !installed || !m.getSource('segments')) return;
		for (const e of covered)
			if (!coveredOnMap.has(e)) m.setFeatureState({ source: 'segments', id: e }, { done: true });
		for (const e of coveredOnMap)
			if (!covered.has(e)) m.setFeatureState({ source: 'segments', id: e }, { done: false });
		coveredOnMap = new Set(covered);
	});

	$effect(() => {
		const m = map;
		const resort = app.resort;
		const scores = app.mode === 'conditions' ? conditions.scores : null;
		if (!m || !installed || !resort || !m.getSource('segments')) return;
		if (!scores) {
			if (scoredOnMap)
				resort.data.edges.forEach((e, i) => {
					if (e.k === 'p') m.removeFeatureState({ source: 'segments', id: i }, 'score');
				});
			scoredOnMap = false;
			return;
		}
		resort.data.edges.forEach((e, i) => {
			if (e.k === 'p') m.setFeatureState({ source: 'segments', id: i }, { score: scores[i] });
		});
		scoredOnMap = true;
	});

	$effect(() => {
		const m = map;
		const resort = app.resort;
		const sel: Selection | null = app.selection;
		if (!m || !installed || !resort) return;
		const src = m.getSource<GeoJSONSource>('selection');
		if (!src) return;
		if (!sel || sel.kind === 'poi') return void src.setData(EMPTY);
		const lines =
			sel.kind === 'piste'
				? resort.pisteEdges[sel.index].map((e) => line(resort.edgeCoords(e)))
				: [line(resort.data.lifts[sel.index].coords)];
		src.setData(fc(lines));
	});

	$effect(() => {
		const m = map;
		const resort = app.resort;
		const sel = app.selection;
		if (!m || !resort || !sel) return;
		untrack(() => {
			const coords: LngLat[] =
				sel.kind === 'piste'
					? resort.pisteEdges[sel.index].flatMap((e) => resort.edgeCoords(e))
					: sel.kind === 'lift'
						? resort.data.lifts[sel.index].coords
						: [[resort.data.pois[sel.index].lon, resort.data.pois[sel.index].lat]];
			if (!coords.length) return;
			const view = m.getBounds();
			if (coords.every((c) => view.contains(c)) && m.getZoom() > 12.5) return;
			frame(coords, 15);
		});
	});

	function frame(coords: LngLat[], maxZoom: number) {
		let w = Infinity,
			s = Infinity,
			e = -Infinity,
			n = -Infinity;
		for (const [x, y] of coords) {
			w = Math.min(w, x);
			e = Math.max(e, x);
			s = Math.min(s, y);
			n = Math.max(n, y);
		}
		map?.fitBounds(
			[
				[w, s],
				[e, n]
			],
			{ padding: 48, maxZoom, duration: 700 }
		);
	}

	$effect(() => {
		const m = map;
		const r = route.result;
		if (!m || !installed) return;
		m.getSource<GeoJSONSource>('route')?.setData(r ? line(r.coords) : EMPTY);
		if (r) untrack(() => frame(r.coords, 15.5));
	});

	$effect(() => {
		const m = map;
		const path = tracking.path;
		if (!m || !installed) return;
		m.getSource<GeoJSONSource>('track')?.setData(path.length > 1 ? line(path) : EMPTY);
	});

	$effect(() => {
		const m = map;
		const fix = location.fix;
		if (!m || !installed) return;
		if (!fix) {
			marker?.remove();
			marker = null;
			m.getSource<GeoJSONSource>('accuracy')?.setData(EMPTY);
			return;
		}
		const at: LngLat = [fix.lon, fix.lat];
		if (!marker) {
			markerEl = document.createElement('div');
			markerEl.className = 'me-dot';
			markerEl.innerHTML = '<i></i><b></b>';
			marker = new Marker({ element: markerEl, rotationAlignment: 'map' }).setLngLat(at).addTo(m);
		} else marker.setLngLat(at);
		const moving = fix.heading !== undefined && (fix.spd ?? 0) > 0.8;
		markerEl?.classList.toggle('moving', moving);
		if (moving) marker.setRotation(fix.heading!);
		m.getSource<GeoJSONSource>('accuracy')?.setData(fix.acc > 12 ? circle(at, fix.acc) : EMPTY);
		if (app.follow) m.easeTo({ center: at, duration: 900, easing: (t) => t });
	});

	$effect(() => {
		if (!app.follow || !map) return;
		const fix = untrack(() => location.fix);
		if (fix)
			map.easeTo({
				center: [fix.lon, fix.lat],
				zoom: Math.max(map.getZoom(), DEFAULT_FOLLOW_ZOOM),
				duration: 700
			});
	});
</script>

<div class="absolute inset-0" class:picking={app.picking} style:--sheet="{sheetOffsetPx}px">
	<div bind:this={container} class="size-full"></div>
</div>

<style>
	.picking :global(.maplibregl-canvas) {
		cursor: crosshair;
	}
	div :global(.me-dot) {
		width: 22px;
		height: 22px;
		pointer-events: none;
	}
	div :global(.me-dot b) {
		position: absolute;
		inset: 3px;
		border-radius: 50%;
		background: var(--accent);
		border: 3px solid #fff;
		box-shadow: 0 1px 6px rgb(0 0 0 / 0.35);
	}
	div :global(.me-dot i) {
		position: absolute;
		left: 50%;
		top: -13px;
		margin-left: -8px;
		border: 8px solid transparent;
		border-bottom: 14px solid var(--accent);
		border-top: 0;
		opacity: 0;
	}
	div :global(.me-dot.moving i) {
		opacity: 0.9;
	}
	div :global(.maplibregl-ctrl-attrib) {
		font-size: 10px;
		line-height: 1.3;
		max-width: min(calc(100vw - 80px), 28rem);
		border-radius: 8px;
		background: color-mix(in srgb, var(--surface) 82%, transparent);
		color: var(--ink-soft);
	}
	div :global(.maplibregl-ctrl-attrib a) {
		color: inherit;
	}
	div :global(.maplibregl-ctrl-bottom-left) {
		bottom: var(--sheet, 0px);
	}
</style>
