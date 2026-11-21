# Deployment

One build runs as two Cloudflare Workers, configured in `wrangler.jsonc`:

| Environment | Host                       | OSM server                                            | D1 database | Deploy                |
| ----------- | -------------------------- | ----------------------------------------------------- | ----------- | --------------------- |
| Test site   | `https://openski.eamag.me` | `https://master.apis.dev.openstreetmap.org` (OSM dev) | `taktiski`  | `bun run deploy`      |
| Production  | `https://openski.org`      | `https://api.openstreetmap.org`                       | `openski`   | `bun run deploy:prod` |

The test site answers with `X-Robots-Tag: noindex` so search engines only index production.
`workers/www-redirect/` is a separate small Worker that sends `www.openski.org` to the apex domain; deploy it
with `bun x wrangler deploy -c workers/www-redirect/wrangler.jsonc`.

## Your own instance

`wrangler.jsonc` names this project's workers, domains and databases. Create a D1 database
(`bun x wrangler d1 create <name>`), then change `name`, `routes`, `database_name`, `database_id` and
`ORIGIN` before deploying.

## First deploy

1. Register an OAuth 2 application on the OSM server you use: scopes `read_prefs write_api`, redirect URI
   `<ORIGIN>/api/auth/callback/osm`.
2. Set the Worker secrets (add `--env production` for production):
   ```sh
   bun x wrangler secret put BETTER_AUTH_SECRET
   bun x wrangler secret put OSM_CLIENT_ID
   bun x wrangler secret put OSM_CLIENT_SECRET
   ```
3. Apply the database migrations: `bun run db:migrate:dev` or `bun run db:migrate:prod`.
4. Deploy: `bun run deploy` or `bun run deploy:prod`.

## Settings

Plain variables live in `wrangler.jsonc`; secrets are Worker secrets in production and `.env` locally
([`.env.example`](../.env.example) lists them all).

| Name                   | Kind     | Meaning                                                                 |
| ---------------------- | -------- | ----------------------------------------------------------------------- |
| `ORIGIN`               | variable | Public address of the deployment                                        |
| `OSM_API`              | variable | OpenStreetMap API server; defaults to the dev server                    |
| `OSM_WRITES_ENABLED`   | variable | `true` lets signed-in mappers save changesets                           |
| `OSM_WRITES_ALLOWLIST` | variable | Comma-separated OSM user ids or names allowed to save; empty allows all |
| `ENABLE_DEV_ROUTES`    | variable | `1` serves `/dev/*` on a deployed worker                                |
| `BETTER_AUTH_SECRET`   | secret   | Session signing key                                                     |
| `OSM_CLIENT_ID`        | secret   | OSM OAuth app id                                                        |
| `OSM_CLIENT_SECRET`    | secret   | OSM OAuth app secret                                                    |
| `OPEN_METEO_API_KEY`   | secret   | Optional key for Open-Meteo's commercial endpoint                       |

Signing in asks OpenStreetMap for `read_prefs`; granting edit permission adds `write_api`. Saving needs
that scope, `OSM_WRITES_ENABLED=true` and, when an allowlist is set, a match in it.

D1 stores signed-in accounts, sessions, contributed webcams and queue regions (schema in
`src/lib/server/db/schema.ts`). The map itself needs neither D1 nor sign-in.
