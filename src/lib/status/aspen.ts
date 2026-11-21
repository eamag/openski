import type { ResortStatus } from './intermaps.ts';

export const aspenUrl = (mountain: string) =>
	`https://www.aspensnowmass.com/aspensnowmass/liftstatus/feed?mountain=${mountain}`;

interface Lift {
	liftName?: string;
	status?: string;
}

interface AspenFeedDoc {
	lastUpdated?: string | null;
	liftStatuses?: Lift[];
}

export function parseAspen(doc: unknown): ResortStatus {
	const feedDoc = doc as AspenFeedDoc;
	if (!Array.isArray(feedDoc?.liftStatuses)) throw new Error('unexpected status format');
	return {
		at: feedDoc.lastUpdated || new Date().toISOString(),
		lifts: feedDoc.liftStatuses.flatMap((lift) => {
			const name = lift.liftName?.trim();
			const isOpen = /^open$/i.test(lift.status ?? '');
			return name ? [{ name, kind: 'other' as const, open: isOpen }] : [];
		}),
		pistes: []
	};
}
