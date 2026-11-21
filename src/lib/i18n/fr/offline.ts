import type { Messages } from '../en/index.ts';
import { plural } from '../intl.ts';

export const offline: Messages['offline'] = {
	description: (name: string) =>
		`Enregistre le fond de carte, le relief et les prévisions de ${name} sur cet appareil, pour que l’ensemble du plan fonctionne sans réseau. Les pistes, itinéraires et le suivi fonctionnent hors ligne une fois enregistrés.`,
	saving: 'Enregistrement…',
	savingPercent: (percent: number) => `Enregistrement… ${percent}\u00A0%`,
	updateMap: 'Mettre à jour le plan hors ligne',
	retryFailed: (failedCount: number) =>
		`Réessayer le téléchargement (${failedCount} manquant${failedCount > 1 ? 's' : ''})`,
	downloadForOffline: 'Télécharger pour une utilisation hors ligne',
	downloadFailed: (count: number) =>
		plural(count, {
			one: 'Échec du téléchargement pour # fichier. Vérifiez votre connexion et réessayez.',
			other: 'Échec du téléchargement pour # fichiers. Vérifiez votre connexion et réessayez.'
		}),
	needServiceWorker: 'Les plans hors ligne nécessitent un service worker.',
	appInstalling: 'L’application est encore en cours d’installation. Réessayez dans un instant.'
};
