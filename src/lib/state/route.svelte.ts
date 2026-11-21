import { placeKey, placeNodes, type Place } from '#lib/resort/places.ts';
import { DEFAULT_PREFS, findRoute, type Route, type RoutePrefs } from '#lib/resort/routing.ts';
import { loadPrefs, savePrefs } from '#lib/storage.ts';
import { t } from '#lib/i18n/index.ts';
import { app } from './app.svelte.ts';
import { conditions } from './conditions.svelte.ts';
import { location } from './location.svelte.ts';
import { queues } from './queues.svelte.ts';
import { status } from './status.svelte.ts';

class RouteState {
	from = $state.raw<Place>({ kind: 'me' });
	to = $state.raw<Place | null>(null);
	prefs = $state<RoutePrefs>({ ...DEFAULT_PREFS });
	ignoreClosures = $state(false);

	closed = $derived({
		lifts: status.lifts.filter((open) => open === false).length,
		pistes: status.pistes.filter((open) => open === false).length
	});
	private fromNodes = $derived.by(() => {
		const resort = app.resort;
		if (!resort) return '';
		const fix = location.fix;
		return placeNodes(resort, this.from, 'from', fix ? [fix.lon, fix.lat] : null).join(',');
	});

	private toNodes = $derived.by(() => {
		const resort = app.resort;
		if (!resort || !this.to) return '';
		const fix = location.fix;
		return placeNodes(resort, this.to, 'to', fix ? [fix.lon, fix.lat] : null).join(',');
	});

	problem = $derived.by((): string | null => {
		if (!this.to) return null;
		if (!this.fromNodes) {
			if (this.from.kind !== 'me') return t.route.problem.startTooFar;
			if (location.status === 'denied') return t.route.problem.locationDenied;
			if (!location.fix) return t.route.problem.waitingForLocation;
			return t.route.problem.outsideResort;
		}
		if (!this.toNodes) return t.route.problem.destinationTooFar;
		if (placeKey(this.from) === placeKey(this.to)) return t.route.problem.sameEndpoints;
		return this.result ? null : t.route.problem.noRouteFound;
	});

	result = $derived.by((): Route | null => {
		const resort = app.resort;
		if (!resort || !this.fromNodes || !this.toNodes) return null;
		const from = this.fromNodes.split(',').map(Number);
		const to = this.toNodes.split(',').map(Number);
		if (from.some((n) => to.includes(n))) return null;
		const lifts = status.lifts;
		const pistes = status.pistes;
		return findRoute(resort, from, to, this.prefs, {
			liftWait: queues.liftWait,
			edgeFactor: this.prefs.preferGoodSnow ? conditions.edgeFactor : undefined,
			liftOpen: (liftIndex) => lifts[liftIndex],
			pisteOpen: (pisteIndex) => pistes[pisteIndex],
			allowClosed: this.ignoreClosures
		});
	});

	swap() {
		if (!this.to) return;
		const from = this.from;
		this.from = this.to;
		this.to = from;
	}

	clear() {
		this.to = null;
		this.from = { kind: 'me' };
	}

	async restorePrefs() {
		const saved = await loadPrefs<Partial<RoutePrefs>>();
		if (saved) this.prefs = { ...DEFAULT_PREFS, ...saved };
	}

	setPrefs(patch: Partial<RoutePrefs>) {
		this.prefs = { ...this.prefs, ...patch };
		void savePrefs($state.snapshot(this.prefs));
	}
}

export const route = new RouteState();
