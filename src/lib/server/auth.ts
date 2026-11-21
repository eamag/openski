import {
	ORIGIN,
	BETTER_AUTH_SECRET,
	OSM_API,
	OSM_CLIENT_ID,
	OSM_CLIENT_SECRET,
	OSM_WRITES_ENABLED,
	OSM_WRITES_ALLOWLIST
} from '$app/env/private';

import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { genericOAuth } from 'better-auth/plugins';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { APP_USER_AGENT } from '#lib/identity.ts';
import { getDb } from '#lib/server/db/index.ts';

export const osmApi = (OSM_API || 'https://master.apis.dev.openstreetmap.org').replace(/\/+$/, '');
export const osmWeb = osmApi.replace('api.openstreetmap.org', 'www.openstreetmap.org');

export const isOsmSandbox = osmApi !== 'https://api.openstreetmap.org';

export const osmProviderId = 'osm';
export const osmAuthConfigured = !!(BETTER_AUTH_SECRET && OSM_CLIENT_ID && OSM_CLIENT_SECRET);

export function isOsmWritesEnabled(): boolean {
	const enabledSetting = (OSM_WRITES_ENABLED ?? '').trim().toLowerCase();
	return enabledSetting === 'true' || enabledSetting === '1';
}

export function isUserAllowedToWrite(
	user: { name: string } | null | undefined,
	osmUserId?: string | null
): boolean {
	if (!user) return false;
	if (!isOsmWritesEnabled()) return false;
	const allowlistEntries = (OSM_WRITES_ALLOWLIST ?? '')
		.split(',')
		.map((entry) => entry.trim().toLowerCase())
		.filter(Boolean);
	const allowsAllUsers = allowlistEntries.length === 0 || allowlistEntries.includes('*');
	if (allowsAllUsers) return true;
	const matchesUserName = allowlistEntries.includes(user.name.toLowerCase());
	const matchesUserId = Boolean(osmUserId && allowlistEntries.includes(osmUserId));
	return matchesUserName || matchesUserId;
}

interface OsmUserDetails {
	user: { id: number; display_name: string; img?: { href: string } };
}

const RESERVED_INVALID_EMAIL_DOMAIN = 'users.osm.invalid';
const READ_PREFS_SCOPE = ['read_prefs'];

const authConfig = {
	account: {
		encryptOAuthTokens: true,
		accountLinking: {
			allowUnlinkingAll: true,
			trustedProviders: [osmProviderId]
		}
	},
	plugins: [
		genericOAuth({
			config: [
				{
					providerId: osmProviderId,
					name: isOsmSandbox ? 'OpenStreetMap Sandbox' : 'OpenStreetMap',
					clientId: OSM_CLIENT_ID ?? '',
					clientSecret: OSM_CLIENT_SECRET,
					authorizationUrl: `${osmWeb}/oauth2/authorize`,
					tokenUrl: `${osmWeb}/oauth2/token`,
					scopes: READ_PREFS_SCOPE,
					async getUserInfo(tokens) {
						const res = await fetch(`${osmApi}/api/0.6/user/details.json`, {
							headers: {
								Authorization: `Bearer ${tokens.accessToken}`,
								'User-Agent': APP_USER_AGENT
							}
						});
						if (!res.ok) return null;
						const { user } = (await res.json()) as OsmUserDetails;
						return {
							id: String(user.id),
							name: user.display_name,
							email: `${user.id}@${RESERVED_INVALID_EMAIL_DOMAIN}`,
							emailVerified: false,
							image: user.img?.href
						};
					}
				}
			]
		}),
		sveltekitCookies(getRequestEvent)
	]
} satisfies Omit<Parameters<typeof betterAuth>[0], 'database'>;

export const createAuth = (
	d1: D1Database,
	connection = { baseURL: ORIGIN, secret: BETTER_AUTH_SECRET }
) =>
	betterAuth({
		...authConfig,
		...connection,
		database: drizzleAdapter(getDb(d1), { provider: 'sqlite' })
	});
