import type { Messages } from '../en/index.ts';
import { plural } from '../intl.ts';

export const track: Messages['track'] = {
	activity: {
		lift: 'En remontée',
		ride: 'En descente',
		recording: 'Enregistrement'
	},
	stats: {
		max: 'Max',
		distance: 'Distance',
		vertical: 'Dénivelé',
		runs: 'Descentes'
	},
	liftsCount: (count: number) => plural(count, { one: '# remontée', other: '# remontées' }),
	locationBlocked:
		'L’accès à la position est bloqué pour ce site. Autorisez-le dans les paramètres du navigateur pour enregistrer.',
	wakeLockFailed:
		'Impossible de maintenir l’écran allumé. L’enregistrement se met en pause dès que l’écran s’éteint.',
	stopAndSave: 'Arrêter et enregistrer',
	unfinishedRecording: (date: string) => `Enregistrement inachevé du ${date}`,
	pointsKept: (count: number) =>
		plural(count, { one: '# point a été conservé.', other: '# points ont été conservés.' }),
	resume: 'Reprendre',
	discard: 'Abandonner',
	pocket: {
		whyTitle: 'L’enregistrement dans la poche nécessite l’application mobile',
		whyBody:
			'Une application web, même ajoutée à l’écran d’accueil, ne reçoit plus de signal GPS quand l’écran s’éteint. Vous pouvez ici enregistrer avec l’écran allumé\u00A0; pour enregistrer le téléphone dans la poche, il vous faut l’application mobile openski.org.',
		getPhoneApp: 'Obtenir l’application mobile',
		recordScreenOn: 'Enregistrer avec l’écran allumé',
		storesTitle: 'L’application mobile n’est pas encore disponible sur les stores',
		storesBody:
			'openski.org est gratuit et développé par une seule personne, qui n’a pas encore de compte développeur App Store ou Google Play. Financer le projet permet de les payer. Vous pouvez aussi m’écrire pour être prévenu dès la sortie.',
		sponsorGithub: 'Soutenir sur GitHub',
		writeMe: 'M’écrire'
	},
	startRecording: 'Démarrer l’enregistrement',
	import: 'Importer',
	screenNotice:
		'L’enregistrement nécessite que l’écran reste allumé\u00A0: une application web n’a pas de GPS lorsque le téléphone est verrouillé. Pour enregistrer dans votre poche, utilisez votre montre ou Strava et importez le fichier GPX ici.',
	notice: {
		saved: 'Session enregistrée.',
		tooShort: 'Trop court pour être enregistré.',
		imported: (added: number, gained: number) => {
			const tracks = plural(added, { one: '# trace', other: '# traces' });
			const segments = plural(gained, {
				one: '# nouveau tronçon de piste',
				other: '# nouveaux tronçons de piste'
			});
			return `${tracks} importée${added > 1 ? 's' : ''}\u00A0: ${segments} parcouru${gained > 1 ? 's' : ''}.`;
		},
		notInResort: (resortName: string) => `Cette trace n’est pas située à ${resortName}.`,
		couldNotRead: 'Impossible de lire ce fichier. Les formats GPX et TCX sont pris en charge.',
		noTrackFound: 'Aucune trace trouvée dans ce fichier.',
		pointsNoLongerStored: 'Les points de cette session ne sont plus conservés.'
	},
	sessions: 'Sessions',
	emptySessions: 'Rien d’enregistré ici pour le moment.',
	source: {
		import: 'importée',
		live: 'enregistrée'
	},
	bpm: 'bpm',
	exportGpx: 'Exporter le GPX',
	deleteSession: 'Supprimer la session',
	runs: (count: number) => plural(count, { one: 'descente', other: 'descentes' }),
	vertical: 'dénivelé',
	max: 'max'
};
