# Development

## Run locally

```sh
cp .env.example .env
bun install --frozen-lockfile
bun run db:migrate:local
bun run dev                     # http://127.0.0.1:5173
```

The public map needs no settings. OpenStreetMap sign-in needs an OAuth app and the values in `.env`
(see [deployment](deployment.md#settings)).

- Use `127.0.0.1`, not `localhost`: OpenStreetMap accepts plain-HTTP redirect URIs only on `127.0.0.1`.
- `.env`, `.env.*` (except `.env.example`) and `.dev.vars*` are gitignored. Wrangler reads `.dev.vars`
  for local Worker secrets.
- The people counter's WebAssembly runtime does not load under `vite dev`: try lift queues on the built
  worker (`bun run build && bun run preview`).

## Scripts

| Command                            | What it does                                                              |
| ---------------------------------- | ------------------------------------------------------------------------- |
| `bun run dev`                      | Vite dev server                                                           |
| `bun run check`                    | Worker types, `svelte-kit sync` and `svelte-check`                        |
| `bun run lint` / `bun run format`  | Prettier and ESLint                                                       |
| `bun run build`                    | Production build into `.svelte-kit/cloudflare`                            |
| `bun run preview`                  | The built worker at `http://127.0.0.1:4173`                               |
| `bun run gen`                      | Regenerate `worker-configuration.d.ts` from `wrangler.jsonc`              |
| `bun run deploy` / `deploy:prod`   | Build and deploy the test site / production ([deployment](deployment.md)) |
| `bun run db:generate`              | `schema.ts` → SQL migration in `drizzle/`                                 |
| `bun run db:migrate:local`         | Apply migrations to the local D1 database                                 |
| `bun run db:migrate:dev` / `:prod` | Apply migrations to the test / production D1 database                     |
| `bun run data:catalog`             | Rebuild the ski-area catalogue ([data](data.md))                          |
| `bun run data:fetch [resort]`      | Fetch OSM data and elevation grids for a resort                           |
| `bun run data [resort]`            | Build a resort's map, terrain and queue files                             |

Less frequent jobs run their script directly:

- The current social preview uses `static/og-apartment.png`. `bun scripts/build-og.ts` redraws the original card at `static/og.png`.
- `bun x auth generate --config src/lib/server/db/auth.codegen.ts --output src/lib/server/db/auth.schema.ts --yes`
  regenerates the Better Auth tables after a Better Auth upgrade; follow it with `bun run db:generate`.
- [Data](data.md#rebuild-cadence-and-commands) lists the pipeline scripts.

## Translations

The interface is in English, German and French. Resort, piste, lift and hut names stay as they
are mapped, and the server's search-engine titles and descriptions stay English.

- `src/lib/i18n/en/` holds the English text, one file per screen or area; `en/index.ts` defines the
  `Messages` type that every translation (`de/`, `fr/`) must match key for key, so a missing
  or misspelt key fails `bun run check`.
- Components read `t` from `#lib/i18n/index.ts`: `{t.settings.title}`, `{t.settings.removeSaved(name)}`.
  Counts use `plural(n, { one: '# lift', other: '# lifts' })`; numbers, units, dates and country names go
  through the `format*` helpers there (`Intl` underneath, in the reader's own locale such as `de-CH`).
- The language is chosen in Settings or taken from the browser, loaded before the first render, and a
  change reloads the page. So `t` is never read at module level, only where text is shown.
- A new language: add its code to `LOCALES` and `LOCALE_NAMES` in `src/lib/i18n/intl.ts`, copy `de/` to
  the new code and translate, then add it to `TRANSLATIONS` in `src/lib/i18n/index.ts`.

## Useful URLs

- `/soelden?sim=40` replays a demo day at 40× speed for location, tracking and progress.
- `/soelden/now?queues=2026-11-17T11:30` counts queues on an archived Panomax frame.
- `/dev/queues` shows what the people counter sees in each camera crop. It is served by `vite dev`; a
  built preview needs `ENABLE_DEV_ROUTES=1` in `.dev.vars`.
