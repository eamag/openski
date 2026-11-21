import sharp from 'sharp';
import { SCORE_STOPS, scoreColor } from '../src/lib/conditions/model.ts';

const OG_IMAGE_WIDTH = 1200;
const OG_IMAGE_HEIGHT = 630;
const INK = '#131722';
const SOFT = '#a3adbf';
const ACCENT = '#a78bfa';
const FONT = `font-family="Avenir Next, Helvetica Neue, Arial, sans-serif"`;

const sampleDayPisteHourlyScores = [22, 34, 52, 68, 84, 93, 90, 74, 58];
const pisteForecastBarsSvg = sampleDayPisteHourlyScores
	.map(
		(score, i) =>
			`<rect x="${i * 17}" y="${26 - score * 0.22}" width="13" height="${22 + score * 0.22}" rx="4" fill="${scoreColor(score)}"/>`
	)
	.join('');

const sampleQueuePeopleCoordinates = [
	[14, 30],
	[34, 26],
	[52, 32],
	[70, 27],
	[90, 31],
	[108, 25],
	[126, 30]
];
const queueDetectionArtSvg =
	`<rect width="150" height="64" rx="10" fill="#dfe7f1"/>` +
	`<path d="M0 44 Q40 30 80 40 T150 30 V54 a10 10 0 0 1 -10 10 H10 a10 10 0 0 1 -10 -10z" fill="#f7fafd"/>` +
	sampleQueuePeopleCoordinates
		.map(
			([x, y]) =>
				`<circle cx="${x + 5}" cy="${y + 4}" r="3" fill="#2a3242"/><rect x="${x + 2}" y="${y + 7}" width="6" height="11" rx="2" fill="#2a3242"/>` +
				`<rect x="${x - 2}" y="${y - 2}" width="14" height="23" fill="none" stroke="#22c55e" stroke-width="2"/>`
		)
		.join('');

const snowboardRouteSvg =
	`<path d="M10 52 C40 52 34 14 64 14 S92 50 140 12" fill="none" stroke="${ACCENT}" stroke-width="6" stroke-linecap="round"/>` +
	`<circle cx="10" cy="52" r="8" fill="${INK}" stroke="#fff" stroke-width="4"/>` +
	`<circle cx="140" cy="12" r="8" fill="${ACCENT}" stroke="#fff" stroke-width="4"/>`;

const featureHighlightRows: [string, string, string][] = [
	[
		pisteForecastBarsSvg,
		'Every piste, hour by hour',
		'Ice, slush, sun, flat light and wind: a forecast for each run'
	],
	[
		queueDetectionArtSvg,
		'Lift queues counted from the webcams',
		'With the picture, so you can check the count yourself'
	],
	[
		snowboardRouteSvg,
		'Routes that skip flats and drag lifts',
		'Made for snowboards, on the colour you ride'
	]
];

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" viewBox="0 0 ${OG_IMAGE_WIDTH} ${OG_IMAGE_HEIGHT}">
	<defs>
		<radialGradient id="glow" cx="88%" cy="6%" r="75%">
			<stop offset="0" stop-color="#7c3aed" stop-opacity="0.55"/>
			<stop offset="1" stop-color="#7c3aed" stop-opacity="0"/>
		</radialGradient>
		<linearGradient id="ramp" x1="0" x2="1">
			${SCORE_STOPS.map(([at, colour]) => `<stop offset="${at / 100}" stop-color="${colour}"/>`).join('')}
		</linearGradient>
	</defs>
	<rect width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" fill="${INK}"/>
	<rect width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" fill="url(#glow)"/>
	<rect y="${OG_IMAGE_HEIGHT - 10}" width="${OG_IMAGE_WIDTH}" height="10" fill="url(#ramp)"/>

	<g transform="translate(72 64) scale(0.105)">
		<rect width="512" height="512" rx="116" fill="#7c3aed"/>
		<path d="M92 376 228 142l70 112 42-58 80 180z" fill="#fff"/>
		<path d="M228 142c26 62-44 96-10 150s92 34 62 84" fill="none" stroke="#7c3aed" stroke-width="22" stroke-linecap="round"/>
	</g>
	<text x="142" y="102" ${FONT} font-size="30" font-weight="700" fill="#fff">openski.org</text>

	<text x="72" y="212" ${FONT} font-size="66" font-weight="700" fill="#fff" letter-spacing="-1.5">What other piste maps</text>
	<text x="72" y="286" ${FONT} font-size="66" font-weight="700" fill="${ACCENT}" letter-spacing="-1.5">don't tell you</text>

	${featureHighlightRows
		.map(
			([art, title, text], i) => `<g transform="translate(72 ${338 + i * 88})">
		<g>${art}</g>
		<text x="186" y="27" ${FONT} font-size="30" font-weight="600" fill="#fff">${title}</text>
		<text x="186" y="58" ${FONT} font-size="21" font-weight="500" fill="${SOFT}">${text}</text>
	</g>`
		)
		.join('\n\t')}

	<text x="${OG_IMAGE_WIDTH - 72}" y="102" ${FONT} font-size="24" font-weight="500" fill="${SOFT}" text-anchor="end">free · no install · works offline</text>
</svg>`;

await sharp(Buffer.from(svg))
	.png({ compressionLevel: 9, palette: true, quality: 90 })
	.toFile('static/og.png');
const meta = await sharp('static/og.png').metadata();
console.log(`static/og.png: ${meta.width}×${meta.height}`);
