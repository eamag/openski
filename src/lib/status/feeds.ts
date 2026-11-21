import { aspenUrl } from './aspen.ts';
import { lumiplanUrl } from './lumiplan.ts';
import { lumiplayUrls } from './lumiplay.ts';
import { monterosaUrl } from './monterosa.ts';
import { mtnPowderUrl } from './mtnpowder.ts';
import { OPENDATAHUB_LIFTS } from './opendatahub.ts';
import { SKIAMADE_PAGES, skiamadeUrls } from './skiamade.ts';
import { skistarUrls } from './skistar.ts';

export type Vendor =
	| 'intermaps'
	| 'infosnow'
	| 'itinemap'
	| 'lumiplay'
	| 'opendatahub'
	| 'mtnpowder'
	| 'aspen'
	| 'skiamade'
	| 'skistar'
	| 'lumiplan'
	| 'monterosa';

export const VENDOR_CREDIT: Record<Vendor, { name: string; url: string }> = {
	intermaps: { name: 'Intermaps', url: 'https://www.intermaps.com/' },
	infosnow: { name: '© APG|SGA AG / infosnow.ch', url: 'https://infosnow.ch/' },
	itinemap: { name: 'Itinemap', url: 'https://www.itinemap.com/' },
	lumiplay: { name: 'Lumiplan', url: 'https://www.lumiplan.com/' },
	lumiplan: { name: 'Lumiplan', url: 'https://www.lumiplan.com/' },
	opendatahub: { name: 'Open Data Hub (CC0)', url: 'https://opendatahub.com/' },
	mtnpowder: { name: 'MtnPowder', url: 'https://mtnpowder.com/' },
	aspen: { name: 'Aspen Snowmass', url: 'https://www.aspensnowmass.com/' },
	skiamade: { name: 'Ski amadé', url: 'https://www.skiamade.com/' },
	skistar: { name: 'SkiStar', url: 'https://www.skistar.com/' },
	monterosa: { name: 'Monterosa Ski', url: 'https://monterosaski.eu/' }
};

export interface FeedSpec {
	vendor: Vendor;
	urls: string[];
	bbox?: [west: number, south: number, east: number, north: number];
}

export const FEEDS: Record<string, FeedSpec> = {
	'aletsch-arena': {
		vendor: 'intermaps',
		urls: ['https://winter.intermaps.com/aletsch_arena/data?lang=en']
	},
	'arosa-lenzerheide': {
		vendor: 'intermaps',
		urls: ['https://winter.intermaps.com/arosa_lenzerheide/data?lang=en']
	},
	avoriaz: {
		vendor: 'intermaps',
		urls: ['https://winter.intermaps.com/portes_du_soleil/data?lang=en']
	},
	'bad-kleinkirchheim': {
		vendor: 'intermaps',
		urls: ['https://winter.intermaps.com/bad_kleinkirchheim/data?lang=en']
	},
	'brandnertal-brand-buerserberg': {
		vendor: 'intermaps',
		urls: ['https://winter.intermaps.com/brandnertal/data?lang=en']
	},
	'campiglio-dolomiti-di-brenta': {
		vendor: 'intermaps',
		urls: ['https://winter.intermaps.com/skiarea_campiglio_dolomiti_di_brenta/data?lang=en']
	},
	'champery-les-crosets-champoussin-morgins': {
		vendor: 'intermaps',
		urls: ['https://winter.intermaps.com/portes_du_soleil/data?lang=en']
	},
	damuels: {
		vendor: 'intermaps',
		urls: ['https://winter.intermaps.com/damuels_mellau_faschina/data?lang=en']
	},
	'drei-zinnen-tre-cime': {
		vendor: 'intermaps',
		urls: ['https://winter.intermaps.com/drei_zinnen/data?lang=en']
	},
	'engelberg-titlis': {
		vendor: 'intermaps',
		urls: ['https://winter.intermaps.com/engelberg/data?lang=en']
	},
	'espace-liberte': {
		vendor: 'intermaps',
		urls: ['https://winter.intermaps.com/portes_du_soleil/data?lang=en']
	},
	feldberg: { vendor: 'intermaps', urls: ['https://winter.intermaps.com/feldberg/data?lang=en'] },
	'grindelwald-wengen-kleine-scheidegg': {
		vendor: 'intermaps',
		urls: ['https://winter.intermaps.com/jungfrau/data?lang=en']
	},
	'hintertuxer-gletscher': {
		vendor: 'intermaps',
		urls: ['https://winter.intermaps.com/hintertuxer_gletscher/data?lang=en']
	},
	'hochoetz-kuehtai': {
		vendor: 'intermaps',
		urls: ['https://winter.intermaps.com/hochoetz_kuehtai/data?lang=en']
	},
	'hochzillertal-hochfuegen': {
		vendor: 'intermaps',
		urls: ['https://winter.intermaps.com/hochfuegen/data?lang=en']
	},
	'kals-matrei': {
		vendor: 'intermaps',
		urls: ['https://winter.intermaps.com/kals_matrei/data?lang=en']
	},
	'kaprun-kitzsteinhorn-maiskogel': {
		vendor: 'intermaps',
		urls: ['https://winter.intermaps.com/kitzsteinhorn/data?lang=en']
	},
	'katschberg-aineck': {
		vendor: 'intermaps',
		urls: ['https://winter.intermaps.com/katschberg/data?lang=en']
	},
	kitzski: { vendor: 'intermaps', urls: ['https://winter.intermaps.com/kitzski/data?lang=en'] },
	'kleinwalsertal-oberstdorf': {
		vendor: 'intermaps',
		urls: ['https://winter.intermaps.com/oberstdorf_kleinwalsertal/data?lang=en']
	},
	'kronplatz-plan-de-corones': {
		vendor: 'intermaps',
		urls: ['https://winter.intermaps.com/kronplatz/data?lang=en']
	},
	'lech-zuers': {
		vendor: 'intermaps',
		urls: ['https://winter.intermaps.com/lech_zuers/data?lang=en']
	},
	'les-gets-morzine': {
		vendor: 'intermaps',
		urls: ['https://winter.intermaps.com/portes_du_soleil/data?lang=en']
	},
	'les-portes-du-soleil': {
		vendor: 'intermaps',
		urls: ['https://winter.intermaps.com/portes_du_soleil/data?lang=en']
	},
	'mayrhofen-hippach': {
		vendor: 'intermaps',
		urls: ['https://winter.intermaps.com/mayrhofen/data?lang=en']
	},
	nassfeld: { vendor: 'intermaps', urls: ['https://winter.intermaps.com/nassfeld/data?lang=en'] },
	'nauders-bergkastel': {
		vendor: 'intermaps',
		urls: ['https://winter.intermaps.com/nauders/data?lang=en']
	},
	'obergurgl-hochgurgl': {
		vendor: 'intermaps',
		urls: ['https://winter.intermaps.com/obergurgl_hochgurgl/data?lang=en']
	},
	obertauern: {
		vendor: 'intermaps',
		urls: ['https://winter.intermaps.com/obertauern/data?lang=en']
	},
	parsenn: { vendor: 'intermaps', urls: ['https://winter.intermaps.com/davos/data?lang=en'] },
	'saas-fee': { vendor: 'intermaps', urls: ['https://winter.intermaps.com/saas_fee/data?lang=en'] },
	'schladming-dachstein': {
		vendor: 'intermaps',
		urls: ['https://winter.intermaps.com/schladming_dachstein/data?lang=en']
	},
	'schmittenhoehe-zell-am-see': {
		vendor: 'intermaps',
		urls: ['https://winter.intermaps.com/zell_am_see/data?lang=en']
	},
	'silvretta-arena-ischgl-samnaun': {
		vendor: 'intermaps',
		urls: ['https://winter.intermaps.com/silvretta_arena/data?lang=en']
	},
	'silvretta-montafon': {
		vendor: 'intermaps',
		urls: ['https://winter.intermaps.com/silvretta_montafon/data?lang=en']
	},
	'ski-arlberg': {
		vendor: 'intermaps',
		urls: ['https://winter.intermaps.com/skiarlberg/data?lang=en']
	},
	'ski-gastein-schlossalm-angertal': {
		vendor: 'intermaps',
		urls: ['https://winter.intermaps.com/ski_gastein/data?lang=en']
	},
	'skiarena-andermatt-sedrun': {
		vendor: 'intermaps',
		urls: ['https://winter.intermaps.com/andermatt_sedrun_disentis/data?lang=en']
	},
	'skicircus-saalbach-hinterglemm-leogang': {
		vendor: 'intermaps',
		urls: ['https://winter.intermaps.com/saalbach_hinterglemm_leogang_fieberbrunn/data?lang=en']
	},
	'skigebiet-damuels-mellau': {
		vendor: 'intermaps',
		urls: ['https://winter.intermaps.com/damuels_mellau_faschina/data?lang=en']
	},
	'skigebiet-damuels-mellau-faschina': {
		vendor: 'intermaps',
		urls: ['https://winter.intermaps.com/damuels_mellau_faschina/data?lang=en']
	},
	'skiwelt-wilder-kaiser-brixental': {
		vendor: 'intermaps',
		urls: ['https://winter.intermaps.com/skiwelt/data?lang=en']
	},
	'snow-space-salzburg': {
		vendor: 'intermaps',
		urls: ['https://winter.intermaps.com/salzburger_sportwelt/data?lang=en']
	},
	soelden: { vendor: 'intermaps', urls: ['https://winter.intermaps.com/soelden/data?lang=en'] },
	'st-anton-st-christoph-stuben': {
		vendor: 'intermaps',
		urls: ['https://winter.intermaps.com/skiarlberg/data?lang=en']
	},
	stubai: {
		vendor: 'intermaps',
		urls: ['https://winter.intermaps.com/stubaier_gletscher/data?lang=en']
	},
	'stubaier-gletscher': {
		vendor: 'intermaps',
		urls: ['https://winter.intermaps.com/stubaier_gletscher/data?lang=en']
	},
	'warth-schroecken': {
		vendor: 'intermaps',
		urls: ['https://winter.intermaps.com/warth_schroecken/data?lang=en']
	},
	wildkogel: {
		vendor: 'intermaps',
		urls: ['https://winter.intermaps.com/wildkogel_arena/data?lang=en']
	},
	'zillertal-arena': {
		vendor: 'intermaps',
		urls: ['https://winter.intermaps.com/zillertalarena/data?lang=en']
	},
	'4-vallees-verbier-la-tzoumaz-nendaz': {
		vendor: 'infosnow',
		urls: [
			'https://infosnow.ch/portal/?type=ajax-raw&tab=map-1/dlg-sys&lang=en&e=31&saison=1&ref=contentBox',
			'https://infosnow.ch/portal/?type=ajax-raw&tab=map-1/dlg-sys&lang=en&e=36&saison=1&ref=contentBox',
			'https://infosnow.ch/portal/?type=ajax-raw&tab=map-1/dlg-sys&lang=en&e=101&saison=1&ref=contentBox',
			'https://infosnow.ch/portal/?type=ajax-raw&tab=map-1/dlg-sys&lang=en&e=99&saison=1&ref=contentBox'
		]
	},
	'adelboden-lenk': {
		vendor: 'infosnow',
		urls: [
			'https://infosnow.ch/portal/?type=ajax-raw&tab=map-1/dlg-sys&lang=en&e=62&saison=1&ref=contentBox',
			'https://infosnow.ch/portal/?type=ajax-raw&tab=map-1/dlg-sys&lang=en&e=59&saison=1&ref=contentBox'
		]
	},
	corviglia: {
		vendor: 'infosnow',
		urls: [
			'https://infosnow.ch/portal/?type=ajax-raw&tab=map-1/dlg-sys&lang=en&e=41&saison=1&ref=contentBox'
		]
	},
	'crans-montana': {
		vendor: 'infosnow',
		urls: [
			'https://infosnow.ch/portal/?type=ajax-raw&tab=map-1/dlg-sys&lang=en&e=141&saison=1&ref=contentBox'
		]
	},
	flumserberg: {
		vendor: 'infosnow',
		urls: [
			'https://infosnow.ch/portal/?type=ajax-raw&tab=map-1/dlg-sys&lang=en&e=37&saison=1&ref=contentBox'
		]
	},
	laax: {
		vendor: 'infosnow',
		urls: [
			'https://infosnow.ch/portal/?type=ajax-raw&tab=map-1/dlg-sys&lang=en&e=200&saison=1&ref=contentBox'
		]
	},
	'meiringen-hasliberg': {
		vendor: 'infosnow',
		urls: [
			'https://infosnow.ch/portal/?type=ajax-raw&tab=map-1/dlg-sys&lang=en&e=188&saison=1&ref=contentBox'
		]
	},
	obersaxen: {
		vendor: 'infosnow',
		urls: [
			'https://infosnow.ch/portal/?type=ajax-raw&tab=map-1/dlg-sys&lang=en&e=53&saison=1&ref=contentBox'
		]
	},
	'saint-luc-chandolin': {
		vendor: 'infosnow',
		urls: [
			'https://infosnow.ch/portal/?type=ajax-raw&tab=map-1/dlg-sys&lang=en&e=176&saison=1&ref=contentBox'
		]
	},
	'schoenried-saanenmoeser-zweisimmen-st': {
		vendor: 'infosnow',
		urls: [
			'https://infosnow.ch/portal/?type=ajax-raw&tab=map-1/dlg-sys&lang=en&e=39&saison=1&ref=contentBox'
		]
	},
	'scuol-motta-naluns': {
		vendor: 'infosnow',
		urls: [
			'https://infosnow.ch/portal/?type=ajax-raw&tab=map-1/dlg-sys&lang=en&e=178&saison=1&ref=contentBox'
		]
	},
	'villars-gryon-les-diablerets': {
		vendor: 'infosnow',
		urls: [
			'https://infosnow.ch/portal/?type=ajax-raw&tab=map-1/dlg-sys&lang=en&e=60&saison=1&ref=contentBox',
			'https://infosnow.ch/portal/?type=ajax-raw&tab=map-1/dlg-sys&lang=en&e=105&saison=1&ref=contentBox',
			'https://infosnow.ch/portal/?type=ajax-raw&tab=map-1/dlg-sys&lang=en&e=50&saison=1&ref=contentBox',
			'https://infosnow.ch/portal/?type=ajax-raw&tab=map-1/dlg-sys&lang=en&e=104&saison=1&ref=contentBox'
		]
	},
	'zermatt-breuil-cervinia': {
		vendor: 'infosnow',
		urls: [
			'https://infosnow.ch/portal/?type=ajax-raw&tab=map-1/dlg-sys&lang=en&e=405&saison=1&ref=contentBox',
			'https://infosnow.ch/portal/?type=ajax-raw&tab=map-1/dlg-sys&lang=en&e=407&saison=1&ref=contentBox',
			'https://infosnow.ch/portal/?type=ajax-raw&tab=map-1/dlg-sys&lang=en&e=398&saison=1&ref=contentBox'
		]
	},
	'zinal-grimentz': {
		vendor: 'infosnow',
		urls: [
			'https://infosnow.ch/portal/?type=ajax-raw&tab=map-1/dlg-sys&lang=en&e=56&saison=1&ref=contentBox'
		]
	},
	'isola-2000': {
		vendor: 'itinemap',
		urls: [
			'https://api.itinemap.com/app/35/48/get-lifts',
			'https://api.itinemap.com/app/35/48/get-tracks'
		]
	},
	'les-deux-alpes': {
		vendor: 'itinemap',
		urls: [
			'https://api.itinemap.com/app/26/48/get-lifts',
			'https://api.itinemap.com/app/26/48/get-tracks'
		]
	},
	'les-trois-vallees': {
		vendor: 'itinemap',
		urls: [
			'https://api.itinemap.com/app/44/48/get-lifts',
			'https://api.itinemap.com/app/44/48/get-tracks'
		]
	},
	'praz-de-lys-sommand': {
		vendor: 'itinemap',
		urls: [
			'https://api.itinemap.com/app/33/48/get-lifts',
			'https://api.itinemap.com/app/33/48/get-tracks'
		]
	},
	'serre-chevalier': {
		vendor: 'itinemap',
		urls: [
			'https://api.itinemap.com/app/37/48/get-lifts',
			'https://api.itinemap.com/app/37/48/get-tracks'
		]
	},
	'super-besse': {
		vendor: 'itinemap',
		urls: [
			'https://api.itinemap.com/app/13/48/get-lifts',
			'https://api.itinemap.com/app/13/48/get-tracks'
		]
	},
	'val-thorens': {
		vendor: 'itinemap',
		urls: [
			'https://api.itinemap.com/app/41/48/get-lifts',
			'https://api.itinemap.com/app/41/48/get-tracks'
		]
	},
	'villard-de-lans-correncon': {
		vendor: 'itinemap',
		urls: [
			'https://api.itinemap.com/app/9/48/get-lifts',
			'https://api.itinemap.com/app/9/48/get-tracks'
		]
	},
	'evasion-mont-blanc': {
		vendor: 'lumiplay',
		urls: lumiplayUrls('007b3623-778f-4bc0-8a3a-5f7dd582be32')
	},
	megeve: { vendor: 'lumiplay', urls: lumiplayUrls('007b3623-778f-4bc0-8a3a-5f7dd582be32') },
	'les-contamines': {
		vendor: 'lumiplay',
		urls: lumiplayUrls('007b3623-778f-4bc0-8a3a-5f7dd582be32')
	},
	'les-portes-du-mont-blanc': {
		vendor: 'lumiplay',
		urls: lumiplayUrls('007b3623-778f-4bc0-8a3a-5f7dd582be32')
	},
	'domaine-skiable-valberg': {
		vendor: 'lumiplay',
		urls: lumiplayUrls('09fb8612-d478-4618-8001-4f2d2c5c491e')
	},
	'espace-diamant': {
		vendor: 'lumiplay',
		urls: lumiplayUrls('0f2d2a36-92a5-4d3b-abb2-cb3651bc32d4')
	},
	'espace-lumiere': {
		vendor: 'lumiplay',
		urls: lumiplayUrls('198d271f-f46c-4892-9393-4cb5cc332d87')
	},
	'pra-loup-1600': {
		vendor: 'lumiplay',
		urls: lumiplayUrls('198d271f-f46c-4892-9393-4cb5cc332d87')
	},
	'val-d-allos-la-foux': {
		vendor: 'lumiplay',
		urls: lumiplayUrls('198d271f-f46c-4892-9393-4cb5cc332d87')
	},
	'foret-blanche-vars-risoul': {
		vendor: 'lumiplay',
		urls: lumiplayUrls('47ab4d23-36f8-4bff-b618-c30cedfe2d58')
	},
	'les-rousses': { vendor: 'lumiplay', urls: lumiplayUrls('59462c53-7f75-4e9f-817d-14ff50933363') },
	'la-clusaz': { vendor: 'lumiplay', urls: lumiplayUrls('71b57c4a-b0f4-4634-8310-e1416104b70a') },
	'les-sybelles': {
		vendor: 'lumiplay',
		urls: lumiplayUrls('b82cea9e-8974-4741-b04c-db0aaff12d8d')
	},
	'tignes-val-d-isere': {
		vendor: 'lumiplay',
		urls: lumiplayUrls('84a526a4-c935-455e-a9c5-037061d75ba4')
	},
	'les-angles': { vendor: 'lumiplay', urls: lumiplayUrls('88c0c7a4-6510-4deb-afb1-72657afdd735') },
	'les-7-laux': { vendor: 'lumiplay', urls: lumiplayUrls('957de085-2374-467f-9e43-e201be02fc12') },
	'le-grand-bornand': {
		vendor: 'lumiplay',
		urls: lumiplayUrls('9f2083ec-a12b-4d9b-b6ad-21ffbbabc1d6')
	},
	courchevel: { vendor: 'lumiplay', urls: lumiplayUrls('bd632c91-6957-494d-95a8-6a72eb87e341') },
	meribel: { vendor: 'lumiplay', urls: lumiplayUrls('bd632c91-6957-494d-95a8-6a72eb87e341') },
	'val-thorens-orelle': {
		vendor: 'lumiplay',
		urls: lumiplayUrls('bd632c91-6957-494d-95a8-6a72eb87e341')
	},
	'les-menuires': {
		vendor: 'lumiplay',
		urls: lumiplayUrls('bd632c91-6957-494d-95a8-6a72eb87e341')
	},
	'le-sauze-1400-le-super-sauze-1700': {
		vendor: 'lumiplay',
		urls: lumiplayUrls('c3f4d605-4d11-4b20-8f35-fc653c9b0e93')
	},
	'le-collet-d-allevard': {
		vendor: 'lumiplay',
		urls: lumiplayUrls('ca6e3565-ca7a-4999-9594-f28bda475a8c')
	},
	'la-bresse-hohneck': {
		vendor: 'lumiplay',
		urls: lumiplayUrls('ce6e6eaa-c427-4b57-91a9-85ce91a53bd2')
	},
	valmorel: { vendor: 'lumiplay', urls: lumiplayUrls('d2d1dd82-f742-4342-9270-1c3479d4f372') },
	'saint-francois-longchamp': {
		vendor: 'lumiplay',
		urls: lumiplayUrls('d2d1dd82-f742-4342-9270-1c3479d4f372')
	},
	paradiski: { vendor: 'lumiplay', urls: lumiplayUrls('e6302a83-ce5b-4717-bab8-4f282b1083d7') },
	'la-plagne': { vendor: 'lumiplay', urls: lumiplayUrls('e6302a83-ce5b-4717-bab8-4f282b1083d7') },
	'les-arcs': { vendor: 'lumiplay', urls: lumiplayUrls('e6302a83-ce5b-4717-bab8-4f282b1083d7') },
	aussois: { vendor: 'lumiplay', urls: lumiplayUrls('e68b5cdd-02c4-43f9-b75f-2c679445b626') },
	'sainte-foy-tarentaise': {
		vendor: 'lumiplay',
		urls: lumiplayUrls('eaa06047-f0c5-4d58-ae17-0121b5090a3d')
	},
	'metabief-mont-d-or': {
		vendor: 'lumiplay',
		urls: lumiplayUrls('f1737561-56e1-4857-ad93-45a0cbf6828f')
	},
	'3-zinnen-dolomites-dobbiaco-san-candido': {
		vendor: 'opendatahub',
		urls: [OPENDATAHUB_LIFTS],
		bbox: [12.329, 46.6591, 12.3978, 46.7317]
	},
	'alpe-cermis': {
		vendor: 'opendatahub',
		urls: [OPENDATAHUB_LIFTS],
		bbox: [11.4647, 46.2345, 11.5049, 46.2852]
	},
	'alta-badia': {
		vendor: 'opendatahub',
		urls: [OPENDATAHUB_LIFTS],
		bbox: [11.8049, 46.5163, 11.9606, 46.6146]
	},
	arabba: {
		vendor: 'opendatahub',
		urls: [OPENDATAHUB_LIFTS],
		bbox: [11.8132, 46.464, 11.8985, 46.5131]
	},
	'belvedere-col-rodella-passo-pordoi': {
		vendor: 'opendatahub',
		urls: [OPENDATAHUB_LIFTS],
		bbox: [11.7439, 46.4577, 11.8253, 46.5058]
	},
	'brixen-plose-plose-di-bressanone': {
		vendor: 'opendatahub',
		urls: [OPENDATAHUB_LIFTS],
		bbox: [11.6804, 46.6759, 11.7475, 46.7004]
	},
	'buffaure-ciampac': {
		vendor: 'opendatahub',
		urls: [OPENDATAHUB_LIFTS],
		bbox: [11.6926, 46.4168, 11.7888, 46.4579]
	},
	carezza: {
		vendor: 'opendatahub',
		urls: [OPENDATAHUB_LIFTS],
		bbox: [11.5867, 46.3956, 11.6146, 46.4462]
	},
	'cortina-d-ampezzo': {
		vendor: 'opendatahub',
		urls: [OPENDATAHUB_LIFTS],
		bbox: [11.9685, 46.4587, 12.4218, 46.5932]
	},
	'cortina-tofane': {
		vendor: 'opendatahub',
		urls: [OPENDATAHUB_LIFTS],
		bbox: [12.0676, 46.5225, 12.1314, 46.5551]
	},
	'cristallo-faloria': {
		vendor: 'opendatahub',
		urls: [OPENDATAHUB_LIFTS],
		bbox: [12.1392, 46.5271, 12.1938, 46.5834]
	},
	'dolomiti-superski': {
		vendor: 'opendatahub',
		urls: [OPENDATAHUB_LIFTS],
		bbox: [11.3841, 46.2345, 12.4786, 46.8592]
	},
	'gitschberg-jochtal': {
		vendor: 'opendatahub',
		urls: [OPENDATAHUB_LIFTS],
		bbox: [11.5917, 46.8105, 11.6881, 46.8592]
	},
	'lagazuoi-5-torri': {
		vendor: 'opendatahub',
		urls: [OPENDATAHUB_LIFTS],
		bbox: [11.9685, 46.4876, 12.0708, 46.56]
	},
	'latemar-dolomites': {
		vendor: 'opendatahub',
		urls: [OPENDATAHUB_LIFTS],
		bbox: [11.5205, 46.3277, 11.6021, 46.3846]
	},
	marmolada: {
		vendor: 'opendatahub',
		urls: [OPENDATAHUB_LIFTS],
		bbox: [11.8619, 46.4275, 11.9108, 46.4638]
	},
	'passo-rolle': {
		vendor: 'opendatahub',
		urls: [OPENDATAHUB_LIFTS],
		bbox: [11.7775, 46.2874, 11.799, 46.3036]
	},
	'san-martino-di-castrozza': {
		vendor: 'opendatahub',
		urls: [OPENDATAHUB_LIFTS],
		bbox: [11.7522, 46.2346, 11.8329, 46.2745]
	},
	'san-martino-di-castrozza-passo-rolle': {
		vendor: 'opendatahub',
		urls: [OPENDATAHUB_LIFTS],
		bbox: [11.7522, 46.2346, 11.8329, 46.3044]
	},
	'seiser-alm-mont-de-seuc-alpe-di-siusi': {
		vendor: 'opendatahub',
		urls: [OPENDATAHUB_LIFTS],
		bbox: [11.5637, 46.5105, 11.6885, 46.5729]
	},
	'ski-area-alpe-lusia': {
		vendor: 'opendatahub',
		urls: [OPENDATAHUB_LIFTS],
		bbox: [11.6815, 46.3131, 11.7215, 46.3681]
	},
	'ski-area-san-pellegrino-falcade': {
		vendor: 'opendatahub',
		urls: [OPENDATAHUB_LIFTS],
		bbox: [11.781, 46.3364, 11.8595, 46.3995]
	},
	'ski-civetta': {
		vendor: 'opendatahub',
		urls: [OPENDATAHUB_LIFTS],
		bbox: [12.0231, 46.3677, 12.115, 46.4435]
	},
	'val-comelico-padola': {
		vendor: 'opendatahub',
		urls: [OPENDATAHUB_LIFTS],
		bbox: [12.4093, 46.602, 12.4786, 46.6567]
	},
	'val-di-fassa': {
		vendor: 'opendatahub',
		urls: [OPENDATAHUB_LIFTS],
		bbox: [11.6487, 46.4168, 11.8253, 46.5058]
	},
	'val-gardena': {
		vendor: 'opendatahub',
		urls: [OPENDATAHUB_LIFTS],
		bbox: [11.6722, 46.5062, 11.8067, 46.6005]
	},
	'vigo-di-fassa-ciampedie': {
		vendor: 'opendatahub',
		urls: [OPENDATAHUB_LIFTS],
		bbox: [11.6487, 46.4213, 11.6936, 46.4432]
	},
	'stratton-mountain-resort': { vendor: 'mtnpowder', urls: [mtnPowderUrl(1)] },
	'snowshoe-mountain': { vendor: 'mtnpowder', urls: [mtnPowderUrl(2)] },
	'blue-mountain-ski-resort': { vendor: 'mtnpowder', urls: [mtnPowderUrl(3)] },
	'mont-tremblant-resort': { vendor: 'mtnpowder', urls: [mtnPowderUrl(4)] },
	'winter-park-resort': { vendor: 'mtnpowder', urls: [mtnPowderUrl(5)] },
	'steamboat-ski-resort': { vendor: 'mtnpowder', urls: [mtnPowderUrl(6)] },
	'aspen-mountain': { vendor: 'aspen', urls: [aspenUrl('AspenMountain')] },
	'aspen-highlands': { vendor: 'aspen', urls: [aspenUrl('AspenHighlands')] },
	buttermilk: { vendor: 'aspen', urls: [aspenUrl('Buttermilk')] },
	'aspen-snowmass': { vendor: 'aspen', urls: [aspenUrl('Snowmass')] },
	'ski-amade': { vendor: 'skiamade', urls: SKIAMADE_PAGES },
	hochkoenig: { vendor: 'skiamade', urls: skiamadeUrls('mariaAlm', 'dienten', 'muehlbach') },
	'grossarltal-dorfgastein': { vendor: 'skiamade', urls: skiamadeUrls('grossarl', 'dorfgastein') },
	sportgastein: { vendor: 'skiamade', urls: skiamadeUrls('sportgastein') },
	wagrain: { vendor: 'skiamade', urls: skiamadeUrls('wagrain') },
	flachau: { vendor: 'skiamade', urls: skiamadeUrls('flachau') },
	'shuttleberg-flachauwinkl-kleinarl': { vendor: 'skiamade', urls: skiamadeUrls('flachauwinkl') },
	'zauchensee-flachauwinkl': { vendor: 'skiamade', urls: skiamadeUrls('zauchensee') },
	'radstadt-altenmarkt': { vendor: 'skiamade', urls: skiamadeUrls('radstadt') },
	'filzmoos-neuberg': { vendor: 'skiamade', urls: skiamadeUrls('filzmoos') },
	'monte-popolo-eben-im-pongau': { vendor: 'skiamade', urls: skiamadeUrls('eben') },
	'planai-hochwurzen': { vendor: 'skiamade', urls: skiamadeUrls('planai', 'hochwurzen') },
	'hauser-kaibling': { vendor: 'skiamade', urls: skiamadeUrls('hauserKaibling') },
	reiteralm: { vendor: 'skiamade', urls: skiamadeUrls('reiteralm') },
	fageralm: { vendor: 'skiamade', urls: skiamadeUrls('fageralm') },
	galsterberg: { vendor: 'skiamade', urls: skiamadeUrls('galsterberg') },
	'ramsau-am-dachstein': { vendor: 'skiamade', urls: skiamadeUrls('ramsau') },
	are: { vendor: 'skistar', urls: skistarUrls('areBy', 'areHogzon', 'areBjornen', 'duved') },
	salen: {
		vendor: 'skistar',
		urls: skistarUrls('lindvallen', 'tandadalen', 'hundfjallet', 'hogfjallet')
	},
	lindvallen: { vendor: 'skistar', urls: skistarUrls('lindvallen') },
	tandadalen: { vendor: 'skistar', urls: skistarUrls('tandadalen') },
	hundfjallet: { vendor: 'skistar', urls: skistarUrls('hundfjallet') },
	hogfjallet: { vendor: 'skistar', urls: skistarUrls('hogfjallet') },
	trysil: { vendor: 'skistar', urls: skistarUrls('turistsentret', 'hogegga') },
	'hemsedal-skisenter': { vendor: 'skistar', urls: skistarUrls('hemsedal') },
	vemdalsskalet: { vendor: 'skistar', urls: skistarUrls('vemdalsskalet') },
	bjornrike: { vendor: 'skistar', urls: skistarUrls('bjornrike') },
	'klovsjo-storhogna': { vendor: 'skistar', urls: skistarUrls('klovsjo') },
	'balme-vallorcine': { vendor: 'lumiplan', urls: [lumiplanUrl('chamonix')] },
	'monterosa-ski': {
		vendor: 'monterosa',
		urls: [monterosaUrl('alagna-valsesia'), monterosaUrl('alpe-mera')]
	},
	champorcher: { vendor: 'monterosa', urls: [monterosaUrl('champorcher')] },
	brusson: { vendor: 'monterosa', urls: [monterosaUrl('brusson')] }
};
