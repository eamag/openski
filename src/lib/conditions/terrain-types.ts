export const HORIZON_STEPS_PER_DEGREE = 2;

export interface TerrainData {
	version: string;
	bins: number;
	aspect: number[];
	slope: number[];
	tpi: number[];
	horizon: number[];
}
