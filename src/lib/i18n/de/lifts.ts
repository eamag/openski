import type { Messages } from '../en/index.ts';

export const lifts: Messages['lifts'] = {
	type: {
		cable_car: 'Seilbahn',
		gondola: 'Kabinenbahn',
		mixed_lift: 'Kombibahn',
		chair_lift: 'Sessellift',
		't-bar': 'Bügellift',
		'j-bar': 'Einerbügel',
		platter: 'Tellerlift',
		drag_lift: 'Schlepplift',
		rope_tow: 'Seillift',
		magic_carpet: 'Förderband'
	},
	/** "8-seat chairlift"; `typeName` is one of `type` above. */
	withSeats: (seats: number, typeName: string) => `${seats}er-${typeName}`
};
