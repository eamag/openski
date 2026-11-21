import { OSM_EDITOR_NAME } from '../identity.ts';
import type { NewNode, OsmElement, TagChange } from './types.ts';

export const VALID_AERIALWAY_TYPES = new Set([
	'chair_lift',
	'gondola',
	'cable_car',
	't-bar',
	'platter',
	'magic_carpet',
	'rope_tow',
	'mixed_lift',
	'drag_lift',
	'canopy',
	'goods',
	'zip_line',
	'j-bar'
]);

export function isValidSkiElement(element: OsmElement, kind?: 'lift' | 'piste'): boolean {
	const tags = element.tags ?? {};
	if (kind === 'lift') {
		return (
			(typeof tags.aerialway === 'string' && VALID_AERIALWAY_TYPES.has(tags.aerialway)) ||
			tags.railway === 'funicular'
		);
	}
	if (kind === 'piste') {
		return (
			tags['piste:type'] !== undefined ||
			tags['piste:difficulty'] !== undefined ||
			tags.piste !== undefined
		);
	}
	return (
		(typeof tags.aerialway === 'string' && VALID_AERIALWAY_TYPES.has(tags.aerialway)) ||
		tags.railway === 'funicular' ||
		tags['piste:type'] !== undefined ||
		tags['piste:difficulty'] !== undefined ||
		tags.piste !== undefined
	);
}

/** Keys mappers also use for the same fact; a survey never adds a key when one of these is set. */
const EQUIVALENT_KEYS: Record<string, string[]> = {
	lit: ['piste:lit'],
	ref: ['piste:ref'],
	'piste:snowmaking': ['snowmaking']
};

export function hasTagOrEquivalent(tags: Record<string, string> = {}, key: string): boolean {
	return [key, ...(EQUIVALENT_KEYS[key] ?? [])].some((k) => Object.hasOwn(tags, k));
}

/** Piste facts a road has too. On a way that is also a road they belong in piste:* keys. */
export const ROAD_SHARED_KEYS = new Set(['name', 'ref', 'lit', 'oneway']);

export const isRoadWay = (tags: Record<string, string> = {}) => tags.highway !== undefined;

/** The key a piste fact goes in on this way: `piste:ref` on a forest road, `ref` otherwise. */
export function pisteKeyFor(key: string, tags: Record<string, string> = {}): string {
	return isRoadWay(tags) && ROAD_SHARED_KEYS.has(key) ? `piste:${key}` : key;
}

const PROTECTED_STRUCTURAL_KEYS = new Set(['aerialway', 'piste:type']);

const DISALLOWED_KEYS = new Set([
	'highway',
	'building',
	'waterway',
	'natural',
	'barrier',
	'power',
	'landuse',
	'boundary',
	'admin_level',
	'type',
	'railway'
]);

export interface TagValidationError {
	key: string;
	error: string;
}

function hasInvalidKeyCharacters(str: string): boolean {
	for (let i = 0; i < str.length; i++) {
		const code = str.charCodeAt(i);
		const isControlChar = (code >= 0 && code <= 31) || code === 127;
		const isXmlOrSyntaxChar =
			code === '<'.charCodeAt(0) ||
			code === '>'.charCodeAt(0) ||
			code === '"'.charCodeAt(0) ||
			code === "'".charCodeAt(0) ||
			code === '='.charCodeAt(0) ||
			code === ';'.charCodeAt(0);
		if (isControlChar || isXmlOrSyntaxChar) {
			return true;
		}
	}
	return false;
}

function hasControlCharacters(str: string): boolean {
	const TAB = '\t'.charCodeAt(0);
	const LINE_FEED = '\n'.charCodeAt(0);
	const CARRIAGE_RETURN = '\r'.charCodeAt(0);
	const DEL = 127;
	for (let i = 0; i < str.length; i++) {
		const code = str.charCodeAt(i);
		const isDisallowedControl =
			(code >= 0 && code <= 31 && code !== TAB && code !== LINE_FEED && code !== CARRIAGE_RETURN) ||
			code === DEL;
		if (isDisallowedControl) {
			return true;
		}
	}
	return false;
}

export function validateTagChange(
	change: TagChange,
	kind: 'lift' | 'piste',
	currentTags: Record<string, string> = {}
): string | null {
	const { key, value } = change;
	const isDelete = change.delete || value === null || value === undefined || value.trim() === '';

	if (!key || typeof key !== 'string' || key.trim() === '') {
		return 'Tag key cannot be empty';
	}
	if (key.length > 255) {
		return `Tag key exceeds maximum length of 255 characters`;
	}
	if (hasInvalidKeyCharacters(key)) {
		return `Tag key "${key}" contains invalid characters`;
	}

	if (isDelete && PROTECTED_STRUCTURAL_KEYS.has(key)) {
		return `Protected structural key "${key}" cannot be deleted`;
	}

	if (kind === 'lift' && key === 'aerialway' && !isDelete) {
		if (value && !VALID_AERIALWAY_TYPES.has(value) && currentTags.railway !== 'funicular') {
			return `Invalid aerialway type: "${value}"`;
		}
	}

	if (DISALLOWED_KEYS.has(key) && !(key === 'railway' && currentTags.railway === 'funicular')) {
		return `Modifying infrastructure key "${key}" is not permitted`;
	}

	if (!isDelete) {
		if (typeof value !== 'string') {
			return `Value for tag "${key}" must be a string`;
		}
		if (value.length > 255) {
			return `Value for tag "${key}" exceeds maximum length of 255 characters`;
		}
		if (hasControlCharacters(value)) {
			return `Value for tag "${key}" contains control characters`;
		}
	}

	return null;
}

export function validateTagChanges(
	changes: TagChange[],
	kind: 'lift' | 'piste',
	currentTags: Record<string, string> = {}
): TagValidationError[] {
	const errors: TagValidationError[] = [];
	for (const ch of changes) {
		const err = validateTagChange(ch, kind, currentTags);
		if (err) {
			errors.push({ key: ch.key, error: err });
		}
	}
	return errors;
}

export function escapeXml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

export function tagDiff(
	before: Record<string, string> = {},
	after: Record<string, string> = {}
): TagChange[] {
	const changes: TagChange[] = [];
	const seenKeys = new Set<string>();

	for (const [key, value] of Object.entries(after)) {
		seenKeys.add(key);
		if (!(key in before) || before[key] !== value) {
			changes.push({ key, value });
		}
	}

	for (const key of Object.keys(before)) {
		if (!seenKeys.has(key)) {
			changes.push({ key, value: null, delete: true });
		}
	}

	return changes.sort((a, b) => a.key.localeCompare(b.key));
}

export function applyTagChanges(element: OsmElement, changes: TagChange[]): OsmElement {
	const newTags: Record<string, string> = { ...(element.tags ?? {}) };

	for (const change of changes) {
		if (change.delete || change.value === null || change.value === undefined) {
			delete newTags[change.key];
		} else {
			newTags[change.key] = change.value;
		}
	}

	return {
		...element,
		tags: newTags
	};
}

export function changesetTags(options: {
	comment: string;
	source?: string;
	locale?: string;
}): Record<string, string> {
	const tags: Record<string, string> = {
		created_by: OSM_EDITOR_NAME,
		comment: options.comment
	};

	const hashtagsInComment = options.comment.match(/#[\p{L}\p{N}_-]+/gu);
	if (hashtagsInComment) tags.hashtags = [...new Set(hashtagsInComment)].join(';');

	if (options.source) {
		tags.source = options.source;
	}

	if (options.locale) {
		tags.locale = options.locale;
	}

	return tags;
}

export interface OsmChangePayload {
	create?: (NewNode | OsmElement)[];
	modify?: OsmElement[];
	delete?: OsmElement[];
}

export function osmChangeXml(changesetId: number, changes: OsmChangePayload): string {
	const lines: string[] = [];
	lines.push('<?xml version="1.0" encoding="UTF-8"?>');
	lines.push(`<osmChange version="0.6" generator="${OSM_EDITOR_NAME}">`);

	if (changes.create && changes.create.length > 0) {
		lines.push('\t<create>');
		let placeholderIdCounter = -1;
		for (const item of changes.create) {
			const id = item.id !== undefined && item.id < 0 ? item.id : placeholderIdCounter--;
			const lat = 'lat' in item && item.lat !== undefined ? item.lat : 0;
			const lon = 'lon' in item && item.lon !== undefined ? item.lon : 0;
			const tags = item.tags ? Object.entries(item.tags) : [];

			if (tags.length === 0) {
				lines.push(`\t\t<node id="${id}" changeset="${changesetId}" lat="${lat}" lon="${lon}"/>`);
			} else {
				lines.push(`\t\t<node id="${id}" changeset="${changesetId}" lat="${lat}" lon="${lon}">`);
				for (const [k, v] of tags) {
					lines.push(`\t\t\t<tag k="${escapeXml(k)}" v="${escapeXml(v)}"/>`);
				}
				lines.push('\t\t</node>');
			}
		}
		lines.push('\t</create>');
	}

	if (changes.modify && changes.modify.length > 0) {
		lines.push('\t<modify>');
		for (const el of changes.modify) {
			const tags = el.tags ? Object.entries(el.tags) : [];
			if (el.type === 'node') {
				if (tags.length === 0) {
					lines.push(
						`\t\t<node id="${el.id}" changeset="${changesetId}" version="${el.version}" lat="${el.lat}" lon="${el.lon}"/>`
					);
				} else {
					lines.push(
						`\t\t<node id="${el.id}" changeset="${changesetId}" version="${el.version}" lat="${el.lat}" lon="${el.lon}">`
					);
					for (const [k, v] of tags) {
						lines.push(`\t\t\t<tag k="${escapeXml(k)}" v="${escapeXml(v)}"/>`);
					}
					lines.push('\t\t</node>');
				}
			} else if (el.type === 'way') {
				lines.push(`\t\t<way id="${el.id}" changeset="${changesetId}" version="${el.version}">`);
				for (const nd of el.nodes ?? []) {
					lines.push(`\t\t\t<nd ref="${nd}"/>`);
				}
				for (const [k, v] of tags) {
					lines.push(`\t\t\t<tag k="${escapeXml(k)}" v="${escapeXml(v)}"/>`);
				}
				lines.push('\t\t</way>');
			} else if (el.type === 'relation') {
				lines.push(
					`\t\t<relation id="${el.id}" changeset="${changesetId}" version="${el.version}">`
				);
				for (const m of el.members ?? []) {
					lines.push(`\t\t\t<member type="${m.type}" ref="${m.ref}" role="${escapeXml(m.role)}"/>`);
				}
				for (const [k, v] of tags) {
					lines.push(`\t\t\t<tag k="${escapeXml(k)}" v="${escapeXml(v)}"/>`);
				}
				lines.push('\t\t</relation>');
			}
		}
		lines.push('\t</modify>');
	}

	if (changes.delete && changes.delete.length > 0) {
		lines.push('\t<delete if-unused="true">');
		for (const el of changes.delete) {
			lines.push(
				`\t\t<${el.type} id="${el.id}" changeset="${changesetId}" version="${el.version}"/>`
			);
		}
		lines.push('\t</delete>');
	}

	lines.push('</osmChange>');
	return lines.join('\n');
}
