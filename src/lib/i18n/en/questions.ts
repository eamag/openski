import { formatNumber, plural } from '../intl.ts';

export const questions = {
	backToMap: 'Back to the map',
	title: (resortName: string) => `Help map ${resortName}`,
	thisResort: 'this resort',
	questionsLeft: (count: number) =>
		plural(count, { one: '# question left', other: '# questions left' }),
	drafted: (count: number) => `${formatNumber(count)} drafted`,
	answersSaved: (changesetId: number) => `Answers saved · changeset #${changesetId}`,
	testNodeCreated: (changesetId: number) =>
		`Test node created on the OSM dev server · changeset #${changesetId}`,
	viewChangeset: 'View changeset on OpenStreetMap ↗',
	answersNotSaved: (count: number) =>
		plural(count, { one: '# answer not saved yet', other: '# answers not saved yet' }),
	checkAndSaveHint: 'Check them, then save them to OpenStreetMap',
	reviewAndSave: 'Review and save',
	signInPrompt: 'Answer away; sign in with OpenStreetMap when you want to save.',
	cantSaveYet: "Can't save yet",
	savingUnavailable: 'Saving to OpenStreetMap is not available right now.',
	grantEditPermission: 'Grant edit permission',
	loadError: (error: string) => `The questions did not load (${error}).`,
	lift: 'Lift',
	piste: 'Piste',
	distanceAway: (distance: string) => `${distance} away`,
	sections: (count: number) => plural(count, { one: '# section', other: '# sections' }),
	anotherNumber: 'Another number',
	typeItHere: 'Type it here',
	ok: 'OK',
	skip: 'Not sure · next question',
	allAnswered: 'No questions left here: every lift and piste has these details. Thank you!',
	addWebcam: 'Add a webcam and its queue areas',
	savingToServer: (server: string, isTest: boolean) =>
		`Saving to ${server}${isTest ? ' (the test server)' : ''}.`,
	review: {
		title: 'Review your answers',
		ariaLabel: 'Review your answers',
		close: 'Close review',
		answersTogether: (count: number) =>
			`${plural(count, { one: '# answer', other: '# answers' })}, saved together as one changeset`,
		notSaved: 'Not saved',
		tagsToAdd: 'Tags to add',
		removeAnswer: 'Remove answer',
		waysCount: (count: number) => plural(count, { one: '# way', other: '# ways' }),
		wayRef: (wayId: number) => `way #${wayId}`,
		comment: 'Changeset comment',
		source: 'Source',
		surveyHint: '"survey" means you saw it on the slopes yourself.',
		surveyExplanation:
			'Your answers must come from your own on-the-ground survey on the mountain, not copied from third-party piste maps. They only fill tags that are still missing and are saved to OpenStreetMap under your own account, where anyone can see and improve them.',
		saveToOsm: 'Save to OpenStreetMap',
		saving: 'Saving…',
		signInToSave: 'Sign in with OpenStreetMap to save',
		savingUnavailable: 'Saving to OpenStreetMap is not available right now.'
	},
	errors: {
		signInRequired: 'Sign in with OpenStreetMap to save your answers.',
		conflict:
			'Someone changed these ways on OpenStreetMap a moment ago. Close this, reopen the questions and try again.',
		savingFailed: (status: number) => `Saving failed (error ${status}).`,
		noConnection: 'No connection. Your answers are still here; try again when you are online.'
	}
};
