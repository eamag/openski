import type { LiftKind, ResortStatus } from './intermaps.ts';

function decodeHtml(html: string): string {
	return html
		.replace(/<[^>]+>/g, ' ')
		.replace(/&bull;/g, '•')
		.replace(/&auml;/g, 'ä')
		.replace(/&ouml;/g, 'ö')
		.replace(/&uuml;/g, 'ü')
		.replace(/&eacute;/g, 'é')
		.replace(/&egrave;/g, 'è')
		.replace(/&agrave;/g, 'à')
		.replace(/&acirc;/g, 'â')
		.replace(/&icirc;/g, 'î')
		.replace(/&ocirc;/g, 'ô')
		.replace(/&ucirc;/g, 'û')
		.replace(/&ccedil;/g, 'ç')
		.replace(/&amp;/g, '&')
		.replace(/&nbsp;/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function liftKind(typeStr: string, name: string): LiftKind {
	const s = (typeStr + ' ' + name).toLowerCase();
	if (
		s.includes('chair') ||
		s.includes('sessel') ||
		s.includes('siège') ||
		s.includes('télésiège')
	) {
		return 'chair';
	}
	if (
		s.includes('carpet') ||
		s.includes('teppich') ||
		s.includes('tapis') ||
		s.includes('t-bar') ||
		s.includes('platter') ||
		s.includes('drag') ||
		s.includes('tow') ||
		s.includes('skilift') ||
		s.includes('téléski') ||
		s.includes('teller')
	) {
		return 'drag';
	}
	if (
		s.includes('gondola') ||
		s.includes('cable car') ||
		s.includes('aerial') ||
		s.includes('tramway') ||
		s.includes('funicular') ||
		s.includes('funitel') ||
		s.includes('railway') ||
		s.includes('shuttle') ||
		s.includes('téléphérique') ||
		s.includes('télécabine') ||
		s.includes('seilbahn') ||
		s.includes('pendelbahn')
	) {
		return 'gondola';
	}
	return 'other';
}

const INFOSNOW_OPEN_STATE = 1;

export function parseInfosnow(doc: unknown): ResortStatus {
	const text = typeof doc === 'string' ? doc : JSON.stringify(doc);
	if (!text) throw new Error('unexpected status format: empty doc');

	const atMatch =
		text.match(/Last changes:\s*(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})/i) ||
		text.match(/Status\s*\(\s*(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})/i);

	let at = new Date().toISOString();
	if (atMatch) {
		const [, d, m, y, h, min] = atMatch;
		at = `${y}-${m}-${d}T${h}:${min}:00`;
	}

	const lifts: ResortStatus['lifts'] = [];
	const pistes: ResortStatus['pistes'] = [];

	const boxMatches = text.matchAll(
		/<div[^>]*class="isBreakBox"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g
	);

	for (const box of boxMatches) {
		const content = box[1];
		const isLifts = /<div[^>]*class="isH1"[^>]*>[\s\S]*?(?:Lifts|Anlagen|Remontées)/i.test(content);
		const isSlopes = /<div[^>]*class="isH1"[^>]*>[\s\S]*?(?:Slopes|Pisten|Pistes)/i.test(content);

		if (!isLifts && !isSlopes) continue;

		const recMatches = content.matchAll(
			/<div[^>]*class="isRec"[^>]*>([\s\S]*?)<div[^>]*class="isClear"[^>]*>/g
		);

		for (const rec of recMatches) {
			const recContent = rec[1];

			const stateMatch = recContent.match(/state\/3\/(\d+)\.svg/i);
			const stateNum = stateMatch ? parseInt(stateMatch[1], 10) : -1;
			const isOpen = stateNum === INFOSNOW_OPEN_STATE;

			const typeMatch =
				recContent.match(/svg\/color\/\d+\.svg"[^>]*title="([^"]*)"/i) ||
				recContent.match(/svg\/color\/\d+\.svg"[^>]*alt="([^"]*)"/i);
			const typeStr = typeMatch ? typeMatch[1] : '';

			const txtMatch = recContent.match(/<div[^>]*class="isTxt"[^>]*>([\s\S]*?)<\/div>/i);
			if (!txtMatch) continue;
			const cleanTxt = decodeHtml(txtMatch[1]);
			if (!cleanTxt) continue;

			if (isLifts) {
				const name = cleanTxt.replace(/^[A-Z0-9/.-]+\s*•\s*/i, '').trim();
				lifts.push({
					name: name || cleanTxt,
					kind: liftKind(typeStr, cleanTxt),
					open: isOpen
				});
			} else {
				const refMatch = cleanTxt.match(/^([0-9]+[a-z]?|[a-z][0-9]*)\b/i);
				const ref = refMatch
					? refMatch[1].toLowerCase()
					: cleanTxt.split('•')[0].trim().toLowerCase();
				if (ref) {
					pistes.push({ ref, open: isOpen });
				}
			}
		}
	}

	return { at, lifts, pistes };
}
