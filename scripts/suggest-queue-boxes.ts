#!/usr/bin/env bun
import { APP_USER_AGENT } from '#lib/identity.ts';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const OUT_DIR = 'data/cache/queue-suggest';
const CACHE_DIR = join(OUT_DIR, 'cache');
const DET_VERSION = 'v2-native+2x';

type Box = [number, number, number, number];
interface Region {
	id: string;
	lift: string | null;
	label: string;
	box: Box;
	upscale: number;
	blur?: number;
}
interface PanomaxSource {
	kind: 'panomax';
	panomaxId: number;
	resolution: string;
	tile: { width: number; height: number; rows: number; cols: number };
	composite: { width: number; height: number };
}
interface CameraEntry {
	camera: string;
	skip?: string;
	source: PanomaxSource | { kind: 'still' };
	regions: Region[];
	heldRegions?: Region[];
}
interface Frame {
	date: string;
	time: string;
}
interface Detection {
	x: number;
	y: number;
	w: number;
	h: number;
	score: number;
}
interface Candidate {
	box: Box;
	score: number;
	framesSeen: number;
	meanPeople: number;
	fracFrames: number;
	cv: number;
}
interface FrameDets {
	frame: Frame;
	dets: Detection[];
	seconds: number;
	brightness: number;
}

const DEFAULT_RESORT_SLUG = 'soelden';
const DEFAULT_CONCURRENT_PROCESSES = 4;
const DEFAULT_DETECTION_CONFIDENCE_THRESHOLD = 0.15;
const RESORT_OPERATING_HOURS_START = '09:00';
const RESORT_OPERATING_HOURS_END = '16:00';
const STATIC_OBJECT_FILTER_DAWN_START = '07:30';
const STATIC_OBJECT_FILTER_DAWN_END = '08:30';
const MAX_CONCURRENT_TILE_REQUESTS = 2;

sharp.concurrency(1);
sharp.cache(false);

const flags = (() => {
	const a = process.argv.slice(2);
	const pos: string[] = [];
	const f: Record<string, string> = {};
	for (let i = 0; i < a.length; i++) {
		if (a[i].startsWith('--'))
			f[a[i].slice(2)] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : '1';
		else pos.push(a[i]);
	}
	return { pos, f };
})();
const resort = flags.pos[0] || DEFAULT_RESORT_SLUG;
const cameraArg = flags.pos[1] || '';
const framesCap = flags.f.frames ? parseInt(flags.f.frames, 10) : Infinity;
const procs = flags.f.procs ? parseInt(flags.f.procs, 10) : DEFAULT_CONCURRENT_PROCESSES;
const CONF = flags.f.conf ? parseFloat(flags.f.conf) : DEFAULT_DETECTION_CONFIDENCE_THRESHOLD;
const TAG = cameraArg ? `[${cameraArg.replace('-panomax', '')}] ` : '';
const log = (...a: unknown[]) => console.log(TAG + a.join(' '));
const warn = (...a: unknown[]) => console.warn(TAG + a.join(' '));

const ensureDir = (p: string) => mkdirSync(p, { recursive: true });

async function limitConcurrency<T, R>(
	items: T[],
	limit: number,
	fn: (t: T) => Promise<R>
): Promise<R[]> {
	const results: R[] = new Array(items.length);
	let i = 0;
	const worker = async () => {
		while (i < items.length) {
			const idx = i++;
			results[idx] = await fn(items[idx]);
		}
	};
	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
	return results;
}

async function getDayFrames(panomaxId: number, date?: string): Promise<Frame[]> {
	const res = date
		? await fetch(`https://api.panomax.com/1.0/cams/${panomaxId}/images/day/${date}`, {
				headers: { 'User-Agent': APP_USER_AGENT }
			})
		: await fetch('https://delivery.panomax.com/interfaces/json/PanoAction.GetRecentDay', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'User-Agent': APP_USER_AGENT },
				body: JSON.stringify({ camId: panomaxId })
			});
	if (!res.ok) throw new Error(`Panomax day list HTTP ${res.status}`);
	const data = (await res.json()) as {
		date?: string;
		panodate?: string;
		images?: { time?: string; image_available?: boolean; available?: boolean }[];
		imagetimes?: string[];
	};
	const day = date ? data?.date : data?.panodate;
	if (!day) return [];
	const times: string[] = Array.isArray(data.images)
		? data.images
				.filter((i) => i?.time && i.image_available !== false && i.available !== false)
				.map((i) => String(i.time))
		: data.imagetimes || [];
	return times.map((t) => ({ date: day, time: t.slice(0, 5) }));
}

function tileJobs(source: PanomaxSource, frame: Frame) {
	const [yyyy, mm, dd] = frame.date.split('-');
	const [hh, mi] = frame.time.split(':');
	const jobs: { col: number; row: number; url: string; cache: string }[] = [];
	for (let r = 0; r < source.tile.rows; r++)
		for (let c = 0; c < source.tile.cols; c++) {
			jobs.push({
				col: c,
				row: r,
				url: `https://panodata.panomax.com/cams/${source.panomaxId}/${yyyy}/${mm}/${dd}/${hh}-${mi}-00_${source.resolution}_${c}_${r}.jpg`,
				cache: join(
					CACHE_DIR,
					String(source.panomaxId),
					frame.date,
					frame.time.replace(':', '-'),
					`${source.resolution}_${c}_${r}.jpg`
				)
			});
		}
	return jobs;
}

async function fetchCached(url: string, cache: string): Promise<Buffer> {
	if (existsSync(cache)) return readFileSync(cache);
	if (flags.f.times || flags.f.rescore) throw new Error(`not cached: ${url}`);
	let lastErr: unknown;
	for (let attempt = 0; attempt < 2; attempt++) {
		try {
			const res = await fetch(url, { headers: { 'User-Agent': APP_USER_AGENT } });
			if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
			const buf = Buffer.from(await res.arrayBuffer());
			ensureDir(dirname(cache));
			writeFileSync(cache, buf);
			return buf;
		} catch (e) {
			lastErr = e;
			if (String(e).includes('HTTP 404')) break;
		}
	}
	throw lastErr;
}

async function assembleComposite(source: PanomaxSource, frame: Frame) {
	const { width: tw, height: th } = source.tile;
	const jobs = tileJobs(source, frame);
	const bufs = await limitConcurrency(jobs, MAX_CONCURRENT_TILE_REQUESTS, async (j) => {
		try {
			return await fetchCached(j.url, j.cache);
		} catch {
			return null;
		}
	});
	const missing = bufs.filter((b) => !b).length;
	if (missing) throw new Error(`${missing}/${jobs.length} tiles missing for ${frame.time}`);
	const tiles = jobs.map((j, i) => ({ input: bufs[i]!, left: j.col * tw, top: j.row * th }));
	const { data, info } = await sharp({
		create: {
			width: source.composite.width,
			height: source.composite.height,
			channels: 3,
			background: { r: 0, g: 0, b: 0 }
		}
	})
		.composite(tiles)
		.removeAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	if (info.channels !== 3) throw new Error(`composite has ${info.channels} channels, expected 3`);
	return { data, width: info.width, height: info.height };
}

function pickFrames(all: Frame[]): { day: Frame[]; early: Frame[] } {
	const operatingFrames = all.filter(
		(f) => f.time >= RESORT_OPERATING_HOURS_START && f.time <= RESORT_OPERATING_HOURS_END
	);
	let day = operatingFrames;
	if (operatingFrames.length > framesCap) {
		const idx = new Set<number>();
		for (let i = 0; i < framesCap; i++)
			idx.add(Math.round((i * (operatingFrames.length - 1)) / Math.max(1, framesCap - 1)));
		day = [...idx].sort((a, b) => a - b).map((i) => operatingFrames[i]);
	}
	const dawnFrames = all.filter(
		(f) => f.time >= STATIC_OBJECT_FILTER_DAWN_START && f.time < STATIC_OBJECT_FILTER_DAWN_END
	);
	const early = dawnFrames.length
		? [
				...new Map(
					[
						dawnFrames[0],
						dawnFrames[Math.floor(dawnFrames.length / 2)],
						dawnFrames[dawnFrames.length - 1]
					].map((f) => [f.time, f])
				).values()
			]
		: [];
	return { day, early };
}

interface Raw {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
	score: number;
}

function nms(boxes: Raw[], thr: number): Raw[] {
	boxes.sort((a, b) => b.score - a.score);
	const keep: Raw[] = [];
	for (const b of boxes) {
		let dup = false;
		for (const k of keep) {
			const w = Math.min(b.x2, k.x2) - Math.max(b.x1, k.x1),
				h = Math.min(b.y2, k.y2) - Math.max(b.y1, k.y1);
			if (w > 0 && h > 0) {
				const inter = w * h;
				if (inter / ((b.x2 - b.x1) * (b.y2 - b.y1) + (k.x2 - k.x1) * (k.y2 - k.y1) - inter) > thr) {
					dup = true;
					break;
				}
			}
		}
		if (!dup) keep.push(b);
	}
	return keep;
}

async function loadOrtSession(modelPath: string) {
	const ort = await import('onnxruntime-web/wasm');
	ort.env.wasm.numThreads = flags.f.threads ? parseInt(flags.f.threads, 10) : 1;
	ort.env.wasm.wasmPaths = join(process.cwd(), 'node_modules/onnxruntime-web/dist/');
	const session = await ort.InferenceSession.create(new Uint8Array(readFileSync(modelPath)), {
		executionProviders: ['wasm']
	});
	return {
		ort,
		session,
		inputName: session.inputNames[0],
		outputName: session.outputNames[0],
		input: new Float32Array(3 * 640 * 640)
	};
}
type Ort = Awaited<ReturnType<typeof loadOrtSession>>;

const WIN = 640,
	STEP = 512;
function starts(from: number, len: number): number[] {
	const s: number[] = [];
	for (let c = from; c + WIN <= len; c += STEP) s.push(c);
	if (!s.length || s[s.length - 1] + WIN < len) s.push(Math.max(0, len - WIN));
	return [...new Set(s)];
}

const prof = { pre: 0, run: 0, post: 0, n: 0 };
async function runWindow(
	o: Ort,
	buf: Buffer,
	W: number,
	H: number,
	xs: number,
	ys: number,
	out: Raw[],
	map: (x: number, y: number) => [number, number]
) {
	const tA = performance.now();
	const winW = Math.min(WIN, W - xs),
		winH = Math.min(WIN, H - ys);
	const padLeft = Math.floor((WIN - winW) / 2),
		padTop = Math.floor((WIN - winH) / 2);
	const inp = o.input,
		cs = WIN * WIN;
	inp.fill(114 / 255);
	for (let row = 0; row < winH; row++) {
		let src = ((ys + row) * W + xs) * 3,
			dst = (padTop + row) * WIN + padLeft;
		for (let col = 0; col < winW; col++, src += 3, dst++) {
			inp[dst] = buf[src] / 255;
			inp[cs + dst] = buf[src + 1] / 255;
			inp[2 * cs + dst] = buf[src + 2] / 255;
		}
	}
	const tB = performance.now();
	const res = await o.session.run({
		[o.inputName]: new o.ort.Tensor('float32', inp, [1, 3, WIN, WIN])
	});
	const tC = performance.now();
	const d = res[o.outputName].data as Float32Array;
	for (let i = 0; i < 8400; i++) {
		const score = d[4 * 8400 + i];
		if (score < CONF) continue;
		const cx = d[i] - padLeft + xs,
			cy = d[8400 + i] - padTop + ys,
			w = d[2 * 8400 + i],
			h = d[3 * 8400 + i];
		const [x1, y1] = map(cx - w / 2, cy - h / 2),
			[x2, y2] = map(cx + w / 2, cy + h / 2);
		out.push({ x1, y1, x2, y2, score });
	}
	prof.pre += tB - tA;
	prof.run += tC - tB;
	prof.post += performance.now() - tC;
	prof.n++;
}

async function detectFrame(o: Ort, rgb: Buffer, W: number, H: number): Promise<Detection[]> {
	const all: Raw[] = [];
	const yTop = Math.floor(H / 3);
	const xs1 = starts(0, W);
	for (const ys of starts(yTop, H))
		for (const xs of xs1) await runWindow(o, rgb, W, H, xs, ys, all, (x, y) => [x, y]);

	const yHalf = Math.floor(H / 2),
		UP = 2;
	const xs2 = starts(0, W * UP);
	for (const ys of starts(yHalf * UP, H * UP)) {
		const srcTop = ys / UP;
		const strip = await sharp(rgb, { raw: { width: W, height: H, channels: 3 } })
			.extract({ left: 0, top: srcTop, width: W, height: WIN / UP })
			.resize(W * UP, WIN, { fit: 'fill', kernel: 'lanczos3' })
			.raw()
			.toBuffer();
		for (const xs of xs2)
			await runWindow(o, strip, W * UP, WIN, xs, 0, all, (x, y) => [x / UP, srcTop + y / UP]);
	}
	if (flags.f.profile)
		log(
			`profile: ${prof.n} windows, pre ${(prof.pre / prof.n).toFixed(0)} ms, run ${(prof.run / prof.n).toFixed(0)} ms, post ${(prof.post / prof.n).toFixed(0)} ms, raw boxes ${all.length}`
		);
	return nms(all, 0.45).map((b) => ({
		x: b.x1,
		y: b.y1,
		w: b.x2 - b.x1,
		h: b.y2 - b.y1,
		score: b.score
	}));
}

function iouBox(a: Box, b: Box) {
	const w = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])),
		h = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
	const inter = w * h;
	return inter / ((a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter || 1);
}
const centerInside = (inner: Box, outer: Box) => {
	const cx = (inner[0] + inner[2]) / 2,
		cy = (inner[1] + inner[3]) / 2;
	return cx >= outer[0] && cx <= outer[2] && cy >= outer[1] && cy <= outer[3];
};
const touches = (a: Box, b: Box) => centerInside(a, b) || iouBox(a, b) >= 0.1;
const detBox = (d: Detection): Box => [d.x, d.y, d.x + d.w, d.y + d.h];
const detCenter = (d: Detection): [number, number] => [d.x + d.w / 2, d.y + d.h / 2];

function dropStatic(early: FrameDets[], day: FrameDets[]): { kept: FrameDets[]; dropped: number } {
	const all = [...early, ...day];
	const centres = all.map((fd) => fd.dets.map(detCenter));
	let dropped = 0;
	const kept = day.map((fd) => {
		const own = all.indexOf(fd);
		return {
			...fd,
			dets: fd.dets.filter((d) => {
				const [cx, cy] = detCenter(d),
					r = 1.5 * Math.max(d.w, d.h);
				let hits = 0;
				for (let g = 0; g < all.length; g++)
					if (g === own || centres[g].some(([x, y]) => Math.hypot(x - cx, y - cy) <= r)) hits++;
				const isStatic = hits / all.length >= 0.7;
				if (isStatic) dropped++;
				return !isStatic;
			})
		};
	});
	return { kept, dropped };
}

function cluster(day: FrameDets[], W: number, H: number): Candidate[] {
	const cell = 40,
		Wc = Math.ceil(W / cell),
		Hc = Math.ceil(H / cell),
		n = Math.max(1, day.length);
	const people = new Float32Array(Wc * Hc),
		seen = new Uint16Array(Wc * Hc);
	for (const fd of day) {
		const mark = new Uint8Array(Wc * Hc);
		for (const d of fd.dets) {
			const [cx, cy] = detCenter(d);
			const gx = Math.min(Wc - 1, Math.max(0, Math.floor(cx / cell))),
				gy = Math.min(Hc - 1, Math.max(0, Math.floor(cy / cell)));
			people[gy * Wc + gx] += 1;
			for (let dy = -1; dy <= 1; dy++)
				for (let dx = -1; dx <= 1; dx++) {
					const x = gx + dx,
						y = gy + dy;
					if (x >= 0 && y >= 0 && x < Wc && y < Hc) mark[y * Wc + x] = 1;
				}
		}
		for (let i = 0; i < mark.length; i++) seen[i] += mark[i];
	}
	const score = new Float32Array(Wc * Hc);
	for (let i = 0; i < score.length; i++)
		score[i] = (seen[i] / n) * (1 + Math.min(people[i] / n, 5));

	const thresh = 0.25,
		visited = new Uint8Array(Wc * Hc);
	const comps: number[][] = [];
	for (let s = 0; s < score.length; s++) {
		if (visited[s] || score[s] < thresh) continue;
		const cells: number[] = [],
			q = [s];
		visited[s] = 1;
		while (q.length) {
			const cur = q.pop()!;
			cells.push(cur);
			const cx = cur % Wc,
				cy = (cur / Wc) | 0;
			for (const [dx, dy] of [
				[1, 0],
				[-1, 0],
				[0, 1],
				[0, -1]
			]) {
				const nx = cx + dx,
					ny = cy + dy;
				if (nx < 0 || ny < 0 || nx >= Wc || ny >= Hc) continue;
				const ni = ny * Wc + nx;
				if (!visited[ni] && score[ni] >= thresh * 0.6) {
					visited[ni] = 1;
					q.push(ni);
				}
			}
		}
		comps.push(cells);
	}
	const pad = 2;
	return comps
		.map((cells) => {
			let minx = 1e9,
				miny = 1e9,
				maxx = 0,
				maxy = 0;
			for (const i of cells) {
				const gx = i % Wc,
					gy = (i / Wc) | 0;
				minx = Math.min(minx, gx);
				miny = Math.min(miny, gy);
				maxx = Math.max(maxx, gx);
				maxy = Math.max(maxy, gy);
			}
			const box: Box = [
				Math.max(0, (minx - pad) * cell),
				Math.max(0, (miny - pad) * cell),
				Math.min(W, (maxx + 1 + pad) * cell),
				Math.min(H, (maxy + 1 + pad) * cell)
			];
			const counts = day.map(
				(fd) =>
					fd.dets.filter((d) => {
						const [cx, cy] = detCenter(d);
						return cx >= box[0] && cx <= box[2] && cy >= box[1] && cy <= box[3];
					}).length
			);
			const total = counts.reduce((a, b) => a + b, 0),
				mean = total / n,
				frames = counts.filter((c) => c > 0).length;
			const sd = Math.sqrt(counts.reduce((a, c) => a + (c - mean) ** 2, 0) / n);
			const cv = mean ? sd / mean : 0;
			return {
				box,
				score: mean * (frames / n) * (1 + cv),
				framesSeen: frames,
				meanPeople: mean,
				fracFrames: frames / n,
				cv
			};
		})
		.filter((c) => c.framesSeen >= 3 && c.box[2] - c.box[0] >= 40 && c.box[3] - c.box[1] >= 40)
		.sort((a, b) => b.score - a.score);
}

const rects = (boxes: Box[], color: string, sw: number, k: number, ox = 0, oy = 0) =>
	boxes
		.map(
			(b) =>
				`<rect x="${(b[0] - ox) * k}" y="${(b[1] - oy) * k}" width="${(b[2] - b[0]) * k}" height="${(b[3] - b[1]) * k}" fill="none" stroke="${color}" stroke-width="${sw}"/>`
		)
		.join('');

async function saveTop(
	cam: CameraEntry,
	source: PanomaxSource,
	frame: Frame,
	hand: Box[],
	top5: Box[],
	dets: Detection[]
) {
	const comp = await assembleComposite(source, frame);
	const W = comp.width,
		H = comp.height,
		maxW = 3000,
		k = Math.min(1, maxW / W);
	const oW = Math.round(W * k),
		oH = Math.round(H * k);
	const svg = `<svg width="${oW}" height="${oH}" xmlns="http://www.w3.org/2000/svg">${rects(hand, '#00ff00', 4, k)}${rects(top5, '#ff0000', 4, k)}</svg>`;
	const raw = () => sharp(comp.data, { raw: { width: W, height: H, channels: 3 } });
	await raw()
		.resize(oW, oH)
		.composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
		.jpeg({ quality: 85 })
		.toFile(join(OUT_DIR, `${cam.camera}-top.jpg`));
	const focus = top5[0] ?? hand[0];
	if (focus) {
		const px = 150,
			x0 = Math.max(0, Math.floor(focus[0] - px)),
			y0 = Math.max(0, Math.floor(focus[1] - px));
		const x1 = Math.min(W, Math.ceil(focus[2] + px)),
			y1 = Math.min(H, Math.ceil(focus[3] + px));
		const zoom = Math.min(2, 2400 / (x1 - x0));
		const cw = Math.round((x1 - x0) * zoom),
			ch = Math.round((y1 - y0) * zoom);
		const inView = dets
			.filter((d) => d.x + d.w >= x0 && d.x <= x1 && d.y + d.h >= y0 && d.y <= y1)
			.map(detBox);
		const s2 = `<svg width="${cw}" height="${ch}" xmlns="http://www.w3.org/2000/svg">${rects(hand, '#00ff00', 3, zoom, x0, y0)}${rects(top5, '#ff0000', 3, zoom, x0, y0)}${rects(inView, '#ffe000', 2, zoom, x0, y0)}</svg>`;
		await raw()
			.extract({ left: x0, top: y0, width: x1 - x0, height: y1 - y0 })
			.resize(cw, ch, { kernel: 'lanczos3' })
			.composite([{ input: Buffer.from(s2), top: 0, left: 0 }])
			.jpeg({ quality: 88 })
			.toFile(join(OUT_DIR, `${cam.camera}-top-crop.jpg`));
	}
}

const detCachePath = (id: number, f: Frame) =>
	join(
		CACHE_DIR,
		'dets',
		DET_VERSION,
		`c${CONF}`,
		String(id),
		`${f.date}_${f.time.replace(':', '-')}.json`
	);

async function detectCached(
	o: Ort | null,
	source: PanomaxSource,
	frame: Frame
): Promise<FrameDets | null> {
	const p = detCachePath(source.panomaxId, frame);
	if (existsSync(p)) return JSON.parse(readFileSync(p, 'utf8'));
	const t0 = Date.now();
	let comp;
	try {
		comp = await assembleComposite(source, frame);
	} catch (e) {
		warn(`skip frame ${frame.time}: ${(e as Error).message}`);
		return null;
	}
	let sum = 0;
	for (let i = 0; i < comp.data.length; i += 997) sum += comp.data[i];
	const brightness = sum / Math.ceil(comp.data.length / 997);
	const dets = await detectFrame(o!, comp.data, comp.width, comp.height);
	const rec: FrameDets = { frame, dets, seconds: (Date.now() - t0) / 1000, brightness };
	ensureDir(dirname(p));
	writeFileSync(p, JSON.stringify(rec));
	return rec;
}

async function processCamera(cam: CameraEntry, o: Ort) {
	const source = cam.source as PanomaxSource;
	const W = source.composite.width,
		H = source.composite.height;
	log(`=== ${cam.camera} (panomax ${source.panomaxId}) ===`);
	const earlyRecs: FrameDets[] = [],
		dayRecs: FrameDets[] = [];
	if (flags.f.rescore) {
		const dir = join(CACHE_DIR, 'dets', DET_VERSION, `c${CONF}`, String(source.panomaxId));
		const recs: FrameDets[] = readdirSync(dir)
			.filter((f) => f.endsWith('.json'))
			.sort()
			.map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));
		for (const r of recs) {
			if (r.frame.time >= '09:00' && r.frame.time <= '16:00') dayRecs.push(r);
			else if (r.frame.time >= '07:30' && r.frame.time < '08:30' && r.brightness >= 40)
				earlyRecs.push(r);
		}
		log(
			`rescoring from cache: early ${earlyRecs.map((r) => r.frame.time).join(' ')} | day ${dayRecs.length}: ${dayRecs.map((r) => r.frame.time).join(' ')}`
		);
	} else {
		let day: Frame[], early: Frame[];
		if (flags.f.times) {
			const mk = (s: string) =>
				s
					.split(',')
					.filter(Boolean)
					.map((time) => ({ date: flags.f.date, time }));
			day = mk(flags.f.times);
			early = mk(flags.f.early || '');
		} else ({ day, early } = pickFrames(await getDayFrames(source.panomaxId, flags.f.date)));
		log(
			`early ${early.map((f) => f.time).join(' ') || '-'} | day ${day.length}: ${day.map((f) => f.time).join(' ')}`
		);
		for (const [frames, into] of [
			[early, earlyRecs],
			[day, dayRecs]
		] as const) {
			for (const f of frames) {
				const rec = await detectCached(o, source, f);
				if (!rec) continue;
				if (into === earlyRecs && rec.brightness < 40) {
					log(`  ${f.time} early frame is dark (mean ${rec.brightness.toFixed(0)}), not used`);
					continue;
				}
				into.push(rec);
				log(`  ${f.time} people=${rec.dets.length} (${rec.seconds.toFixed(1)}s)`);
			}
		}
	}
	if (dayRecs.length < 8) warn(`only ${dayRecs.length} usable frames 09:00-16:00`);
	const { kept, dropped } = dropStatic(earlyRecs, dayRecs);
	log(`static detections dropped: ${dropped} of ${dayRecs.reduce((a, r) => a + r.dets.length, 0)}`);
	const ranked = cluster(kept, W, H);
	const candidates = ranked.slice(0, 20);
	const seconds = [...earlyRecs, ...dayRecs].reduce((s, r) => s + r.seconds, 0);

	const hand = cam.regions.map((r) => ({ id: r.id, box: r.box }));
	const top5 = candidates.slice(0, 5);
	const handOut = hand.map((h) => {
		const idx = ranked.findIndex((c) => touches(h.box, c.box));
		return { ...h, rank: idx < 0 ? null : idx + 1, hit: idx >= 0 && idx < 5 };
	});
	const recallHits = handOut.filter((h) => h.hit).length;
	const precHits = top5.filter((c) => hand.some((h) => touches(h.box, c.box))).length;
	log(
		`hand=${hand.length} candidates=${candidates.length}/${ranked.length} recall@5=${recallHits}/${hand.length} precision@5=${precHits}/${top5.length} ranks=${handOut.map((h) => `${h.id}:${h.rank ?? 'none'}`).join(' ')} seconds=${seconds.toFixed(1)}`
	);

	const best = dayRecs.reduce((a, b) => {
		const n = (r: FrameDets) => kept.find((k) => k.frame.time === r.frame.time)!.dets.length;
		return n(b) > n(a) ? b : a;
	}, dayRecs[0]);
	const imageCams = flags.f.images ? flags.f.images.split(',') : null;
	if (best && (!imageCams || imageCams.includes(cam.camera)))
		await saveTop(
			cam,
			source,
			best.frame,
			hand.map((h) => h.box),
			top5.map((c) => c.box),
			kept.find((k) => k.frame.time === best.frame.time)!.dets
		);
	const out = {
		camera: cam.camera,
		panomaxId: source.panomaxId,
		composite: { width: W, height: H },
		conf: CONF,
		dayFrames: dayRecs.map((r) => r.frame.time),
		earlyFrames: earlyRecs.map((r) => r.frame.time),
		peoplePerDayFrame: dayRecs.map((r) => r.dets.length),
		peopleAfterStatic: kept.map((k) => k.dets.length),
		staticDropped: dropped,
		bestFrame: best?.frame.time ?? null,
		candidates: ranked,
		hand: handOut,
		metrics: {
			handRegions: hand.length,
			candidates: candidates.length,
			candidatesTotal: ranked.length,
			recallHits,
			precisionHits: precHits,
			top5: top5.length,
			seconds
		}
	};
	writeFileSync(join(OUT_DIR, `${cam.camera}.json`), JSON.stringify(out, null, 2));
	return out;
}

async function sanity(cam: CameraEntry, o: Ort, regionId: string, at: string) {
	const source = cam.source as PanomaxSource;
	const region = [...cam.regions, ...(cam.heldRegions ?? [])].find((r) => r.id === regionId);
	if (!region) throw new Error(`no region ${regionId} on ${cam.camera}`);
	const frames = await getDayFrames(source.panomaxId, flags.f.date);
	const frame = frames.find((f) => f.time === at) ?? frames[frames.length - 2];
	log(
		`sanity: frame ${frame.date} ${frame.time}, region ${region.id} ${JSON.stringify(region.box)} upscale ${region.upscale}`
	);
	const comp = await assembleComposite(source, frame);
	const t0 = Date.now();
	const dets = await detectFrame(o, comp.data, comp.width, comp.height);
	log(
		`full-frame pipeline: ${dets.length} people in the whole composite (${((Date.now() - t0) / 1000).toFixed(1)}s)`
	);
	const inside = dets.filter((d) => {
		const [cx, cy] = detCenter(d);
		return cx >= region.box[0] && cx <= region.box[2] && cy >= region.box[1] && cy <= region.box[3];
	});
	log(
		`  centres inside ${region.id}: ${inside.length}  ${inside.map((d) => `(${Math.round(d.x)},${Math.round(d.y)} ${Math.round(d.w)}x${Math.round(d.h)} ${d.score.toFixed(2)})`).join(' ')}`
	);

	const [x0, y0, x1, y1] = region.box;
	const sanityBlur = flags.f.blur != null ? parseFloat(flags.f.blur) : (region.blur ?? 2);
	const k = region.upscale,
		rw = Math.round((x1 - x0) * k),
		rh = Math.round((y1 - y0) * k);
	const crop = await sharp(comp.data, {
		raw: { width: comp.width, height: comp.height, channels: 3 }
	})
		.extract({ left: x0, top: y0, width: x1 - x0, height: y1 - y0 })
		.resize(rw, rh, { kernel: 'lanczos3' })
		.blur(sanityBlur >= 0.3 ? sanityBlur : false)
		.raw()
		.toBuffer();
	const cropDets: Raw[] = [];
	for (const ys of starts(0, rh))
		for (const xs of starts(0, rw))
			await runWindow(o, crop, rw, rh, xs, ys, cropDets, (x, y) => [x0 + x / k, y0 + y / k]);
	const prod = nms(cropDets, 0.45);
	log(`region-only at upscale ${k}: ${prod.length} people`);

	const zoom = 3,
		cw = Math.round((x1 - x0) * zoom),
		ch = Math.round((y1 - y0) * zoom);
	const toBox = (b: Raw): Box => [b.x1, b.y1, b.x2, b.y2];
	const svg = `<svg width="${cw}" height="${ch}" xmlns="http://www.w3.org/2000/svg">${rects(inside.map(detBox), '#ffe000', 3, zoom, x0, y0)}${rects(prod.map(toBox), '#00ffff', 2, zoom, x0, y0)}</svg>`;
	const file = join(OUT_DIR, `sanity-${cam.camera}-${region.id}.jpg`);
	await sharp(comp.data, { raw: { width: comp.width, height: comp.height, channels: 3 } })
		.extract({ left: x0, top: y0, width: x1 - x0, height: y1 - y0 })
		.resize(cw, ch, { kernel: 'lanczos3' })
		.composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
		.jpeg({ quality: 90 })
		.toFile(file);
	log(`saved ${file} (yellow = full-frame pipeline, cyan = region-only)`);
}

type CameraResult = Awaited<ReturnType<typeof processCamera>> | { camera: string; error: string };

function summarise(results: CameraResult[], t0: number) {
	console.log('\n| Camera | Hand | Cands | Recall@5 | Prec@5 | Sec |');
	const tot = { hand: 0, recallHits: 0, top5: 0, precHits: 0, candidates: 0, seconds: 0 };
	for (const r of results) {
		if ('error' in r) {
			console.log(`| ${r.camera} | ERR | | | | |`);
			continue;
		}
		const m = r.metrics;
		console.log(
			`| ${r.camera} | ${m.handRegions} | ${m.candidates} | ${m.recallHits}/${m.handRegions} | ${m.precisionHits}/${m.top5} | ${m.seconds.toFixed(0)} |`
		);
		tot.hand += m.handRegions;
		tot.recallHits += m.recallHits;
		tot.top5 += m.top5;
		tot.precHits += m.precisionHits;
		tot.candidates += m.candidates;
		tot.seconds += m.seconds;
	}
	console.log(
		`TOTAL hand=${tot.hand} candidates=${tot.candidates} recall=${tot.recallHits}/${tot.hand} precision=${tot.precHits}/${tot.top5} cpu-seconds=${tot.seconds.toFixed(0)} wall=${((Date.now() - t0) / 1000).toFixed(0)}s`
	);
	writeFileSync(join(OUT_DIR, 'summary.json'), JSON.stringify({ results, totals: tot }, null, 2));
}

async function main() {
	ensureDir(CACHE_DIR);
	const queues = JSON.parse(
		readFileSync(`data/webcams/${resort}-queues.json`, 'utf8')
	) as CameraEntry[];
	const panomax = queues.filter((c) => c.source.kind === 'panomax');
	const targets = cameraArg
		? panomax.filter((c) => c.camera === cameraArg)
		: panomax.filter((c) => c.regions?.length > 0);
	if (!targets.length) {
		console.error(
			cameraArg
				? `No Panomax camera ${cameraArg} in data/webcams/${resort}-queues.json.`
				: 'No Panomax cameras with hand-made regions found.'
		);
		process.exit(1);
	}

	if (flags.f.sanity) {
		const o = await loadOrtSession('static/models/yolo11n.onnx');
		return sanity(targets[0], o, flags.f.sanity, flags.f.at || '');
	}
	if (flags.f.rescore) {
		const t = Date.now();
		const results = [];
		for (const cam of targets) results.push(await processCamera(cam, null as unknown as Ort));
		if (!cameraArg) summarise(results, t);
		return;
	}
	if (cameraArg) {
		const o = await loadOrtSession('static/models/yolo11n.onnx');
		await processCamera(targets[0], o);
		return;
	}

	const plan: { cam: CameraEntry; day: Frame[]; early: Frame[] }[] = [];
	for (const cam of targets) {
		const { day, early } = pickFrames(
			await getDayFrames((cam.source as PanomaxSource).panomaxId, flags.f.date)
		);
		plan.push({ cam, day, early });
		console.log(
			`${cam.camera}: ${day.length} day frames (${day[0]?.time}..${day[day.length - 1]?.time}), ${early.length} early`
		);
	}
	let failed = 0;
	const downloaded = plan.map(({ cam, day, early }) => ({
		cam,
		day,
		early,
		ready: null as Promise<void> | null,
		seconds: 0
	}));
	const downloader = (async () => {
		for (const item of downloaded) {
			let release!: () => void;
			item.ready = new Promise<void>((r) => {
				release = r;
			});
			const t = Date.now();
			const jobs = [...item.early, ...item.day]
				.flatMap((f) => tileJobs(item.cam.source as PanomaxSource, f))
				.filter((j) => !existsSync(j.cache));
			await limitConcurrency(jobs, MAX_CONCURRENT_TILE_REQUESTS, async (j) => {
				try {
					await fetchCached(j.url, j.cache);
				} catch {
					failed++;
				}
			});
			item.seconds = (Date.now() - t) / 1000;
			console.log(
				`downloaded ${item.cam.camera}: ${jobs.length} tiles in ${item.seconds.toFixed(0)}s`
			);
			release();
		}
	})();

	const t0 = Date.now();
	let next = 0;
	const worker = async () => {
		while (next < downloaded.length) {
			const item = downloaded[next++];
			while (!item.ready) await new Promise((r) => setTimeout(r, 200));
			await item.ready;
			const { cam, day, early } = item;
			const p = Bun.spawn(
				[
					'bun',
					'scripts/suggest-queue-boxes.ts',
					resort,
					cam.camera,
					'--date',
					day[0]?.date ?? early[0]?.date,
					'--times',
					day.map((f) => f.time).join(','),
					'--early',
					early.map((f) => f.time).join(','),
					'--conf',
					String(CONF)
				],
				{ stdout: 'inherit', stderr: 'inherit' }
			);
			const code = await p.exited;
			if (code !== 0) console.error(`FAILED ${cam.camera} (exit ${code})`);
		}
	};
	await Promise.all([downloader, ...Array.from({ length: Math.min(procs, plan.length) }, worker)]);
	console.log(`tile downloads failed: ${failed} (frames with missing tiles are skipped)`);

	const results = targets.map((c): CameraResult => {
		const p = join(OUT_DIR, `${c.camera}.json`);
		return existsSync(p)
			? JSON.parse(readFileSync(p, 'utf8'))
			: { camera: c.camera, error: 'no output' };
	});
	summarise(results, t0);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
