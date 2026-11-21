import type { Messages } from '../en/index.ts';

export const account: Messages['account'] = {
	signedIn: 'Connecté avec OpenStreetMap',
	canSaveEdits: 'peut enregistrer les modifications',
	savingUnavailable: 'L’enregistrement sur OpenStreetMap n’est pas disponible pour le moment.',
	grantEditPermission: 'Autoriser les modifications',
	unlink: {
		signOutNote: 'La déconnexion met fin à la session sur cet appareil.',
		forgetLogin: 'Oublier mes identifiants OpenStreetMap',
		revokeNote:
			'supprime aussi le jeton d’accès enregistré. Pour révoquer totalement l’accès, utilisez',
		osmAppSettings: 'les paramètres des applications OpenStreetMap ↗'
	},
	signInPrompt:
		'Connectez-vous avec OpenStreetMap pour corriger les détails des remontées et des pistes ou ajouter des webcams.'
};
