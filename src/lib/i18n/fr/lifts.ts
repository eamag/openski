import type { Messages } from '../en/index.ts';

export const lifts: Messages['lifts'] = {
	type: {
		cable_car: 'Téléphérique',
		gondola: 'Télécabine',
		mixed_lift: 'Télémix',
		chair_lift: 'Télésiège',
		't-bar': 'Téléski à archets',
		'j-bar': 'Téléski à archet simple',
		platter: 'Téléski à perches',
		drag_lift: 'Téléski',
		rope_tow: 'Fil-neige',
		magic_carpet: 'Tapis roulant'
	},
	withSeats: (seats: number, typeName: string) =>
		`${typeName} ${seats}\u00A0place${seats > 1 ? 's' : ''}`
};
