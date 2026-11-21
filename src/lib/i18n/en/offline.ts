import { plural } from '../intl.ts';

export const offline = {
	description: (name: string) =>
		`Saves the ${name} base map, terrain and forecast on this device, so the whole map works without signal. Pistes, routes and tracking work offline once saved.`,
	saving: 'Saving…',
	savingPercent: (percent: number) => `Saving… ${percent}%`,
	updateMap: 'Update offline map',
	retryFailed: (failedCount: number) => `Retry download (${failedCount} missing)`,
	downloadForOffline: 'Download for offline use',
	downloadFailed: (count: number) =>
		plural(count, {
			one: '# file failed to download. Check connection and retry.',
			other: '# files failed to download. Check connection and retry.'
		}),
	needServiceWorker: 'Offline maps need a service worker.',
	appInstalling: 'The app is still installing. Try again in a moment.'
};
