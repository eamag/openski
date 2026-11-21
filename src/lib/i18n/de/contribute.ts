import type { Messages } from '../en/index.ts';
import { formatMeters, formatNumber, formatUnit, plural } from '../intl.ts';

export const contribute: Messages['contribute'] = {
	title: 'Webcam hinzufügen',
	pageTitle: 'Webcam hinzufügen · openski.org',
	backToMap: '← Karte',
	resortSearchLabel: 'Skigebiet',
	resortPlaceholder: (name: string) => `Skigebiet: ${name}`,
	errorStatus: (status: number) => `Fehler ${formatNumber(status)}`,
	account: {
		checking: 'Anmeldung wird geprüft…',
		notConfigured: 'Auf dieser Instanz sind keine Benutzerkonten eingerichtet.',
		signedInAs: 'Angemeldet als',
		logOut: 'Abmelden',
		notSignedIn: 'Nicht angemeldet.',
		signInWithOsm: 'Mit OpenStreetMap anmelden'
	},
	saved: {
		title: (resortName: string) => `Gespeicherte Webcams: ${resortName}`,
		empty: 'Für dieses Skigebiet ist noch nichts gespeichert.',
		boxesCount: (count: number) => plural(count, { one: '# Box', other: '# Boxen' }),
		suggestedMine: (count: number) =>
			`, ${plural(count, { one: '# vorgeschlagen', other: '# vorgeschlagen' })}`,
		suggestedReview: (count: number) =>
			`, ${plural(count, { one: '# vorgeschlagen, wartet auf Prüfung', other: '# vorgeschlagen, warten auf Prüfung' })}`,
		yours: '· deine',
		waitingForReview: 'vorgeschlagen, wartet auf Prüfung',
		publishing: 'Wird veröffentlicht…',
		publishBoxes: 'Boxen veröffentlichen',
		editBoxes: 'Boxen bearbeiten',
		reviewHint:
			'Nur bestätigte Boxen werden für die Warteschlangen-Zählung verwendet. Beim Bearbeiten einer bestehenden Kamera werden neue oder verschobene Boxen als Vorschläge gespeichert, damit sie die öffentlichen Zählergebnisse erst ändern, wenn du sie veröffentlichst. Eine ganz neue Kamera wird beim ersten Speichern direkt veröffentlicht.',
		confirmDelete: (name: string) => `„${name}“ und zugehörige Boxen löschen?`,
		publishSuccess: (name: string) => `${name}: Vorgeschlagene Boxen veröffentlicht.`
	},
	url: {
		title: 'Webcam-Adresse einfügen',
		placeholder: 'https://...panomax.com/..., roundshot.com, skaping.com',
		reading: 'Seite wird geladen…',
		read: 'Seite laden',
		errorTitle: 'Seite konnte nicht geladen werden',
		pageDidNotAnswer: (status: number) =>
			`Die Seite hat nicht geantwortet (Fehler ${formatNumber(status)}).`
	},
	editing: {
		noticeBefore: 'Boxen bearbeiten für ',
		noticeAfter: '. Nur die Boxen werden gespeichert; der Standort der Kamera bleibt unverändert.',
		stopEditing: 'Bearbeitung beenden'
	},
	position: {
		title: 'Kamerastandort',
		provider: 'Anbieter',
		picture: 'Bild',
		dimensions: (w: number, h: number) => `${formatNumber(w)} × ${formatNumber(h)} px`,
		elevation: 'Höhe',
		cameraName: 'Kameraname',
		resortMap: (name: string) => `Skigebietskarte (${name})`,
		coords: (lat: number, lon: number) =>
			`Breite: ${formatNumber(lat, 5)}, Länge: ${formatNumber(lon, 5)}`,
		is360: 'Die Kamera dreht sich um 360°',
		direction: 'Blickrichtung',
		cardinal: {
			north: 'N',
			east: 'O',
			south: 'S',
			west: 'W'
		},
		compassButton: (dir: string, deg: number) => `${dir} (${formatUnit(deg, 'degree')})`
	},
	map: {
		instruction:
			'Tippe auf die Karte oder ziehe die Markierung, um den Kamerastandort festzulegen.',
		gestureHint:
			'Ein Finger / Mausrad scrollt die Seite; zwei Finger (oder Strg + Mausrad) bewegen die Karte.',
		recenterTitle: 'Auf Kamera zentrieren',
		recenter: 'Zentrieren'
	},
	boxes: {
		title: 'Boxen einzeichnen, wo Leute anstehen',
		addBox: '+ Box hinzufügen',
		pictureTool: 'Bildwerkzeug',
		drawBox: '✎ Box zeichnen',
		panPicture: '✥ Bild verschieben',
		suggestBoxes: 'Boxen vorschlagen',
		smallerPicture: 'Kleineres Bild',
		biggerPicture: 'Größeres Bild',
		drawHintBefore: 'Ziehe eine Box auf dem Bild auf (Touch oder Maus). Wechsle zu ',
		drawHintPan: 'Bild verschieben',
		drawHintAfter: ', um bei Panoramen seitlich zu wischen; nutze − / + zum Zoomen.',
		viewportAriaLabel: 'Webcambild mit Bereichen zur Beobachtung von Warteschlangen',
		stageAriaLabel: 'Zeichenfläche für Warteschlangen-Boxen',
		defaultAlt: 'Webcam-Livebild',
		noPicture: 'Kein Bild verfügbar',
		placementHint: 'Markiere, wo Leute anstehen: den Anstehbereich oder die Drehkreuze.',
		countTitle: (count: number) => `Boxen (${formatNumber(count)})`,
		defaultLabelWithLift: 'Talstations-Drehkreuze',
		defaultLabel: 'Wartebereich',
		redraw: 'Neu zeichnen',
		liftLabel: 'Lift (nächster zuerst)',
		noneLift: 'Keiner (keine Liftschlange)',
		liftOption: (name: string, distMeters: number) =>
			`${name} (${formatMeters(distMeters)} entfernt)`,
		label: 'Bezeichnung',
		labelPlaceholder: 'z. B. Talstations-Drehkreuze',
		upscaleLabel: 'Vor dem Zählen vergrößern',
		upscaleOptions: {
			1: '1× (Personen sind groß)',
			2: '2× (Schlange ist weit weg)',
			3: '3× (sehr weit)',
			4: '4× (winzige Figuren)'
		},
		cornersLabel: 'Ecken der Box in Pixeln (links, oben, rechts, unten)',
		cornerX0: 'x0',
		cornerY0: 'y0',
		cornerX1: 'x1',
		cornerY1: 'y1'
	},
	suggest: {
		badge: (n: number) => `S${formatNumber(n)}`,
		loadingDetector: 'Personenerkennung wird geladen…',
		progressPanomax: (done: number, total: number) =>
			`Suche nach Personen in den heutigen Bildern: ${formatNumber(done)} von ${formatNumber(total)}…`,
		progressStill: 'Suche nach Personen im Bild…',
		noneFoundPanomax:
			'Kein Ort gefunden, an dem heute wiederholt Personen standen. Versuche es am Nachmittag noch einmal oder zeichne die Box selbst ein.',
		noneFoundStill:
			'Keine Personen im aktuellen Bild gefunden. Versuche es während der Liftbetriebszeiten noch einmal oder zeichne die Box selbst ein.',
		title: (count: number) => `Vorgeschlagen (${formatNumber(count)})`,
		hint: 'Orte, an denen heute wiederholt Personen standen. Wähle diejenigen aus, die eine Liftschlange darstellen; bei einer bestehenden Kamera speichert „Speichern“ sie als Vorschläge, bis du sie in der Liste oben veröffentlichst.',
		summary: (people: number, frames: number, farAway: boolean) =>
			`${plural(people, { one: '# Person', other: '# Personen' })} in ${plural(frames, { one: '# Bild', other: '# Bildern' })}${farAway ? ' · weit entfernt' : ''}`,
		use: 'Verwenden',
		dismiss: 'Verwerfen'
	},
	save: {
		titleBoxes: 'Boxen speichern',
		titleCamera: 'Kamera speichern',
		saving: 'Wird gespeichert…',
		saveBoxesCount: (count: number) =>
			`${plural(count, { one: '# Box', other: '# Boxen' })} speichern`,
		saveCameraWithBoxes: (count: number) =>
			`Kamera mit ${plural(count, { one: '# Box', other: '# Boxen' })} speichern`,
		pasteFirst: 'Füge zuerst eine Webcam-Adresse ein.',
		signInBefore: '',
		signInLink: 'Mit OpenStreetMap anmelden',
		signInAfter: ', um diese Kamera und ihre Boxen zu speichern.',
		noAccount:
			'Zum Speichern ist ein Benutzerkonto erforderlich, das auf dieser Instanz nicht eingerichtet ist.',
		failed: (status: number) => `Speichern fehlgeschlagen (Fehler ${formatNumber(status)}).`,
		savedAndPublished: 'Kamera gespeichert und veröffentlicht.',
		savedSuggestions:
			'Boxen als Vorschläge gespeichert. Veröffentliche sie in der Liste oben, um sie für die Warteschlangen-Zählung zu nutzen.'
	}
};
