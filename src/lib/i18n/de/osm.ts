import type { Messages } from '../en/index.ts';

export const osm: Messages['osm'] = {
	presets: {
		lift: {
			name: {
				label: 'Liftname',
				question: 'Wie heißt dieser Lift?'
			},
			ref: {
				label: 'Liftnummer',
				question: 'Welche Nummer oder welcher Buchstabencode ist für diesen Lift angegeben?'
			},
			aerialway: {
				label: 'Lifttyp',
				question: 'Um was für einen Lifttyp handelt es sich?'
			},
			occupancy: {
				label: 'Sessel- / Kabinenkapazität',
				unit: 'Plätze',
				question: 'Wie viele Personen passen auf einen Sessel oder in eine Kabine?'
			},
			capacity: {
				label: 'Beförderungskapazität',
				unit: 'Pers./h',
				question: 'Wie hoch ist die stündliche Kapazität dieses Lifts?'
			},
			duration: {
				label: 'Fahrzeit',
				unit: 'Min.',
				question: 'Wie lange dauert die Fahrt von der Tal- zur Bergstation?'
			},
			bubble: {
				label: 'Wetterschutzhaube',
				question: 'Hat dieser Sessellift eine Wetterschutzhaube (Bubble)?'
			},
			heating: {
				label: 'Sitzheizung',
				question: 'Hat dieser Sessellift eine Sitzheizung?'
			},
			openingHours: {
				label: 'Betriebszeiten',
				question: 'Wie sind die Betriebszeiten dieses Lifts?'
			},
			oneway: {
				label: 'Einwegbetrieb',
				question: 'Fährt dieser Lift nur bergauf (Einweg) oder auch talwärts?'
			},
			lit: {
				label: 'Flutlicht',
				question: 'Ist dieser Lift für den Nachtskilauf beleuchtet?'
			},
			website: {
				label: 'Lift-Website',
				question: 'Wie lautet die offizielle Website für diesen Lift?'
			},
			bicycle: {
				label: 'Fahrradmitnahme',
				question: 'Kann man auf diesem Lift ein Mountainbike mitnehmen?',
				summer: 'Sommer'
			}
		},
		piste: {
			name: {
				label: 'Pistenname',
				question: 'Wie lautet der offizielle Name dieser Piste?'
			},
			ref: {
				label: 'Pistennummer',
				question: 'Welche Nummer oder Kennzeichnung steht auf den Pistenmarkierungen?'
			},
			difficulty: {
				label: 'Schwierigkeit',
				question: 'Welche Farbe bzw. Schwierigkeitsstufe hat diese Piste?'
			},
			grooming: {
				label: 'Präparierung',
				question: 'Wie wird diese Piste präpariert (präpariert, Buckelpiste, Freeride)?',
				classic: 'Präpariert',
				mogul: 'Buckelpiste',
				backcountry: 'Nicht präpariert'
			},
			lit: {
				label: 'Flutlicht',
				question: 'Ist diese Piste für den Nachtskilauf beleuchtet?'
			},
			oneway: {
				label: 'Einbahn',
				question: 'Ist das Befahren dieser Piste nur in eine Richtung erlaubt?'
			},
			snowmaking: {
				label: 'Beschneiung',
				question: 'Gibt es an dieser Piste Schneekanonen oder Schneelanzen?'
			},
			gladed: {
				label: 'Waldabfahrt',
				question: 'Handelt es sich um eine Waldabfahrt (Skifahren durch lichten Wald)?'
			},
			abandoned: {
				label: 'Aufgegebene Piste',
				question: 'Ist diese Piste dauerhaft geschlossen / aufgelassen?'
			}
		}
	},
	quests: {
		liftOccupancy: {
			question: (name: string) =>
				`Wie viele Personen passen bei ${name} auf einen Sessel oder in eine Kabine?`,
			hint: 'Zähle die Sitze oder lies die Zahl am Schild an der Station ab.'
		},
		liftBubble: {
			question: (name: string) =>
				`Haben die Sessel von ${name} eine Haube (eine Haube, die man über sich schließt)?`
		},
		liftHeating: {
			question: (name: string) => `Sind die Sitze von ${name} beheizt?`
		},
		liftRef: {
			question: (name: string) =>
				`Welche Nummer oder welcher Code steht auf dem Schild von ${name}?`,
			hint: 'Wie an der Station oder an den Liftstützen angeschrieben, z. B. „C34“ oder „12“.'
		},
		pisteDifficulty: {
			question: (name: string) => `Welche Schwierigkeit zeigen die Markierungen von ${name} an?`,
			hint: 'Die Farbe oder das Symbol auf den Pistenmarkierungen und Schildern.'
		},
		pisteGrooming: {
			question: (name: string) => `Wird ${name} präpariert?`,
			hint: 'Präpariert: Feine Rillen der Pistenraupen. Buckelpiste: Absichtlich belassene Schneehügel.',
			classic: 'Präpariert',
			mogul: 'Buckelpiste',
			backcountry: 'Nicht präpariert'
		},
		pisteRef: {
			question: (name: string) => `Welche Nummer steht auf den Markierungen von ${name}?`,
			hint: 'Die Nummer auf den Markierungsstangen am Pistenrand.'
		},
		pisteSnowmaking: {
			question: (name: string) => `Gibt es entlang von ${name} Schneekanonen oder Schneelanzen?`
		},
		pisteLit: {
			question: (name: string) => `Ist ${name} für den Nachtskilauf beleuchtet?`,
			hint: 'Flutlichtmasten entlang der Piste.'
		}
	}
};
