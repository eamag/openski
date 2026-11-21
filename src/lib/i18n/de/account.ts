import type { Messages } from '../en/index.ts';

export const account: Messages['account'] = {
	signedIn: 'Mit OpenStreetMap angemeldet',
	canSaveEdits: 'kann Änderungen speichern',
	savingUnavailable: 'Speichern auf OpenStreetMap ist gerade nicht verfügbar.',
	grantEditPermission: 'Bearbeitungsrechte erteilen',
	unlink: {
		signOutNote: 'Abmelden beendet die Sitzung auf diesem Gerät.',
		forgetLogin: 'Mein OpenStreetMap-Login vergessen',
		revokeNote:
			'löscht auch das gespeicherte Zugriffs-Token. Um den Zugriff vollständig zu widerrufen, öffne',
		osmAppSettings: 'OpenStreetMap-App-Einstellungen ↗'
	},
	signInPrompt:
		'Melde dich mit OpenStreetMap an, um Angaben zu Liften und Pisten zu korrigieren oder Webcams hinzuzufügen.'
};
