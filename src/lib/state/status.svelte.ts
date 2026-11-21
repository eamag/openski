import { resolve } from '$app/paths';
import type { ResortStatus } from '#lib/status/intermaps.ts';
import { matchStatus } from '#lib/status/match.ts';
import { app } from './app.svelte.ts';

const STATUS_REFRESH_INTERVAL_MS = 10 * 60_000;
const MAX_FEED_AGE_MS = 12 * 3600_000;

class StatusState {
	data = $state.raw<ResortStatus | null>(null);
	missing = $state(false);
	stale = $state(false);
	private asked = 0;
	private askedFor: string | null = null;

	reset(): void {
		this.data = null;
		this.missing = false;
		this.asked = 0;
		this.askedFor = null;
	}

	async load(): Promise<void> {
		const resort = app.resort;
		if (!resort) return;
		if (this.askedFor === resort.id && Date.now() - this.asked < STATUS_REFRESH_INTERVAL_MS) return;
		if (this.askedFor !== resort.id) {
			this.data = null;
			this.missing = false;
		}
		this.askedFor = resort.id;
		this.asked = Date.now();
		try {
			const res = await fetch(resolve('/api/status/[resort]', { resort: resort.id }));
			if (!res.ok) throw new Error(String(res.status));
			const data = (await res.json()) as ResortStatus;
			const feedAgeMs = Date.now() - new Date(data.at).getTime();
			const isFeedRecent = feedAgeMs < MAX_FEED_AGE_MS;
			this.data = isFeedRecent ? data : null;
			this.missing = !this.data;
			this.stale = res.headers.get('x-from-cache') === '1';
			if (this.stale) this.asked = 0;
		} catch {
			this.missing = !this.data;
			if (this.data) this.stale = true;
			this.asked = 0;
		}
	}

	private matched = $derived.by(() => {
		const resort = app.resort;
		return resort && this.data
			? matchStatus(resort.data.lifts, resort.data.pistes, this.data)
			: null;
	});

	lifts = $derived(this.matched?.lifts ?? []);
	pistes = $derived(this.matched?.pistes ?? []);

	summary = $derived.by(() => {
		const m = this.matched;
		if (!m || !this.data) return null;
		const count = (list: (boolean | null)[]) => ({
			open: list.filter((x) => x === true).length,
			known: list.filter((x) => x !== null).length
		});
		const lifts = count(m.lifts);
		const pistes = count(m.pistes);
		if (lifts.known === 0 && pistes.known === 0) return null;
		return { lifts, pistes, at: this.data.at.slice(11, 16), stale: this.stale };
	});
}

export const status = new StatusState();
