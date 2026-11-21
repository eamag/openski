import type { Messages } from '../en/index.ts';
import { formatNumber, plural } from '../intl.ts';

export const questions: Messages['questions'] = {
	backToMap: 'Retour au plan',
	title: (resortName: string) => `Aidez à cartographier ${resortName}`,
	thisResort: 'ce domaine',
	questionsLeft: (count: number) =>
		plural(count, { one: '# question restante', other: '# questions restantes' }),
	drafted: (count: number) => `${formatNumber(count)} en brouillon`,
	answersSaved: (changesetId: number) =>
		`Réponses enregistrées · groupe de modifications #${changesetId}`,
	testNodeCreated: (changesetId: number) =>
		`Nœud de test créé sur le serveur de dev OSM · groupe de modifications #${changesetId}`,
	viewChangeset: 'Voir le groupe de modifications sur OpenStreetMap ↗',
	answersNotSaved: (count: number) =>
		plural(count, {
			one: '# réponse pas encore enregistrée',
			other: '# réponses pas encore enregistrées'
		}),
	checkAndSaveHint: 'Vérifiez-les, puis enregistrez-les sur OpenStreetMap',
	reviewAndSave: 'Vérifier et enregistrer',
	signInPrompt:
		'Répondez librement\u00A0; connectez-vous avec OpenStreetMap quand vous souhaitez enregistrer.',
	cantSaveYet: 'Enregistrement impossible pour le moment',
	savingUnavailable: 'L’enregistrement sur OpenStreetMap n’est pas disponible pour le moment.',
	grantEditPermission: 'Autoriser les modifications',
	loadError: (error: string) => `Les questions n’ont pas pu être chargées (${error}).`,
	lift: 'Remontée',
	piste: 'Piste',
	distanceAway: (distance: string) => `à ${distance}`,
	sections: (count: number) => plural(count, { one: '# tronçon', other: '# tronçons' }),
	anotherNumber: 'Un autre numéro',
	typeItHere: 'Saisissez-le ici',
	ok: 'OK',
	skip: 'Pas sûr · question suivante',
	allAnswered:
		'Plus aucune question ici\u00A0: chaque remontée et piste dispose de ces détails. Merci\u202F!',
	addWebcam: 'Ajouter une webcam et ses zones d’attente',
	savingToServer: (server: string, isTest: boolean) =>
		`Enregistrement sur ${server}${isTest ? ' (le serveur de test)' : ''}.`,
	review: {
		title: 'Vérifier vos réponses',
		ariaLabel: 'Vérifier vos réponses',
		close: 'Fermer la vérification',
		answersTogether: (count: number) =>
			`${plural(count, { one: '# réponse', other: '# réponses' })}, enregistrées ensemble dans un groupe de modifications`,
		notSaved: 'Non enregistré',
		tagsToAdd: 'Attributs à ajouter',
		removeAnswer: 'Supprimer la réponse',
		waysCount: (count: number) => plural(count, { one: '# ligne', other: '# lignes' }),
		wayRef: (wayId: number) => `way #${wayId}`,
		comment: 'Commentaire du groupe de modifications',
		source: 'Source',
		surveyHint: '«\u00A0survey\u00A0» signifie que vous l’avez constaté vous-même sur les pistes.',
		surveyExplanation:
			'Vos réponses doivent provenir de vos propres observations sur le terrain en montagne, et non être copiées depuis des plans de pistes tiers. Elles ne complètent que les attributs encore manquants et sont enregistrées sur OpenStreetMap sous votre propre compte, où chacun peut les consulter et les enrichir.',
		saveToOsm: 'Enregistrer sur OpenStreetMap',
		saving: 'Enregistrement…',
		signInToSave: 'Se connecter avec OpenStreetMap pour enregistrer',
		savingUnavailable: 'L’enregistrement sur OpenStreetMap n’est pas disponible pour le moment.'
	},
	errors: {
		signInRequired: 'Connectez-vous avec OpenStreetMap pour enregistrer vos réponses.',
		conflict:
			'Quelqu’un a modifié ces lignes sur OpenStreetMap il y a un instant. Fermez ceci, rouvrez les questions et réessayez.',
		savingFailed: (status: number) => `Échec de l’enregistrement (erreur ${status}).`,
		noConnection:
			'Aucune connexion. Vos réponses sont toujours là\u00A0; réessayez dès que vous serez en ligne.'
	}
};
