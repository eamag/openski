import type { Resort } from '#lib/resort/model.ts';
import { arcEdge } from '#lib/resort/model.ts';
import { DEFAULT_PREFS, findRoute } from '#lib/resort/routing.ts';
import { app } from '#lib/state/app.svelte.ts';
import { location, SimulatedLocation } from '#lib/state/location.svelte.ts';
import type { LngLat } from '#lib/geo.ts';

const MIN_MAIN_LIFT_LENGTH_M = 800;
const MIN_LIFT_SPEED_M_PER_S = 2;
const WALKING_SPEED_M_PER_S = 1.4;
const BASE_SKI_SPEED_M_PER_S = 9;
const SKI_SPEED_VARIATION_M_PER_S = 5;

let started = false;

export function startSimulation(resort: Resort, rate: number): void {
	if (started) return;
	const { lifts, nodes, edges } = resort.data;
	const mainLifts = lifts.filter((lift) => lift.length > MIN_MAIN_LIFT_LENGTH_M);
	if (mainLifts.length < 2) return;
	const lowestVillageLift = [...mainLifts].sort((a, b) => a.bottom - b.bottom)[0];
	const highestSummitLift = [...mainLifts].sort((a, b) => b.top - a.top)[0];
	const prefs = { ...DEFAULT_PREFS, avoidFlats: false };
	const upToSummit = findRoute(
		resort,
		[lowestVillageLift.stations[0]],
		[highestSummitLift.stations.at(-1)!],
		prefs
	);
	const downToVillage = findRoute(
		resort,
		[highestSummitLift.stations.at(-1)!],
		[lowestVillageLift.stations[0]],
		prefs
	);
	if (!upToSummit || !downToVillage) return;
	started = true;

	const path: { at: LngLat; ele: number; speed: number }[] = [];
	for (const step of [...upToSummit.steps, ...downToVillage.steps]) {
		for (const arc of step.arcs) {
			const edge = edges[arcEdge(arc)];
			const lift = lifts[edge.o];
			const speed =
				step.kind === 'lift'
					? Math.max(MIN_LIFT_SPEED_M_PER_S, edge.len / (lift.duration * (edge.len / lift.length)))
					: step.kind === 'walk'
						? WALKING_SPEED_M_PER_S
						: BASE_SKI_SPEED_M_PER_S + Math.random() * SKI_SPEED_VARIATION_M_PER_S;
			const coords = resort.arcCoords(arc);
			const startElevation = nodes[resort.arcFrom(arc)][2];
			const endElevation = nodes[resort.arcTo(arc)][2];
			coords.forEach((at, i) => {
				path.push({
					at,
					ele:
						startElevation + ((endElevation - startElevation) * i) / Math.max(1, coords.length - 1),
					speed
				});
			});
		}
	}
	location.use(new SimulatedLocation(path, rate), true);
	app.follow = true;
}
