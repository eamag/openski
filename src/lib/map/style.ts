import type {
	ExpressionSpecification,
	LayerSpecification,
	SourceSpecification,
	StyleSpecification
} from 'maplibre-gl';
import type { MapTheme } from './theme.ts';

export const BASEMAP_TILEJSON = 'https://tiles.openfreemap.org/planet';
export const GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';
export const DEM_TILES = 'https://tiles.mapterhorn.com/{z}/{x}/{y}.webp';
export const DEM_MAXZOOM = 14;

export const NAME_ZOOM = 13;

const FONT = ['Noto Sans Regular'];
const FONT_BOLD = ['Noto Sans Bold'];
const FONT_ITALIC = ['Noto Sans Italic'];

const difficultyColor = (t: MapTheme): ExpressionSpecification => [
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
	'unknown',
	t.piste.unknown,
	t.piste.advanced
];

export function baseStyle(t: MapTheme, contourTiles: string | null): StyleSpecification {
	const layers: LayerSpecification[] = [
		{ id: 'background', type: 'background', paint: { 'background-color': t.snow } },
		{
			id: 'glacier',
			type: 'fill',
			source: 'base',
			'source-layer': 'landcover',
			filter: ['==', ['get', 'class'], 'ice'],
			paint: { 'fill-color': t.glacier }
		},
		{
			id: 'forest',
			type: 'fill',
			source: 'base',
			'source-layer': 'landcover',
			filter: ['==', ['get', 'class'], 'wood'],
			paint: {
				'fill-color': t.forest,
				'fill-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0.6, 14, 0.9]
			}
		},
		{
			id: 'water',
			type: 'fill',
			source: 'base',
			'source-layer': 'water',
			paint: { 'fill-color': t.water }
		},
		{
			id: 'waterway',
			type: 'line',
			source: 'base',
			'source-layer': 'waterway',
			minzoom: 11,
			paint: {
				'line-color': t.water,
				'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.6, 16, 2]
			}
		},
		{
			id: 'border',
			type: 'line',
			source: 'base',
			'source-layer': 'boundary',
			maxzoom: 11,
			filter: ['all', ['==', ['get', 'admin_level'], 2], ['!=', ['get', 'maritime'], 1]],
			paint: {
				'line-color': t.labelSoft,
				'line-opacity': 0.45,
				'line-width': 0.9,
				'line-dasharray': [3, 2]
			}
		}
	];

	if (contourTiles) {
		layers.push(
			{
				id: 'contour',
				type: 'line',
				source: 'contour',
				'source-layer': 'contours',
				minzoom: 11,
				paint: {
					'line-color': t.contour,
					'line-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0.35, 14, 0.7],
					'line-width': ['match', ['get', 'level'], 1, 0.9, 0.45]
				}
			},
			{
				id: 'contour-label',
				type: 'symbol',
				source: 'contour',
				'source-layer': 'contours',
				minzoom: 13,
				filter: ['==', ['get', 'level'], 1],
				layout: {
					'symbol-placement': 'line',
					'symbol-spacing': 420,
					'text-field': ['to-string', ['get', 'ele']],
					'text-font': FONT,
					'text-size': 9.5
				},
				paint: { 'text-color': t.contourLabel, 'text-halo-color': t.halo, 'text-halo-width': 1.2 }
			}
		);
	}

	layers.push(
		{
			id: 'building',
			type: 'fill',
			source: 'base',
			'source-layer': 'building',
			minzoom: 13.5,
			paint: {
				'fill-color': t.building,
				'fill-opacity': ['interpolate', ['linear'], ['zoom'], 13.5, 0, 14.5, 1]
			}
		},
		{
			id: 'road',
			type: 'line',
			source: 'base',
			'source-layer': 'transportation',
			minzoom: 10,
			filter: [
				'all',
				[
					'in',
					['get', 'class'],
					['literal', ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor']]
				],
				['!=', ['get', 'brunnel'], 'tunnel']
			],
			layout: { 'line-cap': 'round', 'line-join': 'round' },
			paint: {
				'line-color': t.road,
				'line-width': [
					'interpolate',
					['exponential', 1.5],
					['zoom'],
					10,
					['match', ['get', 'class'], ['minor', 'tertiary'], 0.3, 0.9],
					16,
					['match', ['get', 'class'], ['minor', 'tertiary'], 3, 6]
				]
			}
		},
		{
			id: 'peak',
			type: 'symbol',
			source: 'base',
			'source-layer': 'mountain_peak',
			minzoom: 11,
			filter: [
				'all',
				['has', 'name'],
				['<=', ['get', 'rank'], ['step', ['zoom'], 1, 12, 2, 13, 4, 14, 10]]
			],
			layout: {
				'icon-image': 'peak',
				'text-field': [
					'format',
					['get', 'name'],
					{},
					'\n',
					{},
					['concat', ['to-string', ['get', 'ele']], ' m'],
					{ 'font-scale': 0.85 }
				],
				'text-font': FONT_ITALIC,
				'text-size': 10.5,
				'text-offset': [0, 0.6],
				'text-anchor': 'top',
				'text-max-width': 8,
				'symbol-sort-key': ['get', 'rank']
			},
			paint: { 'text-color': t.labelSoft, 'text-halo-color': t.halo, 'text-halo-width': 1.4 }
		},
		{
			id: 'place',
			type: 'symbol',
			source: 'base',
			'source-layer': 'place',
			filter: [
				'any',
				['all', ['<', ['zoom'], 6], ['==', ['get', 'class'], 'country']],
				['all', ['<', ['zoom'], 11], ['==', ['get', 'class'], 'city']],
				['in', ['get', 'class'], ['literal', ['town', 'village']]],
				['all', ['>=', ['zoom'], 13.5], ['in', ['get', 'class'], ['literal', ['hamlet', 'suburb']]]]
			],
			layout: {
				'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
				'text-font': FONT,
				'text-size': ['match', ['get', 'class'], ['country', 'city', 'town', 'village'], 13, 11],
				'text-letter-spacing': 0.08,
				'text-transform': 'uppercase',
				'text-max-width': 8,
				'symbol-sort-key': ['get', 'rank']
			},
			paint: { 'text-color': t.labelSoft, 'text-halo-color': t.halo, 'text-halo-width': 1.5 }
		}
	);

	return {
		version: 8,
		glyphs: GLYPHS,
		sources: {
			base: { type: 'vector', url: BASEMAP_TILEJSON },
			...(contourTiles
				? { contour: { type: 'vector' as const, tiles: [contourTiles], maxzoom: 14 } }
				: {})
		},
		layers
	};
}

// The terrain-elevation source and the hillshade layer are added after the first render
// (ResortMap.ensureHillshade): their terrarium tiles are ~150 KiB each, and loading them
// up front delays the first paint of the map.
export function demSource(tiles: string): SourceSpecification {
	return {
		type: 'raster-dem',
		tiles: [tiles],
		tileSize: 512,
		encoding: 'terrarium',
		maxzoom: DEM_MAXZOOM,
		attribution: '<a href="https://mapterhorn.com/attribution">© Mapterhorn</a>'
	};
}

export function hillshadeLayer(t: MapTheme): LayerSpecification {
	return {
		id: 'hillshade',
		type: 'hillshade',
		source: 'dem',
		paint: {
			'hillshade-shadow-color': t.shade,
			'hillshade-highlight-color': t.highlight,
			'hillshade-accent-color': t.shade,
			'hillshade-exaggeration': [
				'interpolate',
				['linear'],
				['zoom'],
				9,
				t.dark ? 0.4 : 0.16,
				14,
				t.dark ? 0.55 : 0.28
			],
			'hillshade-illumination-direction': 315
		}
	};
}

const pisteWidth: ExpressionSpecification = [
	'interpolate',
	['exponential', 1.4],
	['zoom'],
	10,
	0.9,
	13,
	2.4,
	15,
	4.5,
	17,
	8
];

export function resortLayers(t: MapTheme): LayerSpecification[] {
	const color = difficultyColor(t);
	return [
		{
			id: 'piste-area',
			type: 'fill',
			source: 'areas',
			paint: { 'fill-color': color, 'fill-opacity': t.dark ? 0.2 : 0.13 }
		},
		{
			id: 'webcam-cone',
			type: 'fill',
			source: 'webcam-cones',
			minzoom: NAME_ZOOM,
			paint: { 'fill-color': t.route, 'fill-opacity': t.dark ? 0.2 : 0.13 }
		},
		{
			id: 'webcam-cone-edge',
			type: 'line',
			source: 'webcam-cones',
			minzoom: NAME_ZOOM,
			paint: { 'line-color': t.route, 'line-opacity': 0.4, 'line-width': 1 }
		},
		{
			id: 'selection',
			type: 'line',
			source: 'selection',
			layout: { 'line-cap': 'round', 'line-join': 'round' },
			paint: {
				'line-color': t.selection,
				'line-width': ['interpolate', ['exponential', 1.4], ['zoom'], 10, 5, 13, 11, 15, 16, 17, 22]
			}
		},
		{
			id: 'piste-casing',
			type: 'line',
			source: 'segments',
			layout: { 'line-cap': 'round', 'line-join': 'round' },
			paint: {
				'line-color': t.casing,
				'line-width': [
					'interpolate',
					['exponential', 1.4],
					['zoom'],
					10,
					1.6,
					13,
					4.4,
					15,
					7.5,
					17,
					12
				],
				'line-opacity': 0.9
			}
		},
		{
			id: 'piste',
			type: 'line',
			source: 'segments',
			layout: { 'line-cap': 'round', 'line-join': 'round' },
			paint: { 'line-color': color, 'line-width': pisteWidth }
		},
		{
			id: 'lift',
			type: 'line',
			source: 'lifts',
			layout: { 'line-cap': 'butt' },
			paint: {
				'line-color': t.lift,
				'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.7, 13, 1.3, 16, 2.2],
				'line-dasharray': ['match', ['get', 'drag'], 1, ['literal', [4, 2.5]], ['literal', [1, 0]]]
			}
		},
		{
			id: 'route-casing',
			type: 'line',
			source: 'route',
			layout: { 'line-cap': 'round', 'line-join': 'round' },
			paint: {
				'line-color': t.casing,
				'line-width': [
					'interpolate',
					['exponential', 1.4],
					['zoom'],
					10,
					5,
					13,
					8.5,
					15,
					12,
					17,
					17
				]
			}
		},
		{
			id: 'route',
			type: 'line',
			source: 'route',
			layout: { 'line-cap': 'round', 'line-join': 'round' },
			paint: {
				'line-color': t.route,
				'line-width': ['interpolate', ['exponential', 1.4], ['zoom'], 10, 3, 13, 5.5, 15, 8, 17, 12]
			}
		},
		{
			id: 'route-arrows',
			type: 'symbol',
			source: 'route',
			minzoom: 12.5,
			layout: {
				'symbol-placement': 'line',
				'symbol-spacing': 90,
				'icon-image': 'arrow',
				'icon-allow-overlap': true,
				'icon-ignore-placement': true
			}
		},
		{
			id: 'track',
			type: 'line',
			source: 'track',
			layout: { 'line-cap': 'round', 'line-join': 'round' },
			paint: {
				'line-color': t.dark ? '#fbbf24' : '#f59e0b',
				'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.5, 15, 3.5],
				'line-opacity': 0.95
			}
		},
		{
			id: 'station',
			type: 'circle',
			source: 'stations',
			minzoom: 11.5,
			paint: {
				'circle-radius': ['interpolate', ['linear'], ['zoom'], 11.5, 1.8, 14, 3.4, 16, 5],
				'circle-color': t.casing,
				'circle-stroke-color': t.lift,
				'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 11.5, 1, 15, 1.8]
			}
		},
		{
			id: 'lift-label',
			type: 'symbol',
			source: 'lifts',
			minzoom: 13,
			filter: ['==', ['get', 'major'], 1],
			layout: {
				'symbol-placement': 'line-center',
				'text-field': ['get', 'name'],
				'text-font': FONT_BOLD,
				'text-size': ['interpolate', ['linear'], ['zoom'], 13, 10, 16, 12.5],
				'text-letter-spacing': 0.03,
				'text-offset': [0, -0.75],
				'text-max-angle': 30
			},
			paint: { 'text-color': t.lift, 'text-halo-color': t.halo, 'text-halo-width': 1.6 }
		},
		{
			id: 'piste-label',
			type: 'symbol',
			source: 'labels',
			minzoom: 12,
			layout: {
				'icon-image': ['concat', 'badge-', ['get', 'd']],
				'icon-size': ['interpolate', ['linear'], ['zoom'], 12, 0.7, 15, 0.9],
				'text-field': ['get', 'ref'],
				'text-font': FONT_BOLD,
				'text-size': ['interpolate', ['linear'], ['zoom'], 12, 8.5, 15, 11],
				'icon-allow-overlap': false,
				'symbol-sort-key': ['-', 0, ['get', 'length']]
			},
			paint: {
				'text-color': [
					'match',
					['get', 'd'],
					['advanced', 'expert'],
					t.dark ? '#10141a' : '#ffffff',
					'#ffffff'
				]
			}
		},
		{
			id: 'poi',
			type: 'symbol',
			source: 'pois',
			minzoom: 14,
			layout: {
				'icon-image': 'dot',
				'text-field': ['get', 'name'],
				'text-font': FONT,
				'text-size': 10.5,
				'text-anchor': 'left',
				'text-offset': [0.7, 0],
				'text-max-width': 9,
				'text-optional': true
			},
			paint: { 'text-color': t.label, 'text-halo-color': t.halo, 'text-halo-width': 1.4 }
		},
		{
			id: 'webcam-selected',
			type: 'circle',
			source: 'webcams',
			minzoom: NAME_ZOOM,
			filter: ['==', ['get', 'osm'], ''],
			paint: {
				'circle-radius': ['interpolate', ['linear'], ['zoom'], NAME_ZOOM, 14, 16, 18],
				'circle-color': t.selection
			}
		},
		{
			id: 'webcam',
			type: 'symbol',
			source: 'webcams',
			minzoom: NAME_ZOOM,
			layout: {
				'icon-image': 'webcam',
				'icon-size': ['interpolate', ['linear'], ['zoom'], NAME_ZOOM, 0.8, 16, 1],
				'icon-allow-overlap': true
			}
		}
	];
}

export const RESORTS_MAXZOOM = 12;
export const NEIGHBOUR_ZOOM = 9.5;
export const CURRENT_HIDE_ZOOM = 10;
const OPEN_RESORT_SORT_PRIORITY = -1e6;

export function catalogLayers(t: MapTheme, accent: string): LayerSpecification[] {
	const current: ExpressionSpecification = ['boolean', ['get', 'current'], false];
	const dotRadiusByPisteKm: ExpressionSpecification = [
		'interpolate',
		['linear'],
		['get', 'km'],
		0,
		2.6,
		15,
		3.6,
		60,
		5,
		200,
		6.5
	];
	const dotFadeInByZoom: ExpressionSpecification = [
		'interpolate',
		['linear'],
		['zoom'],
		CURRENT_HIDE_ZOOM - 1,
		1,
		CURRENT_HIDE_ZOOM,
		['case', current, 0, 1],
		RESORTS_MAXZOOM - 1,
		['case', current, 0, 1],
		RESORTS_MAXZOOM,
		0
	];
	const nameOpacityByZoom: ExpressionSpecification = [
		'interpolate',
		['linear'],
		['zoom'],
		CURRENT_HIDE_ZOOM - 1,
		1,
		CURRENT_HIDE_ZOOM,
		['case', current, 0, 1]
	];
	return [
		{
			id: 'resort-cluster',
			type: 'circle',
			source: 'resorts',
			filter: ['has', 'point_count'],
			paint: {
				'circle-color': t.dark ? '#2a3240' : '#ffffff',
				'circle-stroke-color': t.label,
				'circle-stroke-width': 1.2,
				'circle-stroke-opacity': 0.5,
				'circle-radius': ['step', ['get', 'point_count'], 12, 10, 15, 50, 19, 200, 23]
			}
		},
		{
			id: 'resort-cluster-count',
			type: 'symbol',
			source: 'resorts',
			filter: ['has', 'point_count'],
			layout: {
				'text-field': ['get', 'point_count_abbreviated'],
				'text-font': FONT_BOLD,
				'text-size': 11,
				'text-allow-overlap': true
			},
			paint: { 'text-color': t.label }
		},
		{
			id: 'resort-dot',
			type: 'circle',
			source: 'resorts',
			maxzoom: RESORTS_MAXZOOM,
			filter: ['!', ['has', 'point_count']],
			paint: {
				'circle-color': ['case', current, t.halo, t.dark ? '#e5e7eb' : '#1b1e24'],
				'circle-radius': [
					'interpolate',
					['linear'],
					['zoom'],
					4,
					['case', current, 6, ['*', 0.8, dotRadiusByPisteKm]],
					10,
					['case', current, 8, ['*', 1.2, dotRadiusByPisteKm]]
				],
				'circle-stroke-color': ['case', current, accent, t.halo],
				'circle-stroke-width': ['case', current, 3.5, 1.5],
				'circle-opacity': dotFadeInByZoom,
				'circle-stroke-opacity': dotFadeInByZoom
			}
		},
		{
			id: 'resort-name',
			type: 'symbol',
			source: 'resorts',
			minzoom: 5.5,
			filter: [
				'all',
				['!', ['has', 'point_count']],
				['any', current, ['>=', ['get', 'km'], ['step', ['zoom'], 60, 7, 25, 8, 10, 9, 0]]]
			],
			layout: {
				'text-field': ['get', 'name'],
				'text-font': FONT_BOLD,
				'text-size': ['case', current, 13, ['>=', ['get', 'km'], 40], 12, 11],
				'text-offset': [0, 0.9],
				'text-anchor': 'top',
				'text-max-width': 9,
				'symbol-sort-key': ['case', current, OPEN_RESORT_SORT_PRIORITY, ['-', ['get', 'km']]]
			},
			paint: {
				'text-color': ['case', current, accent, t.label],
				'text-halo-color': t.halo,
				'text-halo-width': 1.6,
				'text-opacity': nameOpacityByZoom
			}
		}
	];
}

export function neighbourLayers(t: MapTheme): LayerSpecification[] {
	return [
		{
			id: 'other-piste',
			type: 'line',
			source: 'others',
			minzoom: NEIGHBOUR_ZOOM,
			filter: ['==', ['get', 'kind'], 'piste'],
			layout: { 'line-cap': 'round', 'line-join': 'round' },
			paint: {
				'line-color': difficultyColor(t),
				'line-opacity': t.dark ? 0.45 : 0.4,
				'line-width': [
					'interpolate',
					['exponential', 1.4],
					['zoom'],
					10,
					0.8,
					13,
					2,
					15,
					3.5,
					17,
					6
				]
			}
		},
		{
			id: 'other-lift',
			type: 'line',
			source: 'others',
			minzoom: NEIGHBOUR_ZOOM,
			filter: ['==', ['get', 'kind'], 'lift'],
			paint: {
				'line-color': t.lift,
				'line-opacity': 0.35,
				'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.7, 15, 1.8]
			}
		}
	];
}
