import { getTimes } from 'suncalc';
import { readStored, writeStored } from '#lib/browser-storage.ts';
import { app } from './app.svelte.ts';

export type ThemeChoice = 'auto' | 'light' | 'dark' | 'sunset';

const KEY = 'theme';
const COLOR = { light: '#ffffff', dark: '#171b22' } as const;

class ThemeState {
	choice = $state<ThemeChoice>('auto');
	private systemDark = $state(false);
	private now = $state(Date.now());
	private started = false;
	private timer: ReturnType<typeof setInterval> | undefined;

	constructor() {
		const saved = readStored(KEY);
		if (saved === 'auto' || saved === 'light' || saved === 'dark' || saved === 'sunset')
			this.choice = saved;
	}

	init(): void {
		if (this.started || typeof window === 'undefined') return;
		this.started = true;
		const mq = matchMedia('(prefers-color-scheme: dark)');
		this.systemDark = mq.matches;
		mq.addEventListener('change', (e) => (this.systemDark = e.matches));
		this.now = Date.now();
		this.timer = setInterval(() => {
			if (this.choice === 'sunset') this.now = Date.now();
		}, 60_000);
		this.apply();
	}

	get dark(): boolean {
		switch (this.choice) {
			case 'dark':
				return true;
			case 'light':
				return false;
			case 'auto':
				return this.systemDark;
			case 'sunset': {
				const center = app.resort?.data.center;
				if (!center) return this.systemDark;
				try {
					const sun = getTimes(new Date(this.now), center[1], center[0]);
					if (!sun.sunset || !sun.sunrise) return this.systemDark;
					return this.now >= sun.sunset.getTime() || this.now < sun.sunrise.getTime();
				} catch {
					return this.systemDark;
				}
			}
		}
	}

	set(choice: ThemeChoice): void {
		this.choice = choice;
		this.now = Date.now();
		writeStored(KEY, choice);
		this.apply();
	}

	apply(dark = this.dark): void {
		if (!this.started || typeof document === 'undefined') return;
		document.documentElement.dataset.theme = dark ? 'dark' : 'light';
		for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'))
			meta.content = dark ? COLOR.dark : COLOR.light;
	}

	destroy(): void {
		if (this.timer) clearInterval(this.timer);
	}
}

export const theme = new ThemeState();
