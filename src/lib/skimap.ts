export interface SkimapMap {
	id: number;
	title: string;
	year: number;
	tags: string[];
	image: string;
	thumb: string;
	width: number;
	height: number;
}

export const skimapPage = (areaId: number) => `https://skimap.org/skiareas/view/${areaId}`;
export const skimapOriginal = (mapId: number) => `https://skimap.org/skimaps/view/${mapId}`;

const decode = (s: string) =>
	s
		.replace(/&amp;/g, '&')
		.replace(/&quot;/g, '"')
		.replace(/&#39;|&#x27;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/\s+/g, ' ')
		.trim();

const DEFAULT_MAP_WIDTH = 1000;
const DEFAULT_MAP_HEIGHT = 700;
const NON_WINTER_TAG_PATTERN = /^(biking|summer)/;

export function parseSkimap(areaPageHtml: string): SkimapMap[] {
	const parts = areaPageHtml.split(
		/(?=<h2[^>]*id="maps-year-\d{4}"|<figure class="figure" id="ski-map-\d+")/
	);
	const maps: SkimapMap[] = [];
	let year = 0;
	for (const part of parts) {
		const heading = /^<h2[^>]*id="maps-year-(\d{4})"/.exec(part);
		if (heading) {
			year = Number(heading[1]);
			continue;
		}
		const fig = /^<figure class="figure" id="ski-map-(\d+)"/.exec(part);
		if (!fig) continue;
		const body = part.slice(0, part.indexOf('</figure>') + 1 || undefined);
		const srcset = /<source srcSet="([^"]+)"/.exec(body)?.[1] ?? '';
		const sizes = [...srcset.matchAll(/(https:\/\/files\.skimap\.org\/[\w-]+)(?: (\d+)w)?/g)].map(
			(m) => ({
				url: m[1],
				w: Number(m[2] ?? 0)
			})
		);
		const thumb = /<img[^>]*\ssrc="(https:\/\/files\.skimap\.org\/[\w-]+)"/.exec(body)?.[1];
		const image = sizes.sort((a, b) => b.w - a.w)[0]?.url ?? thumb;
		if (!image || !thumb) continue;
		const caption = /<figcaption[\s\S]*?<span>([\s\S]*?)<\/span>/.exec(body)?.[1] ?? '';
		const published = /Published in (\d{4})/.exec(body)?.[1];
		maps.push({
			id: Number(fig[1]),
			title: decode(caption.replace(/<[^>]*>/g, '')),
			year: Number(published ?? year) || year,
			tags: [...body.matchAll(/badge bg-secondary">([^<]+)</g)].map((m) => decode(m[1])),
			image,
			thumb,
			width: Number(/<img[\s\S]*?\swidth="(\d+)"/.exec(body)?.[1] ?? DEFAULT_MAP_WIDTH),
			height: Number(/<img[\s\S]*?\sheight="(\d+)"/.exec(body)?.[1] ?? DEFAULT_MAP_HEIGHT)
		});
	}
	return maps;
}

export const isWinter = (map: SkimapMap) =>
	map.tags.length === 0 || map.tags.some((tag) => !NON_WINTER_TAG_PATTERN.test(tag));
