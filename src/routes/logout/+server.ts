import { redirect } from '@sveltejs/kit';
import { osmProviderId } from '#lib/server/auth.ts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, request, url }) => {
	const { auth, user } = locals;
	if (url.searchParams.get('action') === 'unlink' && user && auth) {
		const accounts = await auth.api.listUserAccounts({ headers: request.headers }).catch(() => []);
		const osmAccount = accounts.find((a) => a.providerId === osmProviderId);
		if (osmAccount)
			await auth.api
				.unlinkAccount({ body: { accountId: osmAccount.id }, headers: request.headers })
				.catch((err: Error) => console.warn('osm_unlink_failed', err.message));
	}

	await auth?.api.signOut({ headers: request.headers });

	const next = url.searchParams.get('next') ?? '/';
	redirect(303, next.startsWith('/') && !next.startsWith('//') ? next : '/');
};
