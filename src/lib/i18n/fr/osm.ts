import type { Messages } from '../en/index.ts';

export const osm: Messages['osm'] = {
	presets: {
		lift: {
			name: {
				label: 'Nom de la remontée',
				question: 'Quel est le nom de cette remontée\u202F?'
			},
			ref: {
				label: 'Référence de la remontée',
				question: 'Quel numéro ou code est affiché pour cette remontée\u202F?'
			},
			aerialway: {
				label: 'Type de remontée',
				question: 'De quel type de remontée s’agit-il\u202F?'
			},
			occupancy: {
				label: 'Capacité par siège / cabine',
				unit: 'places',
				question: 'Combien de personnes tiennent sur un siège ou dans une cabine\u202F?'
			},
			capacity: {
				label: 'Débit horaire',
				unit: 'pers/h',
				question: 'Quelle est la capacité horaire de cette remontée\u202F?'
			},
			duration: {
				label: 'Temps de montée',
				unit: 'min',
				question: 'Combien de temps dure la montée de bas en haut\u202F?'
			},
			bubble: {
				label: 'Bulle de protection',
				question: 'Ce télésiège a-t-il une bulle de protection contre les intempéries\u202F?'
			},
			heating: {
				label: 'Sièges chauffants',
				question: 'Ce télésiège a-t-il des sièges chauffants\u202F?'
			},
			openingHours: {
				label: 'Horaires d’ouverture',
				question: 'Quels sont les horaires d’ouverture de cette remontée\u202F?'
			},
			oneway: {
				label: 'Sens de transport',
				question:
					'Cette remontée fonctionne-t-elle à sens unique (montée seule) ou dans les deux sens\u202F?'
			},
			lit: {
				label: 'Éclairage nocturne',
				question: 'Cette remontée est-elle éclairée pour le ski nocturne\u202F?'
			},
			website: {
				label: 'Site web de la remontée',
				question: 'Quelle est la page web officielle de cette remontée\u202F?'
			},
			bicycle: {
				label: 'Transport de vélos',
				question: 'Peut-on monter avec un VTT sur cette remontée\u202F?',
				summer: 'Été'
			}
		},
		piste: {
			name: {
				label: 'Nom de la piste',
				question: 'Quel est le nom officiel de cette piste\u202F?'
			},
			ref: {
				label: 'Numéro de piste',
				question: 'Quel numéro ou repère est inscrit sur les balises de la piste\u202F?'
			},
			difficulty: {
				label: 'Difficulté',
				question: 'Quelle est la couleur ou le niveau de difficulté de cette piste\u202F?'
			},
			grooming: {
				label: 'Damage',
				question: 'Comment cette piste est-elle préparée (damée, bosses, hors-piste)\u202F?',
				classic: 'Damée',
				mogul: 'Bosses',
				backcountry: 'Non damée'
			},
			lit: {
				label: 'Éclairage nocturne',
				question: 'Cette piste est-elle éclairée pour le ski nocturne\u202F?'
			},
			oneway: {
				label: 'Sens unique',
				question: 'La descente n’est-elle autorisée que dans un seul sens sur cette piste\u202F?'
			},
			snowmaking: {
				label: 'Enneigement artificiel',
				question: 'Cette piste comporte-t-elle des canons ou perches à neige\u202F?'
			},
			gladed: {
				label: 'Piste en sous-bois',
				question: 'Est-ce une piste en sous-bois (ski entre les arbres clairsemés)\u202F?'
			},
			abandoned: {
				label: 'Piste abandonnée',
				question: 'Cette piste est-elle définitivement fermée ou abandonnée\u202F?'
			}
		}
	},
	quests: {
		liftOccupancy: {
			question: (name: string) =>
				`Combien de personnes tiennent sur un siège ou dans une cabine de ${name}\u202F?`,
			hint: 'Comptez les sièges ou lisez le chiffre sur le panneau en gare.'
		},
		liftBubble: {
			question: (name: string) =>
				`Les sièges de ${name} ont-ils une bulle (capote qui se rabat sur vous)\u202F?`
		},
		liftHeating: {
			question: (name: string) => `Les sièges de ${name} sont-ils chauffants\u202F?`
		},
		liftRef: {
			question: (name: string) => `Quel numéro ou code figure sur le panneau de ${name}\u202F?`,
			hint: 'Tel qu’indiqué en gare ou sur un pylône, ex. «\u00A0C34\u00A0» ou «\u00A012\u00A0».'
		},
		pisteDifficulty: {
			question: (name: string) => `Quel niveau indiquent les balises de ${name}\u202F?`,
			hint: 'La couleur ou le symbole sur les balises et panneaux de la piste.'
		},
		pisteGrooming: {
			question: (name: string) => `${name} est-elle damée\u202F?`,
			hint: 'Damée\u00A0: traces lisses de dameuse (velours). Bosses\u00A0: bosses laissées exprès.',
			classic: 'Damée',
			mogul: 'Bosses',
			backcountry: 'Non damée'
		},
		pisteRef: {
			question: (name: string) => `Quel numéro figure sur les balises de ${name}\u202F?`,
			hint: 'Le numéro sur les jalons le long du bord de la piste.'
		},
		pisteSnowmaking: {
			question: (name: string) =>
				`Y a-t-il des canons ou des perches à neige le long de ${name}\u202F?`
		},
		pisteLit: {
			question: (name: string) => `${name} est-elle éclairée pour le ski nocturne\u202F?`,
			hint: 'Pylônes d’éclairage le long de la piste.'
		}
	}
};
