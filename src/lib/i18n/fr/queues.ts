import type { Messages } from '../en/index.ts';
import { plural } from '../intl.ts';

export const queues: Messages['queues'] = {
	level: {
		none: 'Pas d’attente',
		short: 'Peu d’attente',
		queue: 'Attente',
		long: 'Forte attente'
	},
	hideBoxes: 'Masquer les zones',
	showBoxes: 'Afficher les zones',
	pictureAlt: (time: string, people: number) =>
		`Image webcam de ${time} avec ${plural(people, { one: '# personne marquée', other: '# personnes marquées' })}`,
	pictureMissingDevice:
		'L’image correspondant à ce comptage n’est plus sur cet appareil. Relancez la vérification pour la voir.',
	boxedSummary: (count: number, cameraName: string, time: string) =>
		count === 0
			? `Personne détectée sur l’image webcam de ${cameraName} à ${time}.`
			: `${plural(count, { one: '# personne repérée', other: '# personnes repérées' })} sur l’image webcam de ${cameraName} à ${time}.`,
	tapToHideBoxes: 'Touchez l’image pour masquer les zones et compter vous-même.',
	originalPicture: (current?: number, total?: number) =>
		current && total ? `Image d’origine ${current}/${total}` : 'Image d’origine',
	openWebcam: 'Ouvrir la webcam',
	error: {
		needsConnection:
			'Le comptage des files nécessite une connexion\u00A0: les images webcam sont téléchargées à chaque fois.',
		noWebcamList: 'Impossible de charger la liste des webcams.',
		webcamsNotAnswering: 'Les webcams ne répondent pas.',
		noWebcamImages: 'Impossible de charger les images des webcams.',
		camerasFailed: (failed: number, total: number, atTime?: boolean) =>
			plural(failed, {
				one: `# caméra sur ${total} n’a donné aucune image${atTime ? ' pour cette heure' : ''}.`,
				other: `# caméras sur ${total} n’ont donné aucune image${atTime ? ' pour cette heure' : ''}.`
			}),
		checkFailed: 'Impossible de vérifier les files d’attente.',
		cannotDrawOffscreen: 'Ce navigateur ne gère pas le rendu hors écran.',
		modelDownloadFailed: (status: number) =>
			`Le détecteur de personnes n’a pas pu être téléchargé (erreur ${status}). Réessayez.`,
		noPicturesToday: 'La caméra n’a aucune image aujourd’hui.'
	}
};
