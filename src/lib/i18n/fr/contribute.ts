import type { Messages } from '../en/index.ts';
import { formatMeters, formatNumber, formatUnit, plural } from '../intl.ts';

export const contribute: Messages['contribute'] = {
	title: 'Ajouter une webcam',
	pageTitle: 'Ajouter une webcam · openski.org',
	backToMap: '← Plan',
	resortSearchLabel: 'Domaine',
	resortPlaceholder: (name: string) => `Domaine\u00A0: ${name}`,
	errorStatus: (status: number) => `erreur ${formatNumber(status)}`,
	account: {
		checking: 'Vérification de la connexion…',
		notConfigured: 'Les comptes ne sont pas configurés sur ce déploiement.',
		signedInAs: 'Connecté en tant que',
		logOut: 'Se déconnecter',
		notSignedIn: 'Non connecté.',
		signInWithOsm: 'Se connecter avec OpenStreetMap'
	},
	saved: {
		title: (resortName: string) => `Webcams enregistrées\u00A0: ${resortName}`,
		empty: 'Rien d’enregistré pour ce domaine pour l’instant.',
		boxesCount: (count: number) => plural(count, { one: '# zone', other: '# zones' }),
		suggestedMine: (count: number) =>
			`, ${plural(count, { one: '# suggestion', other: '# suggestions' })}`,
		suggestedReview: (count: number) =>
			`, ${plural(count, { one: '# suggérée, en attente de validation', other: '# suggérées, en attente de validation' })}`,
		yours: '· les vôtres',
		waitingForReview: 'suggérée, en attente de validation',
		publishing: 'Publication…',
		publishBoxes: 'Publier les zones',
		editBoxes: 'Modifier les zones',
		reviewHint:
			'Seules les zones confirmées sont utilisées pour compter les files d’attente. Modifier une caméra existante enregistre ses zones nouvelles ou déplacées comme suggestions\u00A0; elles ne modifient donc pas les comptages publics avant publication. Une toute nouvelle caméra est publiée dès son premier enregistrement.',
		confirmDelete: (name: string) => `Supprimer «\u00A0${name}\u00A0» et ses zones\u202F?`,
		publishSuccess: (name: string) => `${name}\u00A0: zones suggérées publiées.`
	},
	url: {
		title: 'Collez l’adresse de la page webcam',
		placeholder: 'https://...panomax.com/..., roundshot.com, skaping.com',
		reading: 'Lecture de la page…',
		read: 'Lire la page',
		errorTitle: 'Impossible de lire cette page',
		pageDidNotAnswer: (status: number) =>
			`La page n’a pas répondu (erreur ${formatNumber(status)}).`
	},
	editing: {
		noticeBefore: 'Modification des zones de ',
		noticeAfter:
			'. Seules les zones sont enregistrées\u00A0; l’emplacement de la caméra reste inchangé.',
		stopEditing: 'Arrêter la modification'
	},
	position: {
		title: 'Emplacement de la caméra',
		provider: 'Fournisseur',
		picture: 'Image',
		dimensions: (w: number, h: number) => `${formatNumber(w)} × ${formatNumber(h)}\u00A0px`,
		elevation: 'Altitude',
		cameraName: 'Nom de la caméra',
		resortMap: (name: string) => `Plan du domaine (${name})`,
		coords: (lat: number, lon: number) =>
			`lat\u00A0: ${formatNumber(lat, 5)}, lon\u00A0: ${formatNumber(lon, 5)}`,
		is360: 'La caméra effectue un tour complet (360°)',
		direction: 'Orientation de la vue',
		cardinal: {
			north: 'N',
			east: 'E',
			south: 'S',
			west: 'O'
		},
		compassButton: (dir: string, deg: number) => `${dir} (${formatUnit(deg, 'degree')})`
	},
	map: {
		instruction: 'Touchez la carte ou déplacez le repère pour positionner la caméra.',
		gestureHint:
			'Un doigt / molette fait défiler la page\u00A0; deux doigts (ou Ctrl + molette) déplacent la carte.',
		recenterTitle: 'Centrer sur la caméra',
		recenter: 'Recentrer'
	},
	boxes: {
		title: 'Tracez les zones où les personnes font la queue',
		addBox: '+ Ajouter une zone',
		pictureTool: 'Outil image',
		drawBox: '✎ Tracer une zone',
		panPicture: '✥ Déplacer l’image',
		suggestBoxes: 'Suggérer des zones',
		smallerPicture: 'Image plus petite',
		biggerPicture: 'Image plus grande',
		drawHintBefore: 'Tracez une boîte sur l’image (tactile ou souris). Passez à ',
		drawHintPan: 'Déplacer l’image',
		drawHintAfter:
			' pour glisser horizontalement sur les panoramas\u00A0; utilisez − / + pour zoomer.',
		viewportAriaLabel: 'Image webcam avec zones d’observation des files d’attente',
		stageAriaLabel: 'Surface de tracé des zones de file d’attente',
		defaultAlt: 'Flux en direct de la webcam',
		noPicture: 'Aucune image disponible',
		placementHint: 'Marquez où les personnes attendent\u00A0: le sas d’attente ou les portillons.',
		countTitle: (count: number) => `Zones (${formatNumber(count)})`,
		defaultLabelWithLift: 'Portillons de la gare de départ',
		defaultLabel: 'Zone d’attente',
		redraw: 'Retracer',
		liftLabel: 'Remontée (la plus proche d’abord)',
		noneLift: 'Aucune (pas une file de remontée)',
		liftOption: (name: string, distMeters: number) => `${name} (à ${formatMeters(distMeters)})`,
		label: 'Libellé',
		labelPlaceholder: 'ex. Portillons de la gare de départ',
		upscaleLabel: 'Agrandir avant le comptage',
		upscaleOptions: {
			1: '1× (personnes grandes)',
			2: '2× (file éloignée)',
			3: '3× (très éloignée)',
			4: '4× (silhouettes minuscules)'
		},
		cornersLabel: 'Coins de la zone en pixels (gauche, haut, droite, bas)',
		cornerX0: 'x0',
		cornerY0: 'y0',
		cornerX1: 'x1',
		cornerY1: 'y1'
	},
	suggest: {
		badge: (n: number) => `S${formatNumber(n)}`,
		loadingDetector: 'Chargement du détecteur de personnes…',
		progressPanomax: (done: number, total: number) =>
			`Recherche de personnes sur les images du jour\u00A0: ${formatNumber(done)} sur ${formatNumber(total)}…`,
		progressStill: 'Recherche de personnes sur l’image…',
		noneFoundPanomax:
			'Aucun endroit fréquenté régulièrement aujourd’hui. Réessayez dans l’après-midi ou tracez la zone vous-même.',
		noneFoundStill:
			'Personne sur l’image actuelle. Réessayez pendant que les remontées fonctionnent ou tracez la zone vous-même.',
		title: (count: number) => `Suggestions (${formatNumber(count)})`,
		hint: 'Endroits où des personnes sont apparues régulièrement aujourd’hui. Conservez celles correspondant à une file\u00A0; pour une caméra existante, Enregistrer les stocke comme suggestions jusqu’à leur publication dans la liste ci-dessus.',
		summary: (people: number, frames: number, farAway: boolean) =>
			`${plural(people, { one: '# personne', other: '# personnes' })} sur ${plural(frames, { one: '# image', other: '# images' })}${farAway ? ' · éloignée' : ''}`,
		use: 'Utiliser',
		dismiss: 'Ignorer'
	},
	save: {
		titleBoxes: 'Enregistrer les zones',
		titleCamera: 'Enregistrer la caméra',
		saving: 'Enregistrement…',
		saveBoxesCount: (count: number) =>
			`Enregistrer ${plural(count, { one: '# zone', other: '# zones' })}`,
		saveCameraWithBoxes: (count: number) =>
			`Enregistrer la caméra avec ${plural(count, { one: '# zone', other: '# zones' })}`,
		pasteFirst: 'Collez d’abord l’adresse d’une webcam.',
		signInBefore: '',
		signInLink: 'Connectez-vous avec OpenStreetMap',
		signInAfter: ' pour enregistrer cette caméra et ses zones.',
		noAccount: 'L’enregistrement nécessite un compte, absent de ce déploiement.',
		failed: (status: number) => `Échec de l’enregistrement (erreur ${formatNumber(status)}).`,
		savedAndPublished: 'Caméra enregistrée et publiée.',
		savedSuggestions:
			'Zones enregistrées comme suggestions. Publiez-les depuis la liste ci-dessus pour les inclure dans les comptages.'
	}
};
