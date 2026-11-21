import { t } from '#lib/i18n/index.ts';
import { pisteKeyFor } from './change.ts';

export type PresetFieldType = 'text' | 'number' | 'bool' | 'enum' | 'opening_hours' | 'url';

export interface PresetField {
	key: string;
	alternateKeys?: string[];
	label: string;
	type: PresetFieldType;
	allowedValues?: string[];
	unit?: string;
	question: string;
	priority?: number;
	appliesTo?: (tags: Record<string, string>) => boolean;
}

const isChairLift = (tags: Record<string, string>) => tags.aerialway === 'chair_lift';

export const LIFT_PRESETS: PresetField[] = [
	{
		key: 'name',
		get label() {
			return t.osm.presets.lift.name.label;
		},
		type: 'text',
		get question() {
			return t.osm.presets.lift.name.question;
		},
		priority: 12
	},
	{
		key: 'ref',
		get label() {
			return t.osm.presets.lift.ref.label;
		},
		type: 'text',
		get question() {
			return t.osm.presets.lift.ref.question;
		},
		priority: 7
	},
	{
		key: 'aerialway',
		get label() {
			return t.osm.presets.lift.aerialway.label;
		},
		type: 'enum',
		allowedValues: [
			'chair_lift',
			'gondola',
			'cable_car',
			't-bar',
			'platter',
			'j-bar',
			'drag_lift',
			'magic_carpet',
			'rope_tow',
			'mixed_lift'
		],
		get question() {
			return t.osm.presets.lift.aerialway.question;
		},
		priority: 13
	},
	{
		key: 'aerialway:occupancy',
		get label() {
			return t.osm.presets.lift.occupancy.label;
		},
		type: 'number',
		get unit() {
			return t.osm.presets.lift.occupancy.unit;
		},
		get question() {
			return t.osm.presets.lift.occupancy.question;
		},
		priority: 8
	},
	{
		key: 'aerialway:capacity',
		get label() {
			return t.osm.presets.lift.capacity.label;
		},
		type: 'number',
		get unit() {
			return t.osm.presets.lift.capacity.unit;
		},
		get question() {
			return t.osm.presets.lift.capacity.question;
		},
		priority: 11
	},
	{
		key: 'aerialway:duration',
		get label() {
			return t.osm.presets.lift.duration.label;
		},
		type: 'number',
		get unit() {
			return t.osm.presets.lift.duration.unit;
		},
		get question() {
			return t.osm.presets.lift.duration.question;
		},
		priority: 10
	},
	{
		key: 'aerialway:bubble',
		get label() {
			return t.osm.presets.lift.bubble.label;
		},
		type: 'bool',
		allowedValues: ['yes', 'no'],
		get question() {
			return t.osm.presets.lift.bubble.question;
		},
		appliesTo: isChairLift,
		priority: 9
	},
	{
		key: 'aerialway:heating',
		get label() {
			return t.osm.presets.lift.heating.label;
		},
		type: 'bool',
		allowedValues: ['yes', 'no'],
		get question() {
			return t.osm.presets.lift.heating.question;
		},
		appliesTo: isChairLift,
		priority: 8
	},
	{
		key: 'opening_hours',
		get label() {
			return t.osm.presets.lift.openingHours.label;
		},
		type: 'opening_hours',
		get question() {
			return t.osm.presets.lift.openingHours.question;
		},
		priority: 3
	},
	{
		key: 'oneway',
		get label() {
			return t.osm.presets.lift.oneway.label;
		},
		type: 'bool',
		allowedValues: ['yes', 'no'],
		get question() {
			return t.osm.presets.lift.oneway.question;
		},
		priority: 10
	},
	{
		key: 'lit',
		get label() {
			return t.osm.presets.lift.lit.label;
		},
		type: 'bool',
		allowedValues: ['yes', 'no'],
		get question() {
			return t.osm.presets.lift.lit.question;
		},
		priority: 2
	},
	{
		key: 'website',
		get label() {
			return t.osm.presets.lift.website.label;
		},
		type: 'url',
		get question() {
			return t.osm.presets.lift.website.question;
		},
		priority: 14
	},
	{
		key: 'aerialway:bicycle',
		get label() {
			return t.osm.presets.lift.bicycle.label;
		},
		type: 'enum',
		allowedValues: ['yes', 'no', 'summer'],
		get question() {
			return t.osm.presets.lift.bicycle.question;
		},
		priority: 15
	}
];

export const PISTE_PRESETS: PresetField[] = [
	{
		key: 'name',
		alternateKeys: ['piste:name'],
		get label() {
			return t.osm.presets.piste.name.label;
		},
		type: 'text',
		get question() {
			return t.osm.presets.piste.name.question;
		},
		priority: 10
	},
	{
		key: 'ref',
		alternateKeys: ['piste:ref'],
		get label() {
			return t.osm.presets.piste.ref.label;
		},
		type: 'text',
		get question() {
			return t.osm.presets.piste.ref.question;
		},
		priority: 5
	},
	{
		key: 'piste:difficulty',
		get label() {
			return t.osm.presets.piste.difficulty.label;
		},
		type: 'enum',
		allowedValues: ['novice', 'easy', 'intermediate', 'advanced', 'expert', 'freeride'],
		get question() {
			return t.osm.presets.piste.difficulty.question;
		},
		priority: 7
	},
	{
		key: 'piste:grooming',
		get label() {
			return t.osm.presets.piste.grooming.label;
		},
		type: 'enum',
		allowedValues: ['classic', 'mogul', 'backcountry'],
		get question() {
			return t.osm.presets.piste.grooming.question;
		},
		priority: 6
	},
	{
		key: 'lit',
		alternateKeys: ['piste:lit'],
		get label() {
			return t.osm.presets.piste.lit.label;
		},
		type: 'bool',
		allowedValues: ['yes', 'no'],
		get question() {
			return t.osm.presets.piste.lit.question;
		},
		priority: 4
	},
	{
		key: 'oneway',
		alternateKeys: ['piste:oneway'],
		get label() {
			return t.osm.presets.piste.oneway.label;
		},
		type: 'bool',
		allowedValues: ['yes', 'no'],
		get question() {
			return t.osm.presets.piste.oneway.question;
		},
		priority: 8
	},
	{
		key: 'piste:snowmaking',
		alternateKeys: ['snowmaking'],
		get label() {
			return t.osm.presets.piste.snowmaking.label;
		},
		type: 'bool',
		allowedValues: ['yes', 'no'],
		get question() {
			return t.osm.presets.piste.snowmaking.question;
		},
		priority: 1
	},
	{
		key: 'gladed',
		get label() {
			return t.osm.presets.piste.gladed.label;
		},
		type: 'bool',
		allowedValues: ['yes', 'no'],
		get question() {
			return t.osm.presets.piste.gladed.question;
		},
		priority: 9
	},
	{
		key: 'piste:abandoned',
		get label() {
			return t.osm.presets.piste.abandoned.label;
		},
		type: 'bool',
		allowedValues: ['yes', 'no'],
		get question() {
			return t.osm.presets.piste.abandoned.question;
		},
		priority: 11
	}
];

/** Keys this field may live in. On a piste that is also a road, the bare key is the road's. */
function fieldKeys(field: PresetField, tags: Record<string, string>): string[] {
	const keys = [field.key, ...(field.alternateKeys ?? [])];
	const pisteKey = pisteKeyFor(field.key, tags);
	return pisteKey !== field.key && keys.includes(pisteKey)
		? keys.filter((k) => k !== field.key)
		: keys;
}

export function getActiveKey(field: PresetField, tags: Record<string, string> = {}): string {
	const keys = fieldKeys(field, tags);
	return keys.find((k) => tags[k] !== undefined) ?? keys[0];
}

export function readFieldValue(
	field: PresetField,
	tags: Record<string, string> = {}
): string | undefined {
	const key = fieldKeys(field, tags).find((k) => tags[k] !== undefined && tags[k] !== '');
	return key === undefined ? undefined : tags[key];
}

export function writeFieldValue(
	field: PresetField,
	tags: Record<string, string> = {},
	value: string | null | undefined
): Record<string, string> {
	const out = { ...tags };
	const keys = fieldKeys(field, tags);
	const activeKey = getActiveKey(field, tags);
	const shouldClearField = value === null || value === undefined || value.trim() === '';
	for (const k of keys) if (shouldClearField || k !== activeKey) delete out[k];
	if (!shouldClearField) out[activeKey] = value.trim();
	return out;
}
