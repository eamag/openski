export type CameraSource =
	| {
			kind: 'panomax';
			panomaxId: number;
			resolution: string;
			tile: { width: number; height: number; rows: number; cols: number };
			composite: { width: number; height: number };
	  }
	| {
			kind: 'still';
			url: string;
			width: number;
			height: number;
			proxy: boolean;
			rotates: boolean;
	  };

export interface QueueRegion {
	id: string;
	liftId?: string;
	label: string;
	box: [x0: number, y0: number, x1: number, y1: number];
	upscale: number;
	blur?: number;
}

export interface QueueCamera {
	camera: string;
	name: string;
	pageUrl: string;
	source: CameraSource;
	regions: QueueRegion[];
}

export interface ContributedCamera extends Omit<QueueCamera, 'regions'> {
	regions: (Omit<QueueRegion, 'liftId'> & { liftOsm: string | null; liftName: string | null })[];
}

export interface Detection {
	x: number;
	y: number;
	w: number;
	h: number;
	score: number;
}
