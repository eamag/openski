import type { Messages } from '../en/index.ts';
import { plural } from '../intl.ts';

export const edit: Messages['edit'] = {
	loadingResort: 'Chargement du domaine…',
	backToMap: 'Retour au plan',
	title: (name: string) => `Modifier ${name}`,
	lift: 'Remontée',
	piste: 'Piste',
	wayAndVersion: (id: number, version: number) => `· way #${id} · v${version}`,
	loadingCurrentTags: 'Chargement des attributs actuels…',
	changesSaved: (changesetId: number) =>
		`Modifications enregistrées · groupe de modifications #${changesetId}`,
	testNodeCreated: (changesetId: number) =>
		`Nœud de test créé sur le serveur de dev OSM · groupe de modifications #${changesetId}`,
	openChangeset: 'Ouvrir le groupe de modifications ↗',
	signInPrompt: 'Connectez-vous avec OpenStreetMap pour enregistrer vos modifications.',
	cantSaveYet: 'Enregistrement impossible pour le moment',
	savingUnavailable: 'L’enregistrement sur OpenStreetMap n’est pas disponible pour le moment.',
	grantEditPermission: 'Autoriser les modifications',
	liveError: (error: string) =>
		`Impossible de récupérer les attributs en direct depuis openstreetmap.org (${error}). Vous pouvez quand même modifier et réessayer.`,
	refLabel: (ref: string) => `Réf. ${ref}`,
	multiWayPrompt: (count: number) =>
		plural(count, {
			one: 'Cette piste est tracée sous forme de # ligne sur OpenStreetMap. Choisissez-en une à modifier\u00A0:',
			other:
				'Cette piste est tracée sous forme de # lignes sur OpenStreetMap. Choisissez-en une à modifier\u00A0:'
		}),
	missingTags: (count: number) => `Attributs manquants (${count})`,
	currentTags: (count: number) => `Attributs actuels (${count})`,
	otherTags: 'Autres attributs',
	removeTagKey: (key: string) => `Supprimer ${key}`,
	tagKeyPlaceholder: 'clé de l’attribut',
	tagValuePlaceholder: 'valeur',
	add: 'Ajouter',
	unlinkAccount: 'Dissocier le compte',
	revokeOnOsm: 'Révoquer sur OSM ↗',
	noChanges: 'Aucune modification pour l’instant',
	changesCount: (count: number) =>
		plural(count, {
			one: '# modification d’attribut',
			other: '# modifications d’attributs'
		}),
	savesToServer: (server: string) => `Enregistre sur ${server}`,
	reviewAndSave: 'Vérifier et enregistrer',
	pisteNotEditable:
		'Cette piste ne peut pas encore être modifiée ici. Modifiez-la directement sur openstreetmap.org.',
	openFromMap: 'Ouvrez cette page depuis la fiche d’une remontée ou d’une piste sur le plan.',
	pisteRef: (ref: string) => `Piste ${ref}`,
	saveFailed: 'Échec de l’enregistrement.',
	fields: {
		tagLabel: 'Attribut\u00A0: ',
		genericPlaceholder: 'Saisir une valeur',
		urlPlaceholder: 'https://...',
		openingHoursPlaceholder: '08:30-16:30',
		placeholderWithUnit: (unit: string) => `ex. 5 (${unit})`,
		set: 'Définir',
		removeTag: 'Supprimer l’attribut',
		durationMinutesPreset: (preset: string) => `${preset} min`,
		capacityPersonsPerHourPreset: (preset: string) => `${preset} pers/h`,
		occupancySeatsPreset: (preset: string) => `${preset} places`
	},
	conflict: {
		title: 'Quelqu’un d’autre a modifié cette ligne',
		dismissAria: 'Ignorer le conflit',
		key: 'Clé',
		yourEdit: 'Votre modification',
		osmNow: 'OpenStreetMap actuellement',
		deleted: 'supprimé',
		none: 'aucun',
		reload: 'Charger la dernière version',
		keepReviewing: 'Poursuivre la vérification'
	},
	review: {
		title: 'Vérifier les modifications',
		ariaLabel: 'Vérifier les modifications',
		tagChanges: (count: number, wayId: number) =>
			`${plural(count, { one: '# modification d’attribut', other: '# modifications d’attributs' })} · way #${wayId}`,
		closeAria: 'Fermer la vérification',
		cantSaveYet: 'Enregistrement impossible pour le moment',
		savingUnavailable: 'L’enregistrement sur OpenStreetMap n’est pas disponible pour le moment.',
		changesHeading: 'Modifications',
		delBadge: 'SUPPR',
		addBadge: 'AJOUT',
		modBadge: 'MODIF',
		wasValue: (val: string) => `était «\u00A0${val}\u00A0»`,
		comment: 'Commentaire du groupe de modifications',
		source: 'Source',
		savesTo: 'Enregistre sur',
		signedInAs: 'Connecté en tant que',
		signInPrompt: 'Connectez-vous avec OpenStreetMap pour enregistrer sous votre propre compte.',
		saveChanges: 'Enregistrer les modifications',
		saving: 'Enregistrement…',
		signInToSave: 'Se connecter avec OpenStreetMap pour enregistrer'
	}
};
