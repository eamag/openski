export const lifts = {
	type: {
		cable_car: 'Cable car',
		gondola: 'Gondola',
		mixed_lift: 'Chondola',
		chair_lift: 'Chairlift',
		't-bar': 'T-bar',
		'j-bar': 'J-bar',
		platter: 'Platter lift',
		drag_lift: 'Drag lift',
		rope_tow: 'Rope tow',
		magic_carpet: 'Magic carpet'
	},
	/** "8-seat chairlift"; `typeName` is one of `type` above. */
	withSeats: (seats: number, typeName: string) => `${seats}-seat ${typeName.toLowerCase()}`
};
