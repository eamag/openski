import type { Messages } from '../en/index.ts';

export const settings: Messages['settings'] = {
	title: 'Paramètres',
	close: 'Fermer les paramètres',
	language: 'Langue',
	languageAuto: (deviceLanguage: string) => `Identique à cet appareil (${deviceLanguage})`,
	languageHint:
		'Les noms des domaines, pistes et remontées restent tels qu’ils sont cartographiés.',
	appearance: 'Apparence',
	theme: {
		auto: 'Automatique',
		autoHint: 'Identique à cet appareil',
		light: 'Clair',
		lightHint: 'Lumineux, comme la neige',
		dark: 'Sombre',
		darkHint: 'Plus doux pour les yeux la nuit',
		sunset: 'Sombre après le coucher du soleil',
		sunsetHint: 'Passe en sombre après le coucher du soleil sur le domaine'
	},
	mapDisplay: 'Affichage du plan',
	account: 'Compte',
	offlineData: 'Données hors ligne',
	removeSaved: (name: string) => `Supprimer ${name} de cet appareil`,
	savedDays: 'Journées enregistrées',
	forgetDays: (resortName: string) =>
		`Oublier toutes les journées enregistrées à ${resortName}\u202F? Cette action est irréversible.`,
	confirmClear: 'Oui, effacer',
	keepDays: 'Les conserver',
	clearDays: 'Effacer les journées sur ce domaine',
	clearDaysHint: 'Traces, pistes et remontées cochées',
	aboutResort: (name: string) => `À propos de ${name}`,
	aboutResortHint: 'Pistes, remontées et plans des pistes',
	sourceCode: 'Code source sur GitHub',
	sourceCodeHint: 'Le dépôt n’est pas encore public'
};
