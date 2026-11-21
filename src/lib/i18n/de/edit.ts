import type { Messages } from '../en/index.ts';
import { plural } from '../intl.ts';

export const edit: Messages['edit'] = {
	loadingResort: 'Skigebiet wird geladen…',
	backToMap: 'Zurück zur Karte',
	title: (name: string) => `${name} bearbeiten`,
	lift: 'Lift',
	piste: 'Piste',
	wayAndVersion: (id: number, version: number) => `· Way #${id} · v${version}`,
	loadingCurrentTags: 'Aktuelle Tags werden geladen…',
	changesSaved: (changesetId: number) => `Änderungen gespeichert · Änderungssatz #${changesetId}`,
	testNodeCreated: (changesetId: number) =>
		`Test-Knoten auf dem OSM-Dev-Server erstellt · Änderungssatz #${changesetId}`,
	openChangeset: 'Änderungssatz öffnen ↗',
	signInPrompt: 'Melde dich mit OpenStreetMap an, um deine Änderungen zu speichern.',
	cantSaveYet: 'Speichern noch nicht möglich',
	savingUnavailable: 'Speichern auf OpenStreetMap ist gerade nicht verfügbar.',
	grantEditPermission: 'Bearbeitungsrechte erteilen',
	liveError: (error: string) =>
		`Live-Tags konnten nicht von openstreetmap.org geladen werden (${error}). Du kannst trotzdem bearbeiten und es erneut versuchen.`,
	refLabel: (ref: string) => `Ref ${ref}`,
	multiWayPrompt: (count: number) =>
		plural(count, {
			one: 'Diese Piste ist auf OpenStreetMap als # Way erfasst. Wähle einen zum Bearbeiten:',
			other: 'Diese Piste ist auf OpenStreetMap als # Ways erfasst. Wähle einen zum Bearbeiten:'
		}),
	missingTags: (count: number) => `Fehlende Tags (${count})`,
	currentTags: (count: number) => `Aktuelle Tags (${count})`,
	otherTags: 'Weitere Tags',
	removeTagKey: (key: string) => `${key} entfernen`,
	tagKeyPlaceholder: 'Tag-Schlüssel',
	tagValuePlaceholder: 'Wert',
	add: 'Hinzufügen',
	unlinkAccount: 'Konto trennen',
	revokeOnOsm: 'Auf OSM widerrufen ↗',
	noChanges: 'Noch keine Änderungen',
	changesCount: (count: number) =>
		plural(count, { one: '# Tag-Änderung', other: '# Tag-Änderungen' }),
	savesToServer: (server: string) => `Speichert auf ${server}`,
	reviewAndSave: 'Prüfen & speichern',
	pisteNotEditable:
		'Diese Piste kann hier noch nicht bearbeitet werden. Bearbeite sie stattdessen auf openstreetmap.org.',
	openFromMap: 'Öffne diese Seite über eine Lift- oder Pistenkarte auf der Karte.',
	pisteRef: (ref: string) => `Piste ${ref}`,
	saveFailed: 'Speichern fehlgeschlagen.',
	fields: {
		tagLabel: 'Tag: ',
		genericPlaceholder: 'Wert eingeben',
		urlPlaceholder: 'https://...',
		openingHoursPlaceholder: '08:30-16:30',
		placeholderWithUnit: (unit: string) => `z. B. 5 (${unit})`,
		set: 'Setzen',
		removeTag: 'Tag entfernen',
		durationMinutesPreset: (preset: string) => `${preset} min`,
		capacityPersonsPerHourPreset: (preset: string) => `${preset} Pers./h`,
		occupancySeatsPreset: (preset: string) => `${preset} Plätze`
	},
	conflict: {
		title: 'Jemand anderes hat diesen Way geändert',
		dismissAria: 'Konflikt verwerfen',
		key: 'Schlüssel',
		yourEdit: 'Deine Änderung',
		osmNow: 'Jetzt auf OpenStreetMap',
		deleted: 'gelöscht',
		none: 'keiner',
		reload: 'Neueste Version laden',
		keepReviewing: 'Weiter prüfen'
	},
	review: {
		title: 'Änderungen prüfen',
		ariaLabel: 'Änderungen prüfen',
		tagChanges: (count: number, wayId: number) =>
			`${plural(count, { one: '# Tag-Änderung', other: '# Tag-Änderungen' })} · Way #${wayId}`,
		closeAria: 'Prüfung schließen',
		cantSaveYet: 'Speichern noch nicht möglich',
		savingUnavailable: 'Speichern auf OpenStreetMap ist gerade nicht verfügbar.',
		changesHeading: 'Änderungen',
		delBadge: 'DEL',
		addBadge: 'ADD',
		modBadge: 'MOD',
		wasValue: (val: string) => `war „${val}“`,
		comment: 'Änderungssatz-Kommentar',
		source: 'Quelle',
		savesTo: 'Speichert auf',
		signedInAs: 'Angemeldet als',
		signInPrompt: 'Melde dich mit OpenStreetMap an, um unter deinem eigenen Konto zu speichern.',
		saveChanges: 'Änderungen speichern',
		saving: 'Wird gespeichert…',
		signInToSave: 'Zum Speichern mit OpenStreetMap anmelden'
	}
};
