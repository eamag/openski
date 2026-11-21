import { readStoredJson, writeStored } from '#lib/browser-storage.ts';
import { t } from '#lib/i18n/index.ts';
import { downloadOffline, forgetOffline, type DownloadProgress } from '#lib/offline.ts';
import type { ResortData } from '#lib/resort/types.ts';

const KEY = 'offline-resorts';

export interface OfflineDownload {
	resort: string;
	state: 'busy' | 'done' | 'error';
	progress?: DownloadProgress;
	message?: string;
}

class OfflineState {
	saved = $state<Record<string, boolean>>({});
	download = $state<OfflineDownload | null>(null);

	constructor() {
		if (typeof localStorage === 'undefined') return;
		this.syncFromStorage();

		if (typeof window !== 'undefined') {
			window.addEventListener('storage', (e) => {
				if (e.key === KEY) this.syncFromStorage();
			});

			if ('serviceWorker' in navigator) {
				navigator.serviceWorker.addEventListener('message', (event) => {
					const data = event.data as
						({ type?: string; id?: string } & DownloadProgress) | undefined;
					if (data?.type !== 'download-progress' || !data.id) return;
					const progress: DownloadProgress = {
						done: data.done,
						total: data.total,
						failed: data.failed
					};
					if (data.done < data.total) {
						this.download = { resort: data.id, state: 'busy', progress };
					} else if (data.failed > 0) {
						this.download = {
							resort: data.id,
							state: 'error',
							progress,
							message: t.offline.downloadFailed(data.failed)
						};
					} else {
						this.mark(data.id);
						this.download = { resort: data.id, state: 'done', progress };
					}
				});
			}
		}
	}

	private syncFromStorage(): void {
		const ids = readStoredJson<unknown>(KEY, []);
		if (!Array.isArray(ids)) return;
		const next: Record<string, boolean> = {};
		for (const id of ids) if (typeof id === 'string') next[id] = true;
		this.saved = next;
	}

	has(id: string): boolean {
		return !!this.saved[id];
	}

	downloadFor(id: string): OfflineDownload | null {
		if (this.download?.resort === id) return this.download;
		return this.has(id) ? { resort: id, state: 'done' } : null;
	}

	async save(resort: ResortData): Promise<void> {
		if (this.download?.state === 'busy' && this.download.resort === resort.id) return;
		const id = resort.id;
		this.download = { resort: id, state: 'busy' };
		try {
			const result = await downloadOffline(resort, (progress) => {
				this.download = { resort: id, state: 'busy', progress };
			});
			if (result.failed > 0) {
				this.download = {
					resort: id,
					state: 'error',
					progress: result,
					message: t.offline.downloadFailed(result.failed)
				};
			} else {
				this.mark(id);
				this.download = { resort: id, state: 'done', progress: result };
			}
		} catch (err) {
			this.download = { resort: id, state: 'error', message: (err as Error).message };
		}
	}

	async forget(id: string): Promise<void> {
		if (!this.saved[id]) return;
		const next = { ...this.saved };
		delete next[id];
		this.saved = next;
		this.persist();
		if (this.download?.resort === id) this.download = null;
		await forgetOffline(id);
	}

	private mark(id: string): void {
		if (this.saved[id]) return;
		this.saved = { ...this.saved, [id]: true };
		this.persist();
	}

	private persist(): void {
		writeStored(KEY, JSON.stringify(Object.keys(this.saved)));
	}
}

export const offline = new OfflineState();
