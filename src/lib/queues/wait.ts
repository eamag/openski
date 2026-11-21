import type { Lift } from '../resort/types.ts';

const DEFAULT_CHAIRLIFT_SEATS = 4;
const DEFAULT_LIFT_THROUGHPUT_PER_HOUR = 1000;
const CABLE_CAR_THROUGHPUT_PER_HOUR = 900;
const MAX_CHAIRLIFT_CAPACITY = 3200;
const MAX_GONDOLA_CAPACITY = 3600;
const CHAIRLIFT_CAPACITY_PER_SEAT = 400;
const GONDOLA_CAPACITY_PER_SEAT = 320;

const CROWD_OCCLUSION_THRESHOLD_PEOPLE = 12;
const CROWD_OCCLUSION_MULTIPLIER = 1.4;
const SECONDS_PER_HOUR = 3600;

const NO_QUEUE_MAX_PEOPLE = 4;
const SHORT_QUEUE_MAX_PEOPLE = 15;
const MODERATE_QUEUE_MAX_PEOPLE = 40;

export function throughput(lift: Lift): number {
	if (lift.capacity) return lift.capacity;
	const seats = lift.occupancy ?? DEFAULT_CHAIRLIFT_SEATS;
	if (lift.type === 'chair_lift')
		return Math.min(MAX_CHAIRLIFT_CAPACITY, seats * CHAIRLIFT_CAPACITY_PER_SEAT);
	if (lift.type === 'gondola' || lift.type === 'mixed_lift')
		return Math.min(MAX_GONDOLA_CAPACITY, seats * GONDOLA_CAPACITY_PER_SEAT);
	if (lift.type === 'cable_car') return CABLE_CAR_THROUGHPUT_PER_HOUR;
	return DEFAULT_LIFT_THROUGHPUT_PER_HOUR;
}

export function waitSeconds(lift: Lift, people: number): number {
	const isPackedCrowd = people > CROWD_OCCLUSION_THRESHOLD_PEOPLE;
	const estimatedPeopleWaiting = isPackedCrowd ? people * CROWD_OCCLUSION_MULTIPLIER : people;
	return Math.round((estimatedPeopleWaiting / throughput(lift)) * SECONDS_PER_HOUR);
}

export type QueueLevel = 'none' | 'short' | 'queue' | 'long';

export function queueLevel(people: number): QueueLevel {
	if (people <= NO_QUEUE_MAX_PEOPLE) return 'none';
	if (people <= SHORT_QUEUE_MAX_PEOPLE) return 'short';
	return people <= MODERATE_QUEUE_MAX_PEOPLE ? 'queue' : 'long';
}
