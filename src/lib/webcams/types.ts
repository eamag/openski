export interface WebcamTileLayout {
	rows: number;
	cols: number;
	tileWidth: number;
	tileHeight: number;
	compositeWidth: number;
	compositeHeight: number;
	urlPattern?: string;
}

export interface WebcamPosition {
	lat: number;
	lon: number;
}

export interface ResolvedWebcam {
	provider: string;
	cameraId: string;
	canonicalPageUrl: string;
	name: string;
	imageUrl: string;
	archiveUrlPattern: string | null;
	archiveTimeStepMin: number | null;
	archiveHistoryDays: number | null;
	width: number;
	height: number;
	panorama: boolean;
	tileLayout: WebcamTileLayout | null;
	position: WebcamPosition | null;
	elevation: number | null;
	viewingDirection: number | null;
	fieldOfView: number | null;
	cors: '*' | 'none';
	updateIntervalMin: number | null;
	newestPictureTime: string | null;
	fullImageUrl?: string | null;
	fullWidth?: number | null;
	fullHeight?: number | null;
	fullArchiveUrlPattern?: string | null;
}

export interface WebcamAdapter {
	name: string;
	match(url: URL): boolean;
	resolve(url: URL, fetchFn: typeof fetch): Promise<ResolvedWebcam>;
}

export class UnsupportedWebcam extends Error {
	readonly host: string;
	constructor(host: string) {
		super(`Unsupported webcam host: ${host}`);
		this.name = 'UnsupportedWebcam';
		this.host = host;
	}
}
