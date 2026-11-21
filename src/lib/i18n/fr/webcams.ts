import type { Messages } from '../en/index.ts';

export const webcams: Messages['webcams'] = {
	webcam: 'Webcam',
	loading: 'Chargement de l’image…',
	unavailable:
		'L’image n’est pas disponible pour le moment. La page de la webcam peut encore l’afficher.',
	showPicture: 'Afficher l’image',
	heavyHint: '(quelques Mo)',
	openPage: 'Ouvrir la page de la webcam',
	countQueues: 'Compter la file d’attente sur cette webcam',
	pictureAlt: (name: string) => `Image actuelle de la webcam ${name}`
};
