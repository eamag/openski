import type { ClientInit } from '@sveltejs/kit/hooks';
import { initLocale } from '#lib/i18n/index.ts';

export const init: ClientInit = async () => {
	await initLocale();
};
