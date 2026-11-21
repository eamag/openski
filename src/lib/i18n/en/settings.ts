export const settings = {
	title: 'Settings',
	close: 'Close settings',
	language: 'Language',
	languageAuto: (deviceLanguage: string) => `Same as this phone (${deviceLanguage})`,
	languageHint: 'Resort, piste and lift names stay as they are mapped.',
	appearance: 'Appearance',
	theme: {
		auto: 'Auto',
		autoHint: 'Follow this phone',
		light: 'Light',
		lightHint: 'Bright, like the snow',
		dark: 'Dark',
		darkHint: 'Gentler on the eyes at night',
		sunset: 'Dark after sunset',
		sunsetHint: 'Goes dark at the resort after sundown'
	},
	mapDisplay: 'Map display',
	account: 'Account',
	offlineData: 'Offline data',
	removeSaved: (name: string) => `Remove ${name} from this device`,
	savedDays: 'Saved days',
	forgetDays: (resortName: string) =>
		`Forget every day recorded at ${resortName}? This cannot be undone.`,
	confirmClear: 'Yes, clear',
	keepDays: 'Keep them',
	clearDays: 'Clear days at this resort',
	clearDaysHint: 'Tracks, ticked pistes and lifts',
	aboutResort: (name: string) => `About ${name}`,
	aboutResortHint: 'Pistes, lifts and piste maps',
	sourceCode: 'Source code on GitHub',
	sourceCodeHint: 'Repository is not public yet'
};
