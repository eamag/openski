import { plural } from '../intl.ts';

export const queues = {
	level: {
		none: 'No queue',
		short: 'Short queue',
		queue: 'Queue',
		long: 'Long queue'
	},
	hideBoxes: 'Hide the boxes',
	showBoxes: 'Show the boxes',
	pictureAlt: (time: string, people: number) =>
		`Webcam picture from ${time} with ${plural(people, { one: '# person', other: '# people' })} marked`,
	pictureMissingDevice:
		'The picture for this count is no longer on this device. Check again to see it.',
	boxedSummary: (count: number, cameraName: string, time: string) =>
		count === 0
			? `Nobody found in the ${cameraName} webcam picture from ${time}.`
			: `${plural(count, { one: '# person', other: '# people' })} boxed in the ${cameraName} webcam picture from ${time}.`,
	tapToHideBoxes: 'Tap the picture to hide the boxes and count for yourself.',
	originalPicture: (current?: number, total?: number) =>
		current && total ? `Original picture ${current}/${total}` : 'Original picture',
	openWebcam: 'Open the webcam',
	error: {
		needsConnection:
			'Counting queues needs a connection: the webcam pictures are downloaded each time.',
		noWebcamList: 'Could not load the list of webcams.',
		webcamsNotAnswering: 'The webcams are not answering.',
		noWebcamImages: 'Could not load the webcam images.',
		camerasFailed: (failed: number, total: number, atTime?: boolean) =>
			`${failed} of ${total} cameras gave no picture${atTime ? ' for that time' : ''}.`,
		checkFailed: 'Could not check the queues.',
		cannotDrawOffscreen: 'This browser cannot draw off screen.',
		modelDownloadFailed: (status: number) =>
			`The people counter did not download (error ${status}). Try again.`,
		noPicturesToday: 'The camera has no pictures from today.'
	}
};
