export interface TrackPoint {
	t: number;
	lat: number;
	lon: number;
	ele?: number;
	acc?: number;
	spd?: number;
	hr?: number;
}

export interface ParsedTrack {
	name?: string;
	type?: string;
	points: TrackPoint[];
}

const LAT_RE = /\blat\s*=\s*(?:(["'])(.*?)\1|([^\s>]+))/i;
const LON_RE = /\blon\s*=\s*(?:(["'])(.*?)\1|([^\s>]+))/i;
const SPORT_RE = /\bSport\s*=\s*(?:(["'])(.*?)\1|([^\s>]+))/i;
const SLASH_CHAR_CODE = 47;
const BYTE_ORDER_MARK = 0xfeff;

function codePointToString(code: number): string {
	if (!Number.isFinite(code) || code < 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) {
		return '';
	}
	try {
		return String.fromCodePoint(code);
	} catch {
		return '';
	}
}

function decodeXml(s: string): string {
	if (!s.includes('&')) return s;
	return s.replace(/&(?:amp|lt|gt|quot|apos|#x[0-9a-fA-F]+|#[0-9]+);/g, (entity) => {
		switch (entity) {
			case '&amp;':
				return '&';
			case '&lt;':
				return '<';
			case '&gt;':
				return '>';
			case '&quot;':
				return '"';
			case '&apos;':
				return "'";
			default:
				if (entity.startsWith('&#x') || entity.startsWith('&#X')) {
					const code = parseInt(entity.slice(3, -1), 16);
					return codePointToString(code);
				}
				if (entity.startsWith('&#')) {
					const code = parseInt(entity.slice(2, -1), 10);
					return codePointToString(code);
				}
				return entity;
		}
	});
}

function escapeXml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

function formatUtc(t: number): string {
	const d = new Date(t);
	if (isNaN(d.getTime())) return '1970-01-01T00:00:00Z';
	return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

interface RawPoint {
	lat?: number;
	lon?: number;
	ele?: number;
	t?: number;
	spd?: number;
	acc?: number;
	hr?: number;
}

function interpolateAndSort(rawPoints: RawPoint[]): TrackPoint[] {
	const valid: TrackPoint[] = [];
	for (let i = 0; i < rawPoints.length; i++) {
		const pt = rawPoints[i];
		const lat = pt.lat;
		const lon = pt.lon;
		if (
			lat !== undefined &&
			lon !== undefined &&
			Number.isFinite(lat) &&
			Number.isFinite(lon) &&
			lat >= -90 &&
			lat <= 90 &&
			lon >= -180 &&
			lon <= 180
		) {
			valid.push(pt as TrackPoint);
		}
	}

	if (valid.length === 0) return valid;

	const timedIndices: number[] = [];
	for (let i = 0; i < valid.length; i++) {
		if (valid[i].t !== undefined && Number.isFinite(valid[i].t)) {
			timedIndices.push(i);
		}
	}

	if (timedIndices.length < 2) {
		for (let i = 0; i < valid.length; i++) {
			if (valid[i].t === undefined || !Number.isFinite(valid[i].t)) {
				valid[i].t = 0;
			}
		}
	} else {
		const m = timedIndices.length;
		const firstIdx = timedIndices[0];
		const lastIdx = timedIndices[m - 1];

		const firstDt = valid[timedIndices[1]].t - valid[timedIndices[0]].t;
		const firstDi = timedIndices[1] - timedIndices[0];
		const firstRate = firstDt / firstDi;
		for (let i = 0; i < firstIdx; i++) {
			valid[i].t = Math.round(valid[firstIdx].t - (firstIdx - i) * firstRate);
		}

		const lastDt = valid[timedIndices[m - 1]].t - valid[timedIndices[m - 2]].t;
		const lastDi = timedIndices[m - 1] - timedIndices[m - 2];
		const lastRate = lastDt / lastDi;
		for (let i = lastIdx + 1; i < valid.length; i++) {
			valid[i].t = Math.round(valid[lastIdx].t + (i - lastIdx) * lastRate);
		}

		let ptr = 0;
		for (let i = firstIdx + 1; i < lastIdx; i++) {
			if (valid[i].t !== undefined && Number.isFinite(valid[i].t)) {
				ptr++;
			} else {
				const iA = timedIndices[ptr];
				const iB = timedIndices[ptr + 1];
				const dt = valid[iB].t - valid[iA].t;
				const di = iB - iA;
				valid[i].t = Math.round(valid[iA].t + (i - iA) * (dt / di));
			}
		}
	}

	valid.sort((a, b) => a.t - b.t);
	return valid;
}

function parseGpx(text: string): ParsedTrack[] {
	const tracks: ParsedTrack[] = [];
	let currentTrack: { name?: string; type?: string; rawPoints: RawPoint[] } | null = null;
	let currentPoint: RawPoint | null = null;
	let globalName: string | undefined = undefined;
	let globalType: string | undefined = undefined;

	let inTrk = false;
	let extensionsDepth = 0;
	let currentLeaf: string | null = null;
	let currentText = '';

	let pos = 0;
	const len = text.length;

	while (pos < len) {
		const lt = text.indexOf('<', pos);
		if (lt === -1) break;

		if (lt > pos && currentLeaf !== null) {
			currentText += decodeXml(text.slice(pos, lt));
		}

		if (text.startsWith('<!--', lt)) {
			const end = text.indexOf('-->', lt + 4);
			if (end === -1) break;
			pos = end + 3;
			continue;
		}

		if (text.startsWith('<![CDATA[', lt)) {
			const end = text.indexOf(']]>', lt + 9);
			if (end === -1) break;
			if (currentLeaf !== null) {
				currentText += text.slice(lt + 9, end);
			}
			pos = end + 3;
			continue;
		}

		if (text.startsWith('<?', lt)) {
			const end = text.indexOf('?>', lt + 2);
			if (end === -1) break;
			pos = end + 2;
			continue;
		}

		if (text.startsWith('<!', lt)) {
			const end = text.indexOf('>', lt + 2);
			if (end === -1) break;
			pos = end + 1;
			continue;
		}

		let tagEnd = -1;
		let quoteChar: string | null = null;
		for (let i = lt + 1; i < len; i++) {
			const c = text[i];
			if (quoteChar) {
				if (c === quoteChar) quoteChar = null;
			} else if (c === '"' || c === "'") {
				quoteChar = c;
			} else if (c === '>') {
				tagEnd = i;
				break;
			}
		}
		if (tagEnd === -1) break;

		pos = tagEnd + 1;
		const tagContent = text.slice(lt + 1, tagEnd).trim();
		if (!tagContent) continue;

		if (tagContent.charCodeAt(0) === SLASH_CHAR_CODE) {
			const tagName = tagContent.slice(1).trim();
			const colon = tagName.indexOf(':');
			const localName = (colon === -1 ? tagName : tagName.slice(colon + 1)).toLowerCase();

			if (localName === 'trk') {
				if (currentTrack) {
					if (!currentTrack.name && globalName) currentTrack.name = globalName;
					if (!currentTrack.type && globalType) currentTrack.type = globalType;
					const points = interpolateAndSort(currentTrack.rawPoints);
					tracks.push({
						name: currentTrack.name,
						type: currentTrack.type,
						points
					});
					currentTrack = null;
				}
				inTrk = false;
			} else if (localName === 'trkpt') {
				if (currentPoint && currentTrack) {
					currentTrack.rawPoints.push(currentPoint);
				}
				currentPoint = null;
				extensionsDepth = 0;
				currentLeaf = null;
			} else if (localName === 'extensions') {
				if (extensionsDepth > 0) extensionsDepth--;
			} else if (localName === currentLeaf) {
				if (currentLeaf === 'name') {
					const val = decodeXml(currentText).trim();
					if (inTrk && currentTrack) {
						currentTrack.name = val || undefined;
					} else if (!globalName) {
						globalName = val || undefined;
					}
				} else if (currentLeaf === 'type') {
					const val = decodeXml(currentText).trim();
					if (inTrk && currentTrack) {
						currentTrack.type = val || undefined;
					} else if (!globalType) {
						globalType = val || undefined;
					}
				} else if (currentLeaf === 'ele' && currentPoint) {
					const v = parseFloat(currentText);
					if (Number.isFinite(v)) currentPoint.ele = v;
				} else if (currentLeaf === 'time' && currentPoint) {
					const t = Date.parse(currentText.trim());
					if (!isNaN(t)) currentPoint.t = t;
				} else if (currentLeaf === 'speed' && currentPoint) {
					const v = parseFloat(currentText);
					if (Number.isFinite(v) && v >= 0) currentPoint.spd = v;
				} else if (currentLeaf === 'hr' && currentPoint) {
					const v = parseFloat(currentText);
					if (Number.isFinite(v) && v > 0) currentPoint.hr = Math.round(v);
				} else if (currentLeaf === 'acc' && currentPoint) {
					const v = parseFloat(currentText);
					if (Number.isFinite(v) && v >= 0) currentPoint.acc = v;
				}
				currentLeaf = null;
			}
		} else {
			const isSelfClosing = tagContent.endsWith('/');
			const inner = isSelfClosing ? tagContent.slice(0, -1).trim() : tagContent;
			let spaceIdx = -1;
			for (let i = 0; i < inner.length; i++) {
				if (inner.charCodeAt(i) <= 32) {
					spaceIdx = i;
					break;
				}
			}
			let tagName: string;
			let attrStr: string;
			if (spaceIdx === -1) {
				tagName = inner;
				attrStr = '';
			} else {
				tagName = inner.slice(0, spaceIdx);
				attrStr = inner.slice(spaceIdx + 1);
			}
			const colon = tagName.indexOf(':');
			const localName = (colon === -1 ? tagName : tagName.slice(colon + 1)).toLowerCase();

			if (localName === 'trk') {
				inTrk = true;
				currentTrack = { name: undefined, type: undefined, rawPoints: [] };
			} else if (localName === 'trkpt') {
				const latMatch = LAT_RE.exec(attrStr);
				const lonMatch = LON_RE.exec(attrStr);
				if (latMatch && lonMatch) {
					const lat = parseFloat(latMatch[2] ?? latMatch[3]);
					const lon = parseFloat(lonMatch[2] ?? lonMatch[3]);
					currentPoint = { lat, lon };
				} else {
					currentPoint = null;
				}
				if (isSelfClosing) {
					if (currentPoint && currentTrack) {
						currentTrack.rawPoints.push(currentPoint);
					}
					currentPoint = null;
				}
			} else if (localName === 'extensions') {
				if (!isSelfClosing) extensionsDepth++;
			} else if (localName === 'name' && currentPoint === null) {
				currentLeaf = 'name';
				currentText = '';
			} else if (localName === 'type' && currentPoint === null) {
				currentLeaf = 'type';
				currentText = '';
			} else if (currentPoint !== null) {
				if (localName === 'ele') {
					currentLeaf = 'ele';
					currentText = '';
				} else if (localName === 'time') {
					currentLeaf = 'time';
					currentText = '';
				} else if (localName === 'speed') {
					currentLeaf = 'speed';
					currentText = '';
				} else if (extensionsDepth > 0) {
					if (localName === 'hr') {
						currentLeaf = 'hr';
						currentText = '';
					} else if (localName === 'acc' || localName === 'accuracy') {
						currentLeaf = 'acc';
						currentText = '';
					}
				}
			}
		}
	}

	return tracks;
}

function parseTcx(text: string): ParsedTrack[] {
	const tracks: ParsedTrack[] = [];
	let currentTrack: {
		name?: string;
		notes?: string;
		id?: string;
		type?: string;
		rawPoints: RawPoint[];
	} | null = null;
	let currentPoint: RawPoint | null = null;

	let inActivity = false;
	let inPosition = false;
	let inHeartRate = false;
	let extensionsDepth = 0;
	let currentLeaf: string | null = null;
	let currentText = '';

	let pos = 0;
	const len = text.length;

	while (pos < len) {
		const lt = text.indexOf('<', pos);
		if (lt === -1) break;

		if (lt > pos && currentLeaf !== null) {
			currentText += decodeXml(text.slice(pos, lt));
		}

		if (text.startsWith('<!--', lt)) {
			const end = text.indexOf('-->', lt + 4);
			if (end === -1) break;
			pos = end + 3;
			continue;
		}

		if (text.startsWith('<![CDATA[', lt)) {
			const end = text.indexOf(']]>', lt + 9);
			if (end === -1) break;
			if (currentLeaf !== null) {
				currentText += text.slice(lt + 9, end);
			}
			pos = end + 3;
			continue;
		}

		if (text.startsWith('<?', lt)) {
			const end = text.indexOf('?>', lt + 2);
			if (end === -1) break;
			pos = end + 2;
			continue;
		}

		if (text.startsWith('<!', lt)) {
			const end = text.indexOf('>', lt + 2);
			if (end === -1) break;
			pos = end + 1;
			continue;
		}

		let tagEnd = -1;
		let quoteChar: string | null = null;
		for (let i = lt + 1; i < len; i++) {
			const c = text[i];
			if (quoteChar) {
				if (c === quoteChar) quoteChar = null;
			} else if (c === '"' || c === "'") {
				quoteChar = c;
			} else if (c === '>') {
				tagEnd = i;
				break;
			}
		}
		if (tagEnd === -1) break;

		pos = tagEnd + 1;
		const tagContent = text.slice(lt + 1, tagEnd).trim();
		if (!tagContent) continue;

		if (tagContent.charCodeAt(0) === SLASH_CHAR_CODE) {
			const tagName = tagContent.slice(1).trim();
			const colon = tagName.indexOf(':');
			const localName = (colon === -1 ? tagName : tagName.slice(colon + 1)).toLowerCase();

			if (localName === 'activity') {
				if (currentTrack) {
					const name = currentTrack.name || currentTrack.notes || currentTrack.id || undefined;
					const points = interpolateAndSort(currentTrack.rawPoints);
					tracks.push({
						name,
						type: currentTrack.type,
						points
					});
					currentTrack = null;
				}
				inActivity = false;
			} else if (localName === 'trackpoint') {
				if (currentPoint && currentTrack) {
					currentTrack.rawPoints.push(currentPoint);
				}
				currentPoint = null;
				inPosition = false;
				inHeartRate = false;
				extensionsDepth = 0;
				currentLeaf = null;
			} else if (localName === 'position') {
				inPosition = false;
			} else if (localName === 'heartratebpm') {
				inHeartRate = false;
			} else if (localName === 'extensions') {
				if (extensionsDepth > 0) extensionsDepth--;
			} else if (
				localName === currentLeaf ||
				(currentLeaf === 'acc' && (localName === 'acc' || localName === 'accuracy')) ||
				(currentLeaf === 'hrvalue' && localName === 'value')
			) {
				if (currentLeaf === 'name' && currentTrack) {
					const val = decodeXml(currentText).trim();
					currentTrack.name = val || undefined;
				} else if (currentLeaf === 'notes' && currentTrack) {
					const val = decodeXml(currentText).trim();
					currentTrack.notes = val || undefined;
				} else if (currentLeaf === 'id' && currentTrack) {
					const val = decodeXml(currentText).trim();
					currentTrack.id = val || undefined;
				} else if (currentLeaf === 'time' && currentPoint) {
					const t = Date.parse(currentText.trim());
					if (!isNaN(t)) currentPoint.t = t;
				} else if (currentLeaf === 'latitudedegrees' && currentPoint) {
					const v = parseFloat(currentText);
					if (Number.isFinite(v)) currentPoint.lat = v;
				} else if (currentLeaf === 'longitudedegrees' && currentPoint) {
					const v = parseFloat(currentText);
					if (Number.isFinite(v)) currentPoint.lon = v;
				} else if (currentLeaf === 'altitudemeters' && currentPoint) {
					const v = parseFloat(currentText);
					if (Number.isFinite(v)) currentPoint.ele = v;
				} else if (currentLeaf === 'hrvalue' && currentPoint) {
					const v = parseFloat(currentText);
					if (Number.isFinite(v) && v > 0) currentPoint.hr = Math.round(v);
				} else if (currentLeaf === 'speed' && currentPoint) {
					const v = parseFloat(currentText);
					if (Number.isFinite(v) && v >= 0) currentPoint.spd = v;
				} else if (currentLeaf === 'acc' && currentPoint) {
					const v = parseFloat(currentText);
					if (Number.isFinite(v) && v >= 0) currentPoint.acc = v;
				}
				currentLeaf = null;
			}
		} else {
			const isSelfClosing = tagContent.endsWith('/');
			const inner = isSelfClosing ? tagContent.slice(0, -1).trim() : tagContent;
			let spaceIdx = -1;
			for (let i = 0; i < inner.length; i++) {
				if (inner.charCodeAt(i) <= 32) {
					spaceIdx = i;
					break;
				}
			}
			let tagName: string;
			let attrStr: string;
			if (spaceIdx === -1) {
				tagName = inner;
				attrStr = '';
			} else {
				tagName = inner.slice(0, spaceIdx);
				attrStr = inner.slice(spaceIdx + 1);
			}
			const colon = tagName.indexOf(':');
			const localName = (colon === -1 ? tagName : tagName.slice(colon + 1)).toLowerCase();

			if (localName === 'activity') {
				inActivity = true;
				const sportMatch = SPORT_RE.exec(attrStr);
				const type = sportMatch ? decodeXml(sportMatch[2] ?? sportMatch[3]) : undefined;
				currentTrack = { type, rawPoints: [] };
			} else if (localName === 'trackpoint') {
				currentPoint = {};
				if (isSelfClosing) {
					currentPoint = null;
				}
			} else if (currentPoint === null && inActivity) {
				if (localName === 'name') {
					currentLeaf = 'name';
					currentText = '';
				} else if (localName === 'notes') {
					currentLeaf = 'notes';
					currentText = '';
				} else if (localName === 'id') {
					currentLeaf = 'id';
					currentText = '';
				}
			} else if (currentPoint !== null) {
				if (localName === 'time') {
					currentLeaf = 'time';
					currentText = '';
				} else if (localName === 'position') {
					inPosition = true;
				} else if (inPosition && localName === 'latitudedegrees') {
					currentLeaf = 'latitudedegrees';
					currentText = '';
				} else if (inPosition && localName === 'longitudedegrees') {
					currentLeaf = 'longitudedegrees';
					currentText = '';
				} else if (localName === 'altitudemeters') {
					currentLeaf = 'altitudemeters';
					currentText = '';
				} else if (localName === 'heartratebpm') {
					inHeartRate = true;
				} else if (inHeartRate && localName === 'value') {
					currentLeaf = 'hrvalue';
					currentText = '';
				} else if (localName === 'extensions') {
					if (!isSelfClosing) extensionsDepth++;
				} else if (extensionsDepth > 0) {
					if (localName === 'speed') {
						currentLeaf = 'speed';
						currentText = '';
					} else if (localName === 'acc' || localName === 'accuracy') {
						currentLeaf = 'acc';
						currentText = '';
					}
				}
			}
		}
	}

	return tracks;
}

export function parseTrackFile(text: string): ParsedTrack[] {
	if (!text) return [];
	if (text.charCodeAt(0) === BYTE_ORDER_MARK) {
		text = text.slice(1);
	}
	if (/<(?:[a-zA-Z0-9_:-]+:)?(?:TrainingCenterDatabase|Activities|Activity)\b/i.test(text)) {
		return parseTcx(text);
	}
	if (/<(?:[a-zA-Z0-9_:-]+:)?(?:gpx|trk)\b/i.test(text)) {
		return parseGpx(text);
	}
	return [];
}

export function toGpx(
	name: string,
	points: TrackPoint[],
	opts?: { creator?: string; type?: string }
): string {
	const creator = opts?.creator ?? 'openski.org';
	const metaTime = formatUtc(points.length > 0 ? points[0].t : 0);
	const parts: string[] = [];

	parts.push('<?xml version="1.0" encoding="UTF-8"?>\n');
	parts.push(
		`<gpx version="1.1" creator="${escapeXml(creator)}" xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd http://www.garmin.com/xmlschemas/TrackPointExtension/v1 http://www.garmin.com/xmlschemas/TrackPointExtensionv1.xsd">\n`
	);
	parts.push(`\t<metadata>\n\t\t<time>${metaTime}</time>\n\t</metadata>\n`);
	parts.push(`\t<trk>\n\t\t<name>${escapeXml(name)}</name>\n`);
	if (opts?.type) {
		parts.push(`\t\t<type>${escapeXml(opts.type)}</type>\n`);
	}
	parts.push('\t\t<trkseg>\n');

	for (let i = 0; i < points.length; i++) {
		const pt = points[i];
		parts.push(`\t\t\t<trkpt lat="${pt.lat.toFixed(7)}" lon="${pt.lon.toFixed(7)}">\n`);
		if (pt.ele !== undefined && Number.isFinite(pt.ele)) {
			parts.push(`\t\t\t\t<ele>${pt.ele.toFixed(1)}</ele>\n`);
		}
		parts.push(`\t\t\t\t<time>${formatUtc(pt.t)}</time>\n`);
		if (pt.hr !== undefined && Number.isFinite(pt.hr)) {
			parts.push(
				`\t\t\t\t<extensions>\n\t\t\t\t\t<gpxtpx:TrackPointExtension>\n\t\t\t\t\t\t<gpxtpx:hr>${Math.round(
					pt.hr
				)}</gpxtpx:hr>\n\t\t\t\t\t</gpxtpx:TrackPointExtension>\n\t\t\t\t</extensions>\n`
			);
		}
		parts.push('\t\t\t</trkpt>\n');
	}

	parts.push('\t\t</trkseg>\n\t</trk>\n</gpx>\n');
	return parts.join('');
}
