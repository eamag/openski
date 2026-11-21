import { readStored, writeStored } from '#lib/browser-storage.ts';

interface InstallEvent extends Event {
	prompt(): Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const VISITS = 'visits';
const LATER = 'install-later';
const ONE_MONTH_MS = 30 * 24 * 3600_000;
const MIN_VISITS_FOR_PROMPT = 2;
export const INTRO_SEEN = 'intro-seen';

class InstallState {
	private event = $state.raw<InstallEvent | null>(null);
	standalone = $state(true);
	ios = $state(false);
	visits = $state(0);
	later = $state(true);
	introSeen = $state(false);
	private started = false;

	init(): void {
		if (this.started) return;
		this.started = true;
		const nav = navigator as Navigator & { standalone?: boolean };
		this.standalone = matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
		const isIosDevice = /iPhone|iPad|iPod/.test(navigator.userAgent);
		const isIpadOsDesktopMode = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
		this.ios = isIosDevice || isIpadOsDesktopMode;
		this.introSeen = readStored(INTRO_SEEN) === '1';
		this.later = Date.now() - Number(readStored(LATER) ?? 0) < ONE_MONTH_MS;

		let count = Number(readStored(VISITS) ?? 0);
		if (!readStored(VISITS, 'session')) {
			writeStored(VISITS, '1', 'session');
			writeStored(VISITS, String(++count));
		}
		this.visits = count;

		addEventListener('beforeinstallprompt', (e) => {
			e.preventDefault();
			this.event = e as InstallEvent;
		});
		addEventListener('appinstalled', () => {
			this.event = null;
			this.standalone = true;
		});
	}

	get native(): boolean {
		return !this.standalone && this.event !== null;
	}

	get possible(): boolean {
		return !this.standalone && (this.event !== null || this.ios);
	}

	get due(): boolean {
		return this.possible && this.visits >= MIN_VISITS_FOR_PROMPT && this.introSeen && !this.later;
	}

	async install(): Promise<void> {
		const event = this.event;
		if (!event) return;
		await event.prompt();
		const { outcome } = await event.userChoice;
		this.event = null;
		if (outcome === 'dismissed') this.dismiss();
	}

	dismiss(): void {
		writeStored(LATER, String(Date.now()));
		this.later = true;
	}
}

export const install = new InstallState();
