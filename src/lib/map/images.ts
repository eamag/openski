import type { Map as MapLibre } from 'maplibre-gl';
import type { Difficulty } from '../resort/types.ts';
import type { MapTheme } from './theme.ts';

const CANVAS_PIXEL_RATIO = 2;
const PISTE_BADGE_SIZE = 28;
const DIRECTION_ARROW_SIZE = 14;
const MOUNTAIN_PEAK_ICON_SIZE = 10;
const PLACE_DOT_ICON_SIZE = 10;
const WEBCAM_DISC_SIZE = 26;
const WEBCAM_GLYPH_SIZE = 14;
const SVG_VIEWBOX_BASE_SIZE = 24;

const WEBCAM_OUTLINE_PATH =
	'M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z';

function renderCanvasIcon(
	size: number,
	paint: (ctx: CanvasRenderingContext2D, size: number) => void
): ImageData {
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = size * CANVAS_PIXEL_RATIO;
	const ctx = canvas.getContext('2d')!;
	ctx.scale(CANVAS_PIXEL_RATIO, CANVAS_PIXEL_RATIO);
	paint(ctx, size);
	return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

export function addImages(map: MapLibre, t: MapTheme): void {
	const put = (name: string, data: ImageData) => {
		if (map.hasImage(name)) map.removeImage(name);
		map.addImage(name, data, { pixelRatio: CANVAS_PIXEL_RATIO });
	};

	for (const d of Object.keys(t.piste) as Difficulty[]) {
		put(
			`badge-${d}`,
			renderCanvasIcon(PISTE_BADGE_SIZE, (ctx, s) => {
				ctx.beginPath();
				ctx.arc(s / 2, s / 2, s / 2 - 1, 0, Math.PI * 2);
				ctx.fillStyle = t.casing;
				ctx.fill();
				ctx.beginPath();
				ctx.arc(s / 2, s / 2, s / 2 - 3, 0, Math.PI * 2);
				ctx.fillStyle = t.piste[d];
				ctx.fill();
			})
		);
	}

	put(
		'arrow',
		renderCanvasIcon(DIRECTION_ARROW_SIZE, (ctx, s) => {
			ctx.strokeStyle = '#ffffff';
			ctx.lineWidth = 2.2;
			ctx.lineCap = 'round';
			ctx.lineJoin = 'round';
			ctx.beginPath();
			ctx.moveTo(s * 0.36, s * 0.24);
			ctx.lineTo(s * 0.66, s * 0.5);
			ctx.lineTo(s * 0.36, s * 0.76);
			ctx.stroke();
		})
	);

	put(
		'peak',
		renderCanvasIcon(MOUNTAIN_PEAK_ICON_SIZE, (ctx, s) => {
			ctx.fillStyle = t.labelSoft;
			ctx.beginPath();
			ctx.moveTo(s / 2, 1.5);
			ctx.lineTo(s - 1, s - 1.5);
			ctx.lineTo(1, s - 1.5);
			ctx.closePath();
			ctx.fill();
		})
	);

	put(
		'dot',
		renderCanvasIcon(PLACE_DOT_ICON_SIZE, (ctx, s) => {
			ctx.beginPath();
			ctx.arc(s / 2, s / 2, 3.2, 0, Math.PI * 2);
			ctx.fillStyle = t.label;
			ctx.fill();
			ctx.lineWidth = 1.4;
			ctx.strokeStyle = t.halo;
			ctx.stroke();
		})
	);

	const cameraOutline = new Path2D(WEBCAM_OUTLINE_PATH);
	put(
		'webcam',
		renderCanvasIcon(WEBCAM_DISC_SIZE, (ctx, s) => {
			ctx.beginPath();
			ctx.arc(s / 2, s / 2, s / 2 - 1, 0, Math.PI * 2);
			ctx.fillStyle = t.casing;
			ctx.fill();
			ctx.lineWidth = 1.6;
			ctx.strokeStyle = t.route;
			ctx.stroke();
			ctx.translate((s - WEBCAM_GLYPH_SIZE) / 2, (s - WEBCAM_GLYPH_SIZE) / 2);
			ctx.scale(
				WEBCAM_GLYPH_SIZE / SVG_VIEWBOX_BASE_SIZE,
				WEBCAM_GLYPH_SIZE / SVG_VIEWBOX_BASE_SIZE
			);
			ctx.lineWidth = 2.4;
			ctx.lineJoin = 'round';
			ctx.stroke(cameraOutline);
		})
	);
}
