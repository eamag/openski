import { formatMeters, formatNumber, formatUnit, plural } from '../intl.ts';

export const contribute = {
	title: 'Add a webcam',
	pageTitle: 'Add a webcam · openski.org',
	backToMap: '← Map',
	resortSearchLabel: 'Resort',
	resortPlaceholder: (name: string) => `Resort: ${name}`,
	errorStatus: (status: number) => `error ${formatNumber(status)}`,
	account: {
		checking: 'Checking sign-in…',
		notConfigured: 'Accounts are not set up on this deployment.',
		signedInAs: 'Signed in as',
		logOut: 'Log out',
		notSignedIn: 'Not signed in.',
		signInWithOsm: 'Sign in with OpenStreetMap'
	},
	saved: {
		title: (resortName: string) => `Saved webcams: ${resortName}`,
		empty: 'Nothing saved for this resort yet.',
		boxesCount: (count: number) => plural(count, { one: '# box', other: '# boxes' }),
		suggestedMine: (count: number) =>
			`, ${plural(count, { one: '# suggested', other: '# suggested' })}`,
		suggestedReview: (count: number) =>
			`, ${plural(count, { one: '# suggested, waiting for review', other: '# suggested, waiting for review' })}`,
		yours: '· yours',
		waitingForReview: 'suggested, waiting for review',
		publishing: 'Publishing…',
		publishBoxes: 'Publish boxes',
		editBoxes: 'Edit boxes',
		reviewHint:
			'Only confirmed boxes are used for queue counts. Editing an existing camera saves its new or moved boxes as suggestions, so they never change public counts until you publish them. A brand-new camera is published on its first save.',
		confirmDelete: (name: string) => `Delete "${name}" and its boxes?`,
		publishSuccess: (name: string) => `${name}: suggested boxes published.`
	},
	url: {
		title: 'Paste the webcam page address',
		placeholder: 'https://...panomax.com/..., roundshot.com, skaping.com',
		reading: 'Reading the page…',
		read: 'Read the page',
		errorTitle: 'Could not read that page',
		pageDidNotAnswer: (status: number) => `The page did not answer (error ${formatNumber(status)}).`
	},
	editing: {
		noticeBefore: 'Editing the boxes of ',
		noticeAfter: '. Only the boxes are saved; where the camera stands stays as it is.',
		stopEditing: 'Stop editing'
	},
	position: {
		title: 'Where the camera is',
		provider: 'Provider',
		picture: 'Picture',
		dimensions: (w: number, h: number) => `${formatNumber(w)} × ${formatNumber(h)} px`,
		elevation: 'Elevation',
		cameraName: 'Camera name',
		resortMap: (name: string) => `Resort Map (${name})`,
		coords: (lat: number, lon: number) =>
			`lat: ${formatNumber(lat, 5)}, lon: ${formatNumber(lon, 5)}`,
		is360: 'The camera turns all the way round (360°)',
		direction: 'Which way it looks',
		cardinal: {
			north: 'N',
			east: 'E',
			south: 'S',
			west: 'W'
		},
		compassButton: (dir: string, deg: number) => `${dir} (${formatUnit(deg, 'degree')})`
	},
	map: {
		instruction: 'Tap the map or drag the marker to set the camera position.',
		gestureHint: 'One finger / wheel scrolls the page; two fingers (or Ctrl + wheel) pan the map.',
		recenterTitle: 'Center on camera',
		recenter: 'Recenter'
	},
	boxes: {
		title: 'Draw boxes where people queue',
		addBox: '+ Add a box',
		pictureTool: 'Picture tool',
		drawBox: '✎ Draw box',
		panPicture: '✥ Pan picture',
		suggestBoxes: 'Suggest boxes',
		smallerPicture: 'Smaller picture',
		biggerPicture: 'Bigger picture',
		drawHintBefore: 'Drag a box on the picture (touch or mouse). Switch to ',
		drawHintPan: 'Pan picture',
		drawHintAfter: ' to swipe sideways on panoramas; use − / + to zoom.',
		viewportAriaLabel: 'Webcam picture with queue observation boxes',
		stageAriaLabel: 'Queue box drawing surface',
		defaultAlt: 'Webcam live feed',
		noPicture: 'No picture available',
		placementHint: 'Mark where people queue: the corral or the turnstile gates.',
		countTitle: (count: number) => `Boxes (${formatNumber(count)})`,
		defaultLabelWithLift: 'Valley station gates',
		defaultLabel: 'Queue area',
		redraw: 'Redraw',
		liftLabel: 'Lift (nearest first)',
		noneLift: 'None (not a lift queue)',
		liftOption: (name: string, distMeters: number) => `${name} (${formatMeters(distMeters)} away)`,
		label: 'Label',
		labelPlaceholder: 'e.g. Valley station gates',
		upscaleLabel: 'Enlarge before counting',
		upscaleOptions: {
			1: '1× (people are large)',
			2: '2× (queue is far off)',
			3: '3× (very far)',
			4: '4× (tiny figures)'
		},
		cornersLabel: 'Box corners in pixels (left, top, right, bottom)',
		cornerX0: 'x0',
		cornerY0: 'y0',
		cornerX1: 'x1',
		cornerY1: 'y1'
	},
	suggest: {
		badge: (n: number) => `S${formatNumber(n)}`,
		loadingDetector: 'Loading the people detector…',
		progressPanomax: (done: number, total: number) =>
			`Looking for people in today's pictures: ${formatNumber(done)} of ${formatNumber(total)}…`,
		progressStill: 'Looking for people in the picture…',
		noneFoundPanomax:
			'No place where people kept turning up today. Try again in the afternoon, or draw the box.',
		noneFoundStill:
			'Nobody in the current picture. Try again while the lifts run, or draw the box.',
		title: (count: number) => `Suggested (${formatNumber(count)})`,
		hint: 'Places where people kept turning up today. Use the ones that are a lift queue; for an existing camera, Save stores them as suggestions until you publish them from the list above.',
		summary: (people: number, frames: number, farAway: boolean) =>
			`${plural(people, { one: '# person', other: '# people' })} in ${plural(frames, { one: '# picture', other: '# pictures' })}${farAway ? ' · far away' : ''}`,
		use: 'Use',
		dismiss: 'Dismiss'
	},
	save: {
		titleBoxes: 'Save the boxes',
		titleCamera: 'Save the camera',
		saving: 'Saving…',
		saveBoxesCount: (count: number) => `Save ${plural(count, { one: '# box', other: '# boxes' })}`,
		saveCameraWithBoxes: (count: number) =>
			`Save camera with ${plural(count, { one: '# box', other: '# boxes' })}`,
		pasteFirst: 'Paste a webcam address first.',
		signInBefore: '',
		signInLink: 'Sign in with OpenStreetMap',
		signInAfter: ' to save this camera and its boxes.',
		noAccount: 'Saving needs an account, which this deployment does not have.',
		failed: (status: number) => `Saving failed (error ${formatNumber(status)}).`,
		savedAndPublished: 'Camera saved and published.',
		savedSuggestions:
			'Boxes saved as suggestions. Publish them from the list above to use them for queue counts.'
	}
};
