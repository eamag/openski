import type { Messages } from '../en/index.ts';

/** Browser tab titles. The server writes the English ones into the page for search engines. */
export const titles: Messages['titles'] = {
	home: 'OpenSki · Skikarten auf Basis von OpenStreetMap',
	resorts: 'Skigebiete',
	resortMap: (name: string, hasQueueCams: boolean) =>
		hasQueueCams
			? `${name} Pistenplan, Schneeverhältnisse und Liftschlangen`
			: `${name} Pistenplan und Schneeverhältnisse`,
	resortNow: (name: string, hasQueueCams: boolean) =>
		hasQueueCams
			? `${name} Schneeverhältnisse und Liftschlangen heute`
			: `${name} Schneeverhältnisse heute`,
	resortRoute: (name: string) => `${name} Routenplaner für Ski und Snowboard`,
	resortAbout: (name: string) => `Skigebiet ${name}: Pisten, Lifte und Pistenpläne`,
	resortTrack: (name: string) => `Einen Skitag in ${name} aufzeichnen`,
	resortProgress: (name: string) => `Gefahrene Pisten in ${name}`,
	resortEdit: (name: string) => `Die Karte von ${name} auf OpenStreetMap verbessern`,
	resortQuestions: (name: string) => `Fragen zur Karte von ${name} beantworten`
};
