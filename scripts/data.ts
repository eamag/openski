const [action, ...args] = process.argv.slice(2);
const isValidAction = action === 'fetch' || action === 'build';
if (!isValidAction) {
	throw new Error('Use bun run data:fetch or bun run data with an optional resort slug.');
}
const FETCH_PIPELINE_STEPS = ['fetch-osm', 'fetch-dem'];
const BUILD_PIPELINE_STEPS = ['build-resort', 'build-terrain', 'build-queues'];
const pipelineSteps = action === 'fetch' ? FETCH_PIPELINE_STEPS : BUILD_PIPELINE_STEPS;

for (const step of pipelineSteps) {
	const childProcess = Bun.spawnSync([process.execPath, `scripts/${step}.ts`, ...args], {
		stdout: 'inherit',
		stderr: 'inherit'
	});
	if (!childProcess.success) process.exit(childProcess.exitCode || 1);
}
