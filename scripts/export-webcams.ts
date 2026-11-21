import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import type { CameraSource } from '../src/lib/queues/types.ts';

const args = process.argv.slice(2);
const unknown = args.filter((a) => a.startsWith('--') && !['--remote', '--production'].includes(a));
const production = args.includes('--production');
const remote = production || args.includes('--remote');
const resort = args.find((a) => !a.startsWith('--'));
if (!resort || unknown.length) {
	console.error('Usage: bun scripts/export-webcams.ts <resort> [--remote | --production]');
	process.exit(1);
}
const isSafeSlug = /^[a-z0-9-]+$/.test(resort);
if (!isSafeSlug) {
	console.error(`"${resort}" is not a resort slug`);
	process.exit(1);
}

interface WebcamRow {
	id: string;
	name: string;
	provider: string;
	camera_id: string;
	page_url: string;
	source: string;
}
interface RegionRow {
	webcam_id: string;
	lift_osm: string | null;
	lift_name: string | null;
	label: string;
	box: string;
	upscale: number;
}
interface D1Result<T> {
	success: boolean;
	results: T[];
}

const sql =
	`SELECT id, name, provider, camera_id, page_url, source FROM webcam WHERE resort = '${resort}' ORDER BY created_at, id; ` +
	`SELECT webcam_id, lift_osm, lift_name, label, box, upscale FROM queue_region ` +
	`WHERE status = 'confirmed' AND webcam_id IN (SELECT id FROM webcam WHERE resort = '${resort}') ORDER BY created_at, id;`;

const run = spawnSync(
	'bun',
	[
		'x',
		'wrangler',
		'd1',
		'execute',
		production ? 'openski' : 'taktiski',
		remote ? '--remote' : '--local',
		...(production ? ['--env', 'production'] : []),
		'--json',
		'--command',
		sql
	],
	{ encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
);
if (run.status !== 0) {
	console.error(run.stderr || run.stdout);
	console.error(`wrangler d1 execute failed (exit ${run.status})`);
	process.exit(1);
}
const jsonStartIndex = run.stdout.indexOf('[');
if (jsonStartIndex < 0) throw new Error(`No JSON in wrangler's output:\n${run.stdout}`);
const [webcams, regions] = JSON.parse(run.stdout.slice(jsonStartIndex)) as [
	D1Result<WebcamRow>,
	D1Result<RegionRow>
];
if (!webcams?.success || !regions?.success) throw new Error('wrangler reported a failed query');

const slugify = (text: string) =>
	text
		.toLowerCase()
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)+/g, '');

function generateUniqueId(baseId: string, takenIds: Set<string>): string {
	let candidateId = baseId;
	for (let n = 2; takenIds.has(candidateId); n++) candidateId = `${baseId}-${n}`;
	takenIds.add(candidateId);
	return candidateId;
}

const cameraIds = new Set<string>();
const contributedCameras = [];
const withoutRegions: string[] = [];
for (const webcam of webcams.results) {
	const webcamRegions = regions.results.filter((r) => r.webcam_id === webcam.id);
	if (!webcamRegions.length) {
		withoutRegions.push(webcam.name);
		continue;
	}
	const baseCameraSlug = `${slugify(webcam.name) || 'webcam'}-${webcam.provider}`;
	const qualifiedCameraId = cameraIds.has(baseCameraSlug)
		? `${baseCameraSlug}-${webcam.camera_id}`
		: baseCameraSlug;
	const camera = generateUniqueId(qualifiedCameraId, cameraIds);

	const regionIds = new Set<string>();
	contributedCameras.push({
		camera,
		name: webcam.name,
		pageUrl: webcam.page_url,
		source: JSON.parse(webcam.source) as CameraSource,
		regions: webcamRegions.map((region, i) => ({
			id: generateUniqueId(
				slugify(region.lift_name ?? region.label) || `region-${i + 1}`,
				regionIds
			),
			lift: region.lift_name,
			...(region.lift_osm ? { liftOsm: region.lift_osm } : {}),
			label: region.label,
			box: JSON.parse(region.box) as [number, number, number, number],
			upscale: region.upscale
		}))
	});
}

const file = `data/webcams/contrib/${resort}-queues.json`;
mkdirSync('data/webcams/contrib', { recursive: true });
writeFileSync(file, JSON.stringify(contributedCameras, null, '\t') + '\n');
console.log(
	`${file}: ${contributedCameras.length} cameras, ${contributedCameras.reduce((n, c) => n + c.regions.length, 0)} confirmed regions ` +
		`(${remote ? 'remote' : 'local'} D1)`
);
if (withoutRegions.length)
	console.log(`  no confirmed regions, left out: ${withoutRegions.join(', ')}`);
