type StorageArea = 'local' | 'session';

const storageArea = (area: StorageArea) => (area === 'local' ? localStorage : sessionStorage);

export function readStored(key: string, area: StorageArea = 'local'): string | null {
	try {
		return storageArea(area).getItem(key);
	} catch {
		return null;
	}
}

export function readStoredJson<T>(key: string, fallback: T, area: StorageArea = 'local'): T {
	try {
		const raw = storageArea(area).getItem(key);
		return raw === null ? fallback : (JSON.parse(raw) as T);
	} catch {
		return fallback;
	}
}

export function writeStored(key: string, value: string | null, area: StorageArea = 'local'): void {
	try {
		if (value === null) storageArea(area).removeItem(key);
		else storageArea(area).setItem(key, value);
	} catch {
		return;
	}
}
