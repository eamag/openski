# Data, provenance and licences

openski.org builds a static resort file for every ski area from open data, then keeps the live parts
(weather, open/closed status, webcam stills, queue counts, user contributions) at request time.
This document says where each piece comes from, how often it changes, and what you must credit.
The short version is in [NOTICE](../NOTICE).

The map is public by default: none of this data requires an account to view. An OpenStreetMap
account is needed only to contribute (queue regions, webcams, or map fixes under your own OSM
identity). See [the README](../README.md).

## Sources at a glance

| Data                          | Used for                                 | Source / endpoint                                                                                                                                                                               | Licence                                                  | Credit                                                     | Refresh                                                                   |
| ----------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------- |
| Ski areas, runs, lifts, POIs  | `static/data/resorts.json`, resort files | [OpenSkiData / OpenSkiMap](https://openskidata.org/) GeoJSON (`tiles.openskimap.org`)                                                                                                           | ODbL (derived from OpenStreetMap)                        | OpenSkiData / OpenSkiMap.org, © OpenStreetMap contributors | Rebuilt **daily**; automated download at most once/day (our cache: 24 h)  |
| Lift, piste and webcam tags   | Per-resort OSM query, editor, questions  | OpenStreetMap via Overpass mirrors (`overpass-api.de`, `.fr`, `kumi`, `private.coffee`)                                                                                                         | ODbL                                                     | © OpenStreetMap contributors                               | Fetched on demand when a resort is built                                  |
| Piste-map references          | `/<resort>/about` official map list      | [Skimap.org](https://skimap.org/)                                                                                                                                                               | Provider terms                                           | Skimap.org                                                 | Catalogue build reads the id; `/api/skimap/<id>` caches a page for a week |
| Places                        | Upstream OpenSkiData build               | [Who's On First](https://whosonfirst.org/)                                                                                                                                                      | CC BY and others, per source                             | Who's On First                                             | Upstream, daily                                                           |
| Elevation (3D terrain, slope) | Browser DEM tiles                        | [Mapterhorn](https://mapterhorn.com/) Terrarium WebP (`tiles.mapterhorn.com`)                                                                                                                   | Per-source open licences (e.g. CC BY 4.0, public domain) | © Mapterhorn + upstream source list                        | No schedule stated; source years on the attribution page                  |
| Elevation (offline grids)     | `data/dem/<resort>/local.*`, `wide.*`    | Mapterhorn, with Tilezen/Joerd Terrarium tiles on AWS as fallback                                                                                                                               | As above / Tilezen attribution                           | © Mapterhorn; Joerd/Tilezen for fallback                   | On `data:fetch`                                                           |
| Basemap                       | MapLibre vector tiles and glyphs         | [OpenFreeMap](https://openfreemap.org/) `planet`                                                                                                                                                | Open data (OSM / OpenMapTiles)                           | © OpenStreetMap contributors, via map attribution control  | Provider-managed weekly builds                                            |
| Weather                       | Hour-by-hour conditions                  | [Open-Meteo](https://open-meteo.com/) Forecast API                                                                                                                                              | CC BY 4.0                                                | Open-Meteo (credit must be visible)                        | Cached 1 hour at the edge; stale copy on upstream errors                  |
| Open/closed                   | Route and Now screens                    | Resort feeds (Intermaps, Infosnow, Itinemap, Lumiplay, Lumiplan, Ski amadé, SkiStar, MtnPowder, Aspen, Monterosa) and [Open Data Hub](https://tourism.api.opendatahub.com/) (Dolomiti Superski) | Feed terms                                               | Resort / feed operator                                     | Cached 5 minutes, refreshed in the app                                    |
| Webcam pictures               | Queue proof, camera cards                | Panomax, foto-webcam.eu, Feratel, Roundshot, Skaping, Tirol, webcamhd, direct resort cameras                                                                                                    | Provider terms                                           | Provider link on every card                                | Live; Panomax keeps full-size archive frames                              |
| People detector               | Queue counts on device                   | Ultralytics YOLO11n → ONNX (see below)                                                                                                                                                          | AGPL-3.0 (model), MIT (ONNX Runtime Web)                 | Ultralytics YOLO11                                         | Static file, versioned in git                                             |

## What ships in the repository

- `static/data/<id>.json`, `<id>-terrain.json` and the optional `<id>-webcams.json` and
  `<id>-queues.json`, plus the `static/data/resorts.json` catalogue. These are generated artifacts derived from ODbL data, so
  keep the in-map attribution control and the credits in [NOTICE](../NOTICE) when you redistribute
  them. Modified ODbL data must be shared alike.
- A committed sample of build inputs for Sölden (`data/soelden-membership.json`,
  `data/raw/soelden-osm.json`, `data/dem/soelden/`, `data/raw/dem-tiles/`). Other resorts'
  inputs and caches are ignored by git.
- `static/models/yolo11n.onnx`, the people detector (see below).
- `data/webcams/<resort>.json` (cameras near each resort, from OpenStreetMap) and
  `data/webcams/<resort>-queues.json` (hand-placed queue boxes). Webcam pictures are never committed.

## Rebuild cadence and commands

The catalogue respects OpenSkiData's once-per-day rule: `scripts/build-catalog.ts` reuses the
GeoJSON cache while it is younger than 24 hours. Do not run it more often against upstream.

```sh
bun run data:catalog                # rebuild the catalogue from the daily OpenSkiData dump
bun run data:fetch [resort]         # fetch OSM data and elevation grids (default: soelden)
bun run data [resort]               # build resort, terrain and queue files (default: soelden)
```

Individual steps for any catalogue slug:

```sh
bun scripts/fetch-osm.ts <resort>
bun scripts/fetch-dem.ts <resort>
bun scripts/build-resort.ts <resort>
bun scripts/build-terrain.ts <resort>
bun scripts/build-queues.ts <resort>   # only where webcam queue boxes exist
```

Run `build-resort` and `build-terrain` together: the terrain file is tied to the resort file's
build version, and the conditions forecast stays empty when they do not match. Queue-box
suggestions are a separate, human-reviewed step (`scripts/suggest-queue-boxes.ts`), documented in
[how it works](how-it-works.md).

Maintenance commands:

- `bun scripts/build-all.ts --ids soelden,hauser-kaibling` fetches and builds resort and terrain data for
  the selected slugs. It skips resorts with matching map and terrain files unless you pass
  `--force`. `data/build-log.jsonl` records past attempts.
- `bun scripts/build-osm-webcams.ts` regenerates the resort webcam lists. Pass `--refresh` to refetch the
  OSM webcam catalogue.
- `bun scripts/catalog-files.ts` updates catalogue availability and camera counts from the files on disk.
- `bun scripts/export-webcams.ts <resort>` exports contributed cameras and confirmed queue boxes
  from local D1. Use `--remote` for the test site or `--production` for the live database.

Use `bun run data soelden --force` to rebuild from the committed sample. Fetches for other
resorts use the membership cache prepared by `bun run data:catalog`.

The running map uses the generated files from its deployment. Rebuild and redeploy a resort to
show recent OpenStreetMap changes on its map.

Build artifacts and per-resort inputs under `data/cache/`, `data/dem/*` (except Sölden) and
`data/raw/*` (except the Sölden sample) are gitignored, so a clean clone contains only the
generated static files and the committed sample inputs.

## People-detection model: source, version and export

The browser and `scripts/suggest-queue-boxes.ts` both load `static/models/yolo11n.onnx`.

- **Source:** Ultralytics YOLO11n, COCO-pretrained `yolo11n.pt` (Glenn Jocher, Jing Qiu, 2024;
  YOLO11 11.0.0; published as a v8.3.0 release asset). Code and trained models are **AGPL-3.0**.
- **Export** with the Ultralytics CLI:

  ```sh
  yolo export model=yolo11n.pt format=onnx imgsz=640 opset=17 \
    simplify=True dynamic=False nms=False
  ```

  float32; input `[1, 3, 640, 640]` RGB normalised 0–1; output `[1, 84, 8400]` (row 4 = person).
  The exported file is 10,741,397 bytes with SHA-256
  `0f200dfa94e6fb66d8adbeee1626eac067c866d1b7ce3ed132999235589b697a`.

- **Runtime:** `onnxruntime-web` WASM from npm (MIT). The detector slices 640×640 windows with
  20 % overlap, uses a 2 px blur for pixelated cameras, and applies its own decode/NMS.
- **Why AGPL-3.0-only for the app:** the shipped ONNX is derived from AGPL-3.0 weights. The
  repository is licensed under AGPL-3.0-only for its own source ([LICENSE](../LICENSE)) so the app
  and model terms align — see [NOTICE](../NOTICE).

To replace the model, export it again from the source weights, check that the input and output
shapes match the ones above and that queue counts stay the same, then replace
`static/models/yolo11n.onnx`.

## Licence boundaries

- **App source:** AGPL-3.0-only — [LICENSE](../LICENSE).
- **ODbL data:** OpenSkiData/OpenStreetMap-derived resort data — share alike, attribute.
- **CC BY 4.0 data:** Open-Meteo weather, parts of Mapterhorn's elevation sources — attribute.
- **Provider terms:** webcam pictures, official piste-map images and live status feeds — link back,
  no bulk redistribution.
- **AGPL-3.0 model:** YOLO11n ONNX; ONNX Runtime Web itself is MIT.

Attribution must stay visible in the running app (map attribution control credits OpenStreetMap and
OpenSkiMap; the Now screen credits Open-Meteo as "Weather data by Open-Meteo.com"), plus the
NOTICE file in any redistribution.
