import type { Messages } from '../en/index.ts';
import { formatMinutes, plural } from '../intl.ts';

export const now: Messages['now'] = {
	liftQueues: 'Files d’attente des remontées',
	tabs: {
		pistes: 'Pistes',
		lifts: 'Remontées'
	},
	compass: ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'],
	windSpeed: (speed: string) => `vent ${speed}`,
	windUpTop: (speed: string, dir: string) => `vent au sommet ${speed} ${dir}`,
	snowing: 'chutes de neige',
	weatherSummary: (highTemp: string, highEle: string, lowTemp: string) =>
		`${highTemp} à ${highEle}, ${lowTemp} en vallée`,
	underOneMinute: 'moins d’1 min',
	aboutMinutes: (min: number) => `environ ${formatMinutes(min)}`,
	peopleCount: (count: number) => plural(count, { one: '# personne', other: '# personnes' }),
	makingSnapshot: 'Génération de l’instantané…',
	askAi: 'Demander à une IA quoi skier aujourd’hui',
	aiPrompt: (resortName: string, url: string, preference: string) =>
		`Je skie à ${resortName} aujourd'hui. Cette page montre le domaine en direct\u00A0: les remontées et pistes ` +
		`ouvertes, la neige, la lumière et le vent sur chaque piste heure par heure, et les files d'attente comptées sur les webcams\u00A0: ${url}\n\n` +
		`Consulte-la et suggère-moi quoi skier pour le reste de la journée${preference}. ` +
		`Associe à chaque piste et remontée mentionnée son lien depuis cette page.`,
	aiFilterPreference: (label: string) => ` (j’aime les pistes ${label.toLowerCase()}s)`,
	copiedPrompt: 'Copié\u00A0: collez-le dans le chat de votre choix.',
	openPrompt: 'Ouvrir dans un chat IA\u00A0:',
	aiPromptHint: 'L’IA lit l’instantané et répond avec des liens renvoyant ici.',
	snapshotError: (message: string) => `Impossible de générer l’instantané (${message}).`,
	noConnection: 'pas de connexion',
	calculatingConditions: 'Calcul du soleil, de la neige et du vent pour chaque piste…',
	bestAllDay: 'le meilleur toute la journée',
	bestTimeRange: (from: number, to: number) => `meilleur ${from}:00–${to}:00`,
	factors: {
		snow: 'Neige',
		light: 'Lumière',
		wind: 'Vent'
	},
	windWord: {
		calm: 'Calme',
		breezy: 'Brise',
		windy: 'Venteux',
		stormy: 'Tempétueux'
	},
	routeHere: 'Itinéraire jusqu’ici',
	scoreAria: (scoreWord: string, score: number) => `${scoreWord}, ${score} sur 100`,
	allClosedToday: 'Toutes les pistes de cette couleur sont fermées aujourd’hui.',
	noPistesOfColour: 'Aucune piste de cette couleur.',
	pistesReportedClosed: (count: number) =>
		plural(count, {
			one: '# piste signalée fermée aujourd’hui par le domaine est exclue.',
			other: '# pistes signalées fermées aujourd’hui par le domaine sont exclues.'
		}),
	disclaimer:
		'Estimation basée sur les prévisions météo, la trajectoire du soleil et le relief. Elle exclut ce que le domaine annonce fermé, mais ne sait pas ce qui a été fraîchement damé.',
	weatherDataBy: 'Données météo par',
	noWebcams: 'Aucune webcam configurée pour ce domaine pour l’instant',
	addWebcam: 'Ajouter une webcam',
	gettingCounter: (percent: string) => `Téléchargement du détecteur de personnes… ${percent}`,
	lookingForPictures: 'Recherche des dernières images webcam…',
	countingPeople: (done: number, total: number) =>
		`Comptage des personnes… ${done} sur ${total} vues`,
	liftsShutTitle: 'Les remontées sont fermées.',
	liftsShutDesc: (from: string, until: string) =>
		`Les files sont comptées de ${from} à ${until} (heure de la station).`,
	picturesFromTitle: (times: string) => `Images webcam de ${times}.`,
	picturesFromDesc: 'Touchez un comptage pour voir l’image correspondante.',
	countPeopleTitle: (count: number) =>
		plural(count, {
			one: 'Compter les personnes sur # webcam.',
			other: 'Compter les personnes sur # webcams.'
		}),
	countPeopleDesc:
		'Fonctionne sur votre téléphone. Chaque vérification télécharge les dernières images webcam\u00A0; la première télécharge aussi le détecteur de personnes de 15\u00A0Mo.',
	check: 'Vérifier',
	checkAgain: 'Vérifier à nouveau',
	inView: (people: string, time: string) => `${people} en vue · ${time}`,
	waitingSummary: (people: string, waitTime: string, time: string) =>
		`${people} en attente · ${waitTime} · ${time}`,
	noPictureFromCamera: (cameraName: string) => `Aucune image de la caméra ${cameraName}`,
	closedToday: 'Fermé aujourd’hui',
	cameraAt: (cameraName: string) => `caméra à ${cameraName}`,
	noWebcamLooksAtQueue: 'Aucune webcam ne donne sur une file d’attente dans ce domaine.',
	aroundMountain: 'Autour du domaine',
	aroundMountainHint: 'Personnes visibles là où la webcam ne montre aucune file de remontée.',
	turningCamera: ', caméra rotative',
	noPictureFromGenericCamera: 'Aucune image de la caméra',
	unwatchedSummary: (count: number) =>
		count === 0
			? 'Chaque remontée est couverte par une webcam.'
			: plural(count, {
					one: '# autre remontée est hors de vue de toute webcam.',
					other: '# autres remontées sont hors de vue de toute webcam.'
				}),
	queueDisclaimer:
		'Les comptages correspondent à ce que la caméra voit de la zone d’attente\u00A0; considérez une longue file comme «\u00A0au moins aussi longue\u00A0», et le brouillard ou la neige comme «\u00A0impossible à déterminer\u00A0». Les comptages récents sont utilisés pour les temps de trajet.',
	addWebcamOrArea: 'Ajouter une webcam ou une zone d’attente'
};
