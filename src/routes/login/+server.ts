import { error, redirect } from '@sveltejs/kit';
import { osmProviderId, osmWeb } from '#lib/server/auth.ts';
import type { RequestHandler } from './$types';

const EDIT_PAGES = /\/(edit|questions)(\/|$|\?)/;

function localPath(candidate: string | null): string {
	return candidate?.startsWith('/') && !candidate.startsWith('//') ? candidate : '/';
}

export const GET: RequestHandler = async ({ locals, url, request }) => {
	if (!locals.auth) error(503, 'OpenStreetMap sign-in is not configured on this deployment.');
	const callbackURL = localPath(url.searchParams.get('next'));
	const wantsEdit = url.searchParams.get('scope') === 'edit' || EDIT_PAGES.test(callbackURL);
	const scopes = wantsEdit ? ['write_api'] : [];

	const { url: osmUrl } =
		wantsEdit && locals.user
			? await locals.auth.api.linkSocialAccount({
					body: { provider: osmProviderId, scopes, callbackURL, errorCallbackURL: callbackURL },
					headers: request.headers
				})
			: await locals.auth.api.signInSocial({
					body: { provider: osmProviderId, scopes, callbackURL }
				});
	if (!osmUrl) error(502, 'OpenStreetMap sign-in is not available right now.');
	redirect(302, osmUrl, { external: [osmWeb] });
};
