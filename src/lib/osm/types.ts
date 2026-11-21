export type OsmElementType = 'node' | 'way' | 'relation';

export interface OsmMember {
	type: OsmElementType;
	ref: number;
	role: string;
}

export interface OsmElement {
	type: OsmElementType;
	id: number;
	version: number;
	changeset?: number;
	timestamp?: string;
	user?: string;
	uid?: number;
	visible?: boolean;
	lat?: number;
	lon?: number;
	nodes?: number[];
	members?: OsmMember[];
	tags?: Record<string, string>;
}

export interface TagChange {
	key: string;
	value: string | null;
	delete?: boolean;
}

export interface NewNode {
	id?: number;
	lat: number;
	lon: number;
	tags?: Record<string, string>;
}

export type SkiKind = 'lift' | 'piste';

export interface EditPlan {
	seen?: OsmElement;
	kind?: SkiKind;
	changes?: TagChange[];
	also?: { seen: OsmElement; kind?: SkiKind; changes: TagChange[] }[];
	creates?: NewNode[];
	fillMissingTags?: boolean;
	comment: string;
	source?: string;
	locale?: string;
}

export interface KeyConflict {
	key: string;
	userValue: string | null;
	upstreamValue: string | null;
}

export interface Conflict {
	type: 'modified' | 'deleted';
	message: string;
	elementId: number;
	elementType: OsmElementType;
	keys?: KeyConflict[];
}

export interface ElementRef {
	type: OsmElementType;
	id: number;
}

export interface DiffElementResult {
	type: OsmElementType;
	oldId: number;
	newId: number;
	newVersion: number;
}

export interface SaveSuccess {
	ok: true;
	changesetId: number;
	elements: DiffElementResult[];
}

export interface SaveUnchanged {
	type: 'unchanged';
}

export type SaveResult = SaveSuccess | Conflict | SaveUnchanged;

export interface OsmApiConfig {
	base: string;
	token?: string;
	fetch?: typeof fetch;
}

export interface OsmEditRequest {
	kind: SkiKind;
	wayId: number;
	element: OsmElement;
	changes: TagChange[];
	tags: Record<string, string>;
	fillMissingTags?: boolean;
	comment: string;
	source?: string;
	lat: number;
	lon: number;
	/** Survey answers only: every way the mapper reviewed, exactly the ways in this request. */
	surveyWayIds?: number[];
	also?: {
		wayId: number;
		kind?: OsmEditRequest['kind'];
		element: OsmElement;
		changes: TagChange[];
	}[];
}

export interface OsmEditSuccess {
	ok: true;
	changesetId: number;
	url: string;
	server: string;
	action: 'modify' | 'create';
}

export interface OsmEditFailure {
	error: 'conflict';
	message: string;
	conflict: Conflict;
}

export interface OsmEditUnchanged {
	unchanged: true;
	message: string;
}

export type OsmEditResponse = OsmEditSuccess | OsmEditUnchanged | OsmEditFailure;
