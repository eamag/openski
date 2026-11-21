import { plural } from '../intl.ts';

export const edit = {
	loadingResort: 'Loading resort…',
	backToMap: 'Back to map',
	title: (name: string) => `Edit ${name}`,
	lift: 'Lift',
	piste: 'Piste',
	wayAndVersion: (id: number, version: number) => `· way #${id} · v${version}`,
	loadingCurrentTags: 'Loading the current tags…',
	changesSaved: (changesetId: number) => `Changes saved · changeset #${changesetId}`,
	testNodeCreated: (changesetId: number) =>
		`Test node created on the OSM dev server · changeset #${changesetId}`,
	openChangeset: 'Open changeset ↗',
	signInPrompt: 'Sign in with OpenStreetMap to save your changes.',
	cantSaveYet: "Can't save yet",
	savingUnavailable: 'Saving to OpenStreetMap is not available right now.',
	grantEditPermission: 'Grant edit permission',
	liveError: (error: string) =>
		`Could not fetch live tags from openstreetmap.org (${error}). You can still edit and retry.`,
	refLabel: (ref: string) => `Ref ${ref}`,
	multiWayPrompt: (count: number) =>
		plural(count, {
			one: 'This piste is drawn as # way on OpenStreetMap. Pick one to edit:',
			other: 'This piste is drawn as # ways on OpenStreetMap. Pick one to edit:'
		}),
	missingTags: (count: number) => `Missing tags (${count})`,
	currentTags: (count: number) => `Current tags (${count})`,
	otherTags: 'Other tags',
	removeTagKey: (key: string) => `Remove ${key}`,
	tagKeyPlaceholder: 'tag key',
	tagValuePlaceholder: 'value',
	add: 'Add',
	unlinkAccount: 'Unlink account',
	revokeOnOsm: 'Revoke on OSM ↗',
	noChanges: 'No changes yet',
	changesCount: (count: number) => plural(count, { one: '# tag change', other: '# tag changes' }),
	savesToServer: (server: string) => `Saves to ${server}`,
	reviewAndSave: 'Review & save',
	pisteNotEditable: "This piste can't be edited here yet. Edit it on openstreetmap.org instead.",
	openFromMap: 'Open this page from a lift or piste card on the map.',
	pisteRef: (ref: string) => `Piste ${ref}`,
	saveFailed: 'Save failed.',
	fields: {
		tagLabel: 'Tag: ',
		genericPlaceholder: 'Enter value',
		urlPlaceholder: 'https://...',
		openingHoursPlaceholder: '08:30-16:30',
		placeholderWithUnit: (unit: string) => `e.g. 5 (${unit})`,
		set: 'Set',
		removeTag: 'Remove tag',
		durationMinutesPreset: (preset: string) => `${preset} min`,
		capacityPersonsPerHourPreset: (preset: string) => `${preset} pers/h`,
		occupancySeatsPreset: (preset: string) => `${preset} seats`
	},
	conflict: {
		title: 'Someone else changed this way',
		dismissAria: 'Dismiss conflict',
		key: 'Key',
		yourEdit: 'Your edit',
		osmNow: 'OpenStreetMap now',
		deleted: 'deleted',
		none: 'none',
		reload: 'Load the latest version',
		keepReviewing: 'Keep reviewing'
	},
	review: {
		title: 'Review changes',
		ariaLabel: 'Review changes',
		tagChanges: (count: number, wayId: number) =>
			`${plural(count, { one: '# tag change', other: '# tag changes' })} · way #${wayId}`,
		closeAria: 'Close review',
		cantSaveYet: "Can't save yet",
		savingUnavailable: 'Saving to OpenStreetMap is not available right now.',
		changesHeading: 'Changes',
		delBadge: 'DEL',
		addBadge: 'ADD',
		modBadge: 'MOD',
		wasValue: (val: string) => `was "${val}"`,
		comment: 'Changeset comment',
		source: 'Source',
		savesTo: 'Saves to',
		signedInAs: 'Signed in as',
		signInPrompt: 'Sign in with OpenStreetMap to save under your own account.',
		saveChanges: 'Save changes',
		saving: 'Saving…',
		signInToSave: 'Sign in with OpenStreetMap to save'
	}
};
