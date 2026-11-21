import { json } from '@sveltejs/kit';
import {
	isOsmSandbox,
	isOsmWritesEnabled,
	isUserAllowedToWrite,
	osmProviderId,
	osmWeb
} from '#lib/server/auth.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, request }) => {
	const user = locals.user;
	let hasEditScope = false;
	let hasAccount = false;
	let osmUserId: string | null = null;

	if (user && locals.auth) {
		try {
			const accounts = await locals.auth.api.listUserAccounts({ headers: request.headers });
			const osmAccount = accounts.find((a) => a.providerId === osmProviderId);
			if (osmAccount) {
				hasAccount = true;
				osmUserId = osmAccount.accountId;
				hasEditScope = !!osmAccount.scopes?.includes('write_api');
			}
		} catch {
			hasAccount = false;
		}
	}

	const writesEnabled = isOsmWritesEnabled();
	const allowedToWrite = isUserAllowedToWrite(user, osmUserId);
	const canWrite = writesEnabled && allowedToWrite && hasEditScope;

	let reason: string | null = null;
	if (!locals.auth) {
		reason = 'OpenStreetMap sign-in is not configured on this deployment.';
	} else if (!writesEnabled) {
		reason = 'Saving to OpenStreetMap is turned off on this deployment.';
	} else if (!user) {
		reason = 'Sign in with OpenStreetMap to save changes.';
	} else if (!allowedToWrite) {
		reason = 'Saving to OpenStreetMap is open to invited mappers only for now.';
	} else if (!hasEditScope) {
		reason = 'You signed in without edit permission. Grant edit permission to save.';
	}

	return json(
		{
			user: user
				? {
						id: user.id,
						name: user.name,
						image: user.image ?? null,
						hasEditScope,
						canWrite
					}
				: null,
			server: osmWeb,
			isSandbox: isOsmSandbox,
			readiness: {
				writesEnabled,
				allowedToWrite,
				canWrite,
				hasEditScope,
				hasAccount,
				reason
			},
			revokeUrl: `${osmWeb}/oauth2/authorized_applications`
		},
		{ headers: { 'cache-control': 'private, no-store' } }
	);
};
