import { APP_USER_AGENT } from '../identity.ts';
import { escapeXml } from './change.ts';
import type {
	DiffElementResult,
	ElementRef,
	OsmApiConfig,
	OsmElement,
	OsmElementType
} from './types.ts';

export class OsmApiError extends Error {
	constructor(
		public readonly status: number,
		public readonly body: string,
		message?: string
	) {
		super(message ?? `OSM API error ${status}: ${body}`);
		this.name = 'OsmApiError';
	}
}

function getFetch(config: OsmApiConfig): typeof fetch {
	return config.fetch ?? fetch;
}

function getHeaders(config: OsmApiConfig, contentType?: string): Record<string, string> {
	const headers: Record<string, string> = {
		'User-Agent': APP_USER_AGENT
	};
	if (contentType) {
		headers['Content-Type'] = contentType;
	}
	if (config.token) {
		headers.Authorization = `Bearer ${config.token}`;
	}
	return headers;
}

function normalizeBase(base: string): string {
	return base.replace(/\/+$/, '');
}

const DIFF_ELEMENT_TAG_REGEX = /<(node|way|relation)\b([^>]*)\/?>/g;
const OLD_ID_ATTR_REGEX = /old_id=["']([^"']+)["']/;
const NEW_ID_ATTR_REGEX = /new_id=["']([^"']+)["']/;
const NEW_VERSION_ATTR_REGEX = /new_version=["']([^"']+)["']/;

export function parseDiffResultXml(xml: string): { elements: DiffElementResult[] } {
	const elements: DiffElementResult[] = [];
	const tagRegex = new RegExp(DIFF_ELEMENT_TAG_REGEX);
	let match: RegExpExecArray | null;

	while ((match = tagRegex.exec(xml)) !== null) {
		const type = match[1] as OsmElementType;
		const attrs = match[2];

		const oldIdMatch = OLD_ID_ATTR_REGEX.exec(attrs);
		const newIdMatch = NEW_ID_ATTR_REGEX.exec(attrs);
		const newVerMatch = NEW_VERSION_ATTR_REGEX.exec(attrs);

		if (oldIdMatch && newIdMatch && newVerMatch) {
			elements.push({
				type,
				oldId: parseInt(oldIdMatch[1], 10),
				newId: parseInt(newIdMatch[1], 10),
				newVersion: parseInt(newVerMatch[1], 10)
			});
		}
	}

	return { elements };
}

export async function fetchElement(
	configOrType: OsmApiConfig | OsmElementType,
	typeOrId: OsmElementType | number,
	idOrConfig?: number | OsmApiConfig
): Promise<OsmElement> {
	let config: OsmApiConfig;
	let type: OsmElementType;
	let id: number;

	if (typeof configOrType === 'object') {
		config = configOrType;
		type = typeOrId as OsmElementType;
		id = idOrConfig as number;
	} else {
		type = configOrType;
		id = typeOrId as number;
		config = idOrConfig as OsmApiConfig;
	}

	const url = `${normalizeBase(config.base)}/api/0.6/${type}/${id}.json`;
	const fetchFn = getFetch(config);
	const response = await fetchFn(url, {
		method: 'GET',
		headers: {
			...getHeaders(config),
			'Cache-Control': 'no-cache, no-store'
		}
	});

	if (!response.ok) {
		const body = await response.text();
		throw new OsmApiError(response.status, body);
	}

	const data = (await response.json()) as { elements?: OsmElement[] };
	if (!data.elements || data.elements.length === 0) {
		throw new OsmApiError(404, `Element ${type}/${id} not found in response`);
	}

	return data.elements[0];
}

export async function fetchElements(
	configOrRefs: OsmApiConfig | ElementRef[],
	refsOrConfig?: ElementRef[] | OsmApiConfig
): Promise<OsmElement[]> {
	let config: OsmApiConfig;
	let refs: ElementRef[];

	if (Array.isArray(configOrRefs)) {
		refs = configOrRefs;
		config = refsOrConfig as OsmApiConfig;
	} else {
		config = configOrRefs;
		refs = (refsOrConfig as ElementRef[]) ?? [];
	}

	if (refs.length === 0) {
		return [];
	}

	const fetchFn = getFetch(config);
	const base = normalizeBase(config.base);
	const headers = getHeaders(config);

	const nodes = Array.from(new Set(refs.filter((r) => r.type === 'node').map((r) => r.id)));
	const ways = Array.from(new Set(refs.filter((r) => r.type === 'way').map((r) => r.id)));
	const relations = Array.from(new Set(refs.filter((r) => r.type === 'relation').map((r) => r.id)));

	const results: OsmElement[] = [];

	const groups: Array<{ type: OsmElementType; plural: string; ids: number[] }> = [
		{ type: 'node', plural: 'nodes', ids: nodes },
		{ type: 'way', plural: 'ways', ids: ways },
		{ type: 'relation', plural: 'relations', ids: relations }
	];

	for (const group of groups) {
		if (group.ids.length === 0) continue;
		const url = `${base}/api/0.6/${group.plural}.json?${group.plural}=${group.ids.join(',')}`;
		const response = await fetchFn(url, {
			method: 'GET',
			headers: {
				...headers,
				'Cache-Control': 'no-cache, no-store'
			}
		});
		if (!response.ok) {
			const body = await response.text();
			throw new OsmApiError(response.status, body);
		}
		const data = (await response.json()) as { elements?: OsmElement[] };
		if (data.elements) {
			results.push(...data.elements);
		}
	}

	return results;
}

export async function openChangeset(
	configOrTags: OsmApiConfig | Record<string, string>,
	tagsOrConfig?: Record<string, string> | OsmApiConfig
): Promise<number> {
	let config: OsmApiConfig;
	let tags: Record<string, string>;

	if ('base' in (configOrTags as object)) {
		config = configOrTags as OsmApiConfig;
		tags = tagsOrConfig as Record<string, string>;
	} else {
		tags = configOrTags as Record<string, string>;
		config = tagsOrConfig as OsmApiConfig;
	}

	const base = normalizeBase(config.base);
	const url = `${base}/api/0.6/changeset/create`;
	const tagLines: string[] = [];
	for (const [k, v] of Object.entries(tags)) {
		tagLines.push(`\t\t<tag k="${escapeXml(k)}" v="${escapeXml(v)}"/>`);
	}

	const xml = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<osm>',
		'\t<changeset>',
		...tagLines,
		'\t</changeset>',
		'</osm>'
	].join('\n');

	const fetchFn = getFetch(config);
	const response = await fetchFn(url, {
		method: 'PUT',
		headers: getHeaders(config, 'text/xml'),
		body: xml
	});

	if (!response.ok) {
		const body = await response.text();
		throw new OsmApiError(response.status, body);
	}

	const text = await response.text();
	const id = parseInt(text.trim(), 10);
	if (isNaN(id)) {
		throw new OsmApiError(500, `Failed to parse changeset ID from response: "${text}"`);
	}

	return id;
}

export async function uploadChange(
	configOrId: OsmApiConfig | number,
	idOrXml: number | string,
	xmlOrConfig?: string | OsmApiConfig
): Promise<{ elements: DiffElementResult[] }> {
	let config: OsmApiConfig;
	let changesetId: number;
	let xml: string;

	if (typeof configOrId === 'object') {
		config = configOrId;
		changesetId = idOrXml as number;
		xml = xmlOrConfig as string;
	} else {
		changesetId = configOrId;
		xml = idOrXml as string;
		config = xmlOrConfig as OsmApiConfig;
	}

	const base = normalizeBase(config.base);
	const url = `${base}/api/0.6/changeset/${changesetId}/upload`;

	const fetchFn = getFetch(config);
	const response = await fetchFn(url, {
		method: 'POST',
		headers: getHeaders(config, 'text/xml'),
		body: xml
	});

	if (!response.ok) {
		const body = await response.text();
		throw new OsmApiError(response.status, body);
	}

	const responseXml = await response.text();
	return parseDiffResultXml(responseXml);
}

export async function closeChangeset(
	configOrId: OsmApiConfig | number,
	idOrConfig?: number | OsmApiConfig
): Promise<void> {
	let config: OsmApiConfig;
	let id: number;

	if (typeof configOrId === 'object') {
		config = configOrId;
		id = idOrConfig as number;
	} else {
		id = configOrId;
		config = idOrConfig as OsmApiConfig;
	}

	const base = normalizeBase(config.base);
	const url = `${base}/api/0.6/changeset/${id}/close`;

	const fetchFn = getFetch(config);
	const response = await fetchFn(url, {
		method: 'PUT',
		headers: getHeaders(config)
	});

	if (!response.ok) {
		const body = await response.text();
		throw new OsmApiError(response.status, body);
	}
}
