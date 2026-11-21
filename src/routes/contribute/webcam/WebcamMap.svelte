<script lang="ts">
	import { onMount } from 'svelte';
	import { t } from '#lib/i18n/index.ts';
	import type { ResortData } from '#lib/resort/types.ts';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import { Map as MapLibre, Marker, setWorkerUrl } from 'maplibre-gl';
	import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

	const DEFAULT_OVERVIEW_ZOOM = 12;
	const FOCUSED_CAMERA_ZOOM = 13.5;
	const RECENTER_ZOOM = 14;
	const RESORT_BOUNDS_PADDING_PX = 30;
	const COORDINATE_PRECISION_DECIMALS = 6;

	let {
		resort,
		lat = $bindable(0),
		lon = $bindable(0),
		direction = $bindable(0),
		is360 = $bindable(false),
		onchange
	}: {
		resort: ResortData;
		lat: number;
		lon: number;
		direction: number;
		is360: boolean;
		onchange?: () => void;
	} = $props();

	let container: HTMLDivElement;
	let map: MapLibre | null = null;
	let marker: Marker | null = null;
	let coneEl: HTMLDivElement | null = null;
	let mapReady = $state(false);

	function buildMarkerElement(): HTMLDivElement {
		const root = document.createElement('div');
		root.className =
			'relative flex items-center justify-center pointer-events-auto cursor-grab active:cursor-grabbing';
		root.style.width = '36px';
		root.style.height = '36px';

		const cone = document.createElement('div');
		cone.className = 'absolute pointer-events-none transition-transform duration-100';
		cone.style.width = '80px';
		cone.style.height = '80px';
		cone.style.top = '-22px';
		cone.style.left = '-22px';
		coneEl = cone;
		updateCone(direction, is360);
		root.appendChild(cone);

		const badge = document.createElement('div');
		badge.className =
			'relative z-10 w-7 h-7 rounded-full bg-violet-600 text-white flex items-center justify-center shadow-lg border-2 border-white';
		badge.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>`;
		root.appendChild(badge);

		return root;
	}

	function updateCone(heading: number, panoramic: boolean) {
		if (!coneEl) return;
		if (panoramic) {
			coneEl.innerHTML = `
				<svg class="w-full h-full" viewBox="0 0 80 80">
					<circle cx="40" cy="40" r="36" fill="rgba(124, 58, 237, 0.15)" stroke="rgba(124, 58, 237, 0.6)" stroke-width="2" stroke-dasharray="4 3" />
				</svg>`;
			coneEl.style.transform = 'none';
		} else {
			coneEl.innerHTML = `
				<svg class="w-full h-full" viewBox="0 0 80 80">
					<defs>
						<linearGradient id="coneGrad" x1="0%" y1="100%" x2="0%" y2="0%">
							<stop offset="0%" stop-color="rgba(124, 58, 237, 0.6)" />
							<stop offset="100%" stop-color="rgba(124, 58, 237, 0.05)" />
						</linearGradient>
					</defs>
					<path d="M 40 40 L 22 5 A 40 40 0 0 1 58 5 Z" fill="url(#coneGrad)" stroke="rgba(124, 58, 237, 0.7)" stroke-width="1.5" />
				</svg>`;
			coneEl.style.transform = `rotate(${heading || 0}deg)`;
		}
	}

	onMount(() => {
		setWorkerUrl(workerUrl);

		const [west, south, east, north] = resort.bbox;
		const centerLon = (west + east) / 2;
		const centerLat = (south + north) / 2;

		const startLon = lon || centerLon;
		const startLat = lat || centerLat;

		try {
			map = new MapLibre({
				container,
				cooperativeGestures: true,
				style: {
					version: 8,
					sources: {
						osm: {
							type: 'raster',
							tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
							tileSize: 256,
							attribution: '&copy; OpenStreetMap'
						}
					},
					layers: [
						{
							id: 'osm-layer',
							type: 'raster',
							source: 'osm',
							paint: { 'raster-opacity': 0.85 }
						}
					]
				},
				center: [startLon, startLat],
				zoom: DEFAULT_OVERVIEW_ZOOM
			});

			map.on('load', () => {
				if (!map) return;
				mapReady = true;

				const liftGeoJSON: GeoJSON.FeatureCollection = {
					type: 'FeatureCollection',
					features: resort.lifts.map((l) => ({
						type: 'Feature',
						properties: { id: l.id, name: l.name, type: l.type },
						geometry: {
							type: 'LineString',
							coordinates: l.coords
						}
					}))
				};

				map.addSource('resort-lifts', {
					type: 'geojson',
					data: liftGeoJSON
				});

				map.addLayer({
					id: 'resort-lifts-line',
					type: 'line',
					source: 'resort-lifts',
					paint: {
						'line-color': '#0284c7',
						'line-width': 2.5,
						'line-dasharray': [2, 1]
					}
				});

				if (lat && lon) {
					map.flyTo({ center: [lon, lat], zoom: FOCUSED_CAMERA_ZOOM });
				} else {
					map.fitBounds([west, south, east, north], { padding: RESORT_BOUNDS_PADDING_PX });
				}

				const el = buildMarkerElement();
				marker = new Marker({
					element: el,
					draggable: true
				})
					.setLngLat([startLon, startLat])
					.addTo(map);

				marker.on('dragend', () => {
					if (!marker) return;
					const lngLat = marker.getLngLat();
					lon = Number(lngLat.lng.toFixed(COORDINATE_PRECISION_DECIMALS));
					lat = Number(lngLat.lat.toFixed(COORDINATE_PRECISION_DECIMALS));
					onchange?.();
				});

				map.on('click', (e) => {
					lon = Number(e.lngLat.lng.toFixed(COORDINATE_PRECISION_DECIMALS));
					lat = Number(e.lngLat.lat.toFixed(COORDINATE_PRECISION_DECIMALS));
					marker?.setLngLat([lon, lat]);
					updateCone(direction, is360);
					onchange?.();
				});
			});
		} catch (err) {
			console.warn('Camera map could not start:', err);
		}

		return () => {
			marker?.remove();
			map?.remove();
		};
	});

	$effect(() => {
		if (!mapReady || !marker || !lat || !lon) return;
		marker.setLngLat([lon, lat]);
		updateCone(direction, is360);
	});
</script>

<div class="relative h-64 w-full overflow-hidden rounded-xl border border-line bg-surface-2">
	<div bind:this={container} class="h-full w-full"></div>

	<div
		class="pointer-events-none absolute bottom-2 left-2 z-10 rounded border border-line bg-surface/90 px-2 py-1 text-[11px] text-ink-soft shadow backdrop-blur-sm"
	>
		{t.contribute.map.instruction}<br />
		{t.contribute.map.gestureHint}
	</div>

	{#if mapReady && lat && lon}
		<button
			type="button"
			onclick={() => map?.flyTo({ center: [lon, lat], zoom: RECENTER_ZOOM })}
			class="absolute top-2 right-2 z-10 flex min-h-[40px] min-w-[40px] items-center justify-center gap-1 rounded-lg border border-line bg-surface/90 px-2 text-xs font-medium text-ink shadow hover:bg-surface"
			title={t.contribute.map.recenterTitle}
		>
			<svg
				class="h-3.5 w-3.5"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<circle cx="12" cy="12" r="10" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
			</svg>
			{t.contribute.map.recenter}
		</button>
	{/if}
</div>
