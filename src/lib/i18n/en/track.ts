import { plural } from '../intl.ts';

export const track = {
	activity: {
		lift: 'On lift',
		ride: 'Riding',
		recording: 'Recording'
	},
	stats: {
		max: 'Max',
		distance: 'Distance',
		vertical: 'Vertical',
		runs: 'Runs'
	},
	liftsCount: (count: number) => plural(count, { one: '# lift', other: '# lifts' }),
	locationBlocked:
		'Location access is blocked for this site. Allow it in the browser settings to record.',
	wakeLockFailed:
		'Could not keep the screen awake. Recording pauses whenever the screen turns off.',
	stopAndSave: 'Stop and save',
	unfinishedRecording: (date: string) => `Unfinished recording from ${date}`,
	pointsKept: (count: number) =>
		plural(count, { one: '# point was kept.', other: '# points were kept.' }),
	resume: 'Resume',
	discard: 'Discard',
	pocket: {
		whyTitle: 'Pocket tracking needs the phone app',
		whyBody:
			'A web app, even one added to the home screen, gets no GPS once the screen turns off. Here you can record with the screen on; to track with the phone in your pocket you need the openski.org phone app.',
		getPhoneApp: 'Get the phone app',
		recordScreenOn: 'Record with the screen on',
		storesTitle: "The phone app isn't in the stores yet",
		storesBody:
			"openski.org is free and made by one person, who doesn't have an App Store or Google Play developer account yet. Sponsoring the project pays for them. Or write me and I'll tell you when the app is out.",
		sponsorGithub: 'Sponsor on GitHub',
		writeMe: 'Write me'
	},
	startRecording: 'Start recording',
	import: 'Import',
	screenNotice:
		'Recording needs the screen on: a web app gets no GPS while the phone is locked. For pocket tracking, record with your watch or Strava and import the GPX file here.',
	notice: {
		saved: 'Session saved.',
		tooShort: 'Too short to save.',
		imported: (added: number, gained: number) => {
			const tracks = plural(added, { one: '# track', other: '# tracks' });
			const segments = plural(gained, {
				one: '# new piste segment',
				other: '# new piste segments'
			});
			return `Imported ${tracks}: ${segments} covered.`;
		},
		notInResort: (resortName: string) => `That track is not in ${resortName}.`,
		couldNotRead: 'Could not read that file. GPX and TCX are supported.',
		noTrackFound: 'No track found in that file.',
		pointsNoLongerStored: 'The points of this session are no longer stored.'
	},
	sessions: 'Sessions',
	emptySessions: 'Nothing recorded here yet.',
	source: {
		import: 'imported',
		live: 'recorded'
	},
	bpm: 'bpm',
	exportGpx: 'Export GPX',
	deleteSession: 'Delete session',
	runs: (count: number) => plural(count, { one: 'run', other: 'runs' }),
	vertical: 'vertical',
	max: 'max'
};
