/** Browser tab titles. The server writes the English ones into the page for search engines. */
export const titles = {
	home: 'OpenSki · Ski maps powered by OpenStreetMap',
	resorts: 'Ski areas',
	resortMap: (name: string, hasQueueCams: boolean) =>
		hasQueueCams
			? `${name} piste map, snow conditions and lift queues`
			: `${name} piste map and snow conditions`,
	resortNow: (name: string, hasQueueCams: boolean) =>
		hasQueueCams
			? `${name} snow conditions and lift queues today`
			: `${name} snow conditions today`,
	resortRoute: (name: string) => `${name} route planner for skis and snowboards`,
	resortAbout: (name: string) => `${name} ski area: pistes, lifts and piste maps`,
	resortTrack: (name: string) => `Record a day in ${name}`,
	resortProgress: (name: string) => `Pistes ridden in ${name}`,
	resortEdit: (name: string) => `Fix the ${name} map on OpenStreetMap`,
	resortQuestions: (name: string) => `Answer map questions about ${name}`
};
