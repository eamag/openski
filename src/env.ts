import { defineEnvVars } from '@sveltejs/kit/env';

const optionalEnvVarWithEmptyDefault = (value: string | undefined) => value ?? '';

export const variables = defineEnvVars({
	ORIGIN: {
		schema: optionalEnvVarWithEmptyDefault,
		description:
			'The app origin (base URL), e.g. `http://127.0.0.1:5173`. Not `localhost`: OSM accepts plain-http redirect URIs only on 127.0.0.1.'
	},
	BETTER_AUTH_SECRET: {
		schema: optionalEnvVarWithEmptyDefault,
		description:
			'Secret used to sign tokens. For production use 32 characters generated with high entropy. See [Better Auth installation](https://www.better-auth.com/docs/installation).'
	},
	OSM_API: {
		schema: optionalEnvVarWithEmptyDefault,
		description:
			'OpenStreetMap API base: `https://master.apis.dev.openstreetmap.org` (dev server, the default) or `https://api.openstreetmap.org`.'
	},
	OSM_CLIENT_ID: {
		schema: optionalEnvVarWithEmptyDefault,
		description:
			'OAuth 2 client ID registered on the OSM server above, scopes `read_prefs write_api`, redirect `<ORIGIN>/api/auth/callback/osm`.'
	},
	OSM_CLIENT_SECRET: {
		schema: optionalEnvVarWithEmptyDefault,
		description: 'OAuth 2 client secret of the same OSM application.'
	},
	OSM_WRITES_ENABLED: {
		schema: optionalEnvVarWithEmptyDefault,
		description:
			'Server-side killswitch for OSM changeset writes: "true" or "1" to enable. Default is empty (writes disabled).'
	},
	OSM_WRITES_ALLOWLIST: {
		schema: optionalEnvVarWithEmptyDefault,
		description:
			'Optional comma-separated OSM user ids (the number on the OSM profile) or display names allowed to save changesets. Empty or `*` allows every signed-in user once writes are enabled.'
	},
	OPEN_METEO_API_KEY: {
		schema: optionalEnvVarWithEmptyDefault,
		description:
			'Optional Open-Meteo commercial API key. When set, routes requests to customer-api.open-meteo.com with &apikey=.'
	}
});
