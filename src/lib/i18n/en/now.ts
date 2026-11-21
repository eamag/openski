import { formatMinutes, plural } from '../intl.ts';

export const now = {
	liftQueues: 'Lift queues',
	tabs: {
		pistes: 'Pistes',
		lifts: 'Lifts'
	},
	compass: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
	windSpeed: (speed: string) => `${speed} wind`,
	windUpTop: (speed: string, dir: string) => `wind up top ${speed} ${dir}`,
	snowing: 'snowing',
	weatherSummary: (highTemp: string, highEle: string, lowTemp: string) =>
		`${highTemp} at ${highEle}, ${lowTemp} in the valley`,
	underOneMinute: 'under 1 min',
	aboutMinutes: (min: number) => `about ${formatMinutes(min)}`,
	peopleCount: (count: number) => plural(count, { one: '# person', other: '# people' }),
	makingSnapshot: 'Making a snapshot…',
	askAi: 'Ask an AI what to ski today',
	aiPrompt: (resortName: string, url: string, preference: string) =>
		`I'm skiing in ${resortName} today. This page shows the resort right now: which lifts and pistes ` +
		`are open, snow, light and wind on every piste hour by hour, and lift queues counted on webcams: ${url}\n\n` +
		`Read it and suggest what I should ski for the rest of the day${preference}. ` +
		`Link every piste and lift you mention with its link from that page.`,
	aiFilterPreference: (label: string) => ` (I like ${label.toLowerCase()} pistes)`,
	copiedPrompt: 'Copied: paste it into any AI chat.',
	openPrompt: 'Open it in an AI chat:',
	aiPromptHint: 'It reads the snapshot and answers with links back here.',
	snapshotError: (message: string) => `Could not make the snapshot (${message}).`,
	noConnection: 'no connection',
	calculatingConditions: 'Working out sun, snow and wind for every piste…',
	bestAllDay: 'best all day',
	bestTimeRange: (from: number, to: number) => `best ${from}:00–${to}:00`,
	factors: {
		snow: 'Snow',
		light: 'Light',
		wind: 'Wind'
	},
	windWord: {
		calm: 'Calm',
		breezy: 'Breezy',
		windy: 'Windy',
		stormy: 'Stormy'
	},
	routeHere: 'Route here',
	scoreAria: (scoreWord: string, score: number) => `${scoreWord}, ${score} out of 100`,
	allClosedToday: 'Every piste of this colour is closed today.',
	noPistesOfColour: 'No pistes of this colour.',
	pistesReportedClosed: (count: number) =>
		plural(count, {
			one: '# piste the resort reports closed today is left out.',
			other: '# pistes the resort reports closed today are left out.'
		}),
	disclaimer:
		"An estimate from the weather forecast, the sun's path and the shape of the terrain. It leaves out what the resort reports closed, but does not know what was freshly groomed.",
	weatherDataBy: 'Weather data by',
	noWebcams: 'No webcams are set up for this resort yet',
	addWebcam: 'Add a webcam',
	gettingCounter: (percent: string) => `Getting the people counter… ${percent}`,
	lookingForPictures: 'Looking for the newest webcam pictures…',
	countingPeople: (done: number, total: number) => `Counting people… ${done} of ${total} views`,
	liftsShutTitle: 'The lifts are shut.',
	liftsShutDesc: (from: string, until: string) =>
		`Queues are counted from ${from} to ${until} resort time.`,
	picturesFromTitle: (times: string) => `Webcam pictures from ${times}.`,
	picturesFromDesc: 'Tap a count to see the picture it came from.',
	countPeopleTitle: (count: number) =>
		plural(count, {
			one: 'Count the people on # webcam.',
			other: 'Count the people on # webcams.'
		}),
	countPeopleDesc:
		'Runs on your phone. Each check downloads the newest webcam pictures; the first one also gets the 15 MB people counter.',
	check: 'Check',
	checkAgain: 'Check again',
	inView: (people: string, time: string) => `${people} in view · ${time}`,
	waitingSummary: (people: string, waitTime: string, time: string) =>
		`${people} waiting · ${waitTime} · ${time}`,
	noPictureFromCamera: (cameraName: string) => `No picture from the ${cameraName} camera`,
	closedToday: 'Closed today',
	cameraAt: (cameraName: string) => `camera at ${cameraName}`,
	noWebcamLooksAtQueue: 'No webcam looks at a lift queue in this resort.',
	aroundMountain: 'Around the mountain',
	aroundMountainHint: 'People in view where a webcam shows no lift queue.',
	turningCamera: ', turning camera',
	noPictureFromGenericCamera: 'No picture from the camera',
	unwatchedSummary: (count: number) =>
		count === 0
			? 'Every lift has a webcam on it.'
			: plural(count, {
					one: '# other lift is out of sight of every webcam.',
					other: '# other lifts are out of sight of every webcam.'
				}),
	queueDisclaimer:
		'Counts are what a camera can see of the waiting area, so treat a long queue as "at least this long", and fog or snowfall as "can\'t tell". Fresh counts are used for route times.',
	addWebcamOrArea: 'Add a webcam or a queue area'
};
