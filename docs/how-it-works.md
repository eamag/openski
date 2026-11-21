# How it works

## Screens

| Tab      | What it does                                                                                            |
| -------- | ------------------------------------------------------------------------------------------------------- |
| Map      | Pistes by difficulty, lifts, huts, webcams, search, 3D terrain, offline download; fade closed or ridden |
| Route    | Fastest way from A to B within limits for difficulty, drag lifts and flats                              |
| Track    | Records with the screen awake, imports GPX/TCX, exports GPX                                             |
| Progress | Share of the resort ridden, pistes and lifts ticked off, badges                                         |
| Now      | Conditions per piste and hour, queue counts with the webcam picture as proof                            |

Each resort also has an about page (`/<resort>/about`): piste km by colour, lifts by type, heights,
longest and steepest pistes, an aspect rose, and piste maps listed on skimap.org.

## Resort data

Everything the client needs for a resort is static: `static/data/<id>.json` (map and routing graph),
`<id>-terrain.json` (per-segment terrain), optional `<id>-webcams.json` and `<id>-queues.json`, plus the
catalogue `static/data/resorts.json`. The pipeline that builds them is described in [data](data.md).

## Offline

The service worker keeps the resort file and its terrain from the first visit. "Download for offline
use" also saves basemap tiles, glyphs, terrain tiles and the forecast. OpenFreeMap allows at most 3,000
tiles or 50 MB per download with 4 parallel requests and an app User-Agent, so large resorts stop at a
lower zoom, and basemap requests go through `/api/offline-tiles`, which only forwards OpenFreeMap tile,
TileJSON and glyph paths. A resort counts as saved only when every file arrived.

## Conditions

`src/lib/conditions/model.ts` scores each ~100 m piste segment 0–100 per hour from three parts: the snow
surface (a thaw/refreeze model driven by air temperature at that height and by the sun reaching the slope,
given its aspect, steepness and the terrain around it), the light (sun, shade, flat light, fog, low sun
ahead) and the wind (free-air wind scaled by exposure). The forecast comes from Open-Meteo through
`/api/weather/<resort>`, cached for an hour. The model does not know which pistes were groomed.

## Lift queues

People are counted in the browser with YOLO11n (ONNX Runtime Web, about 15 MB, cached after first use) on
hand-placed regions of resort webcams: `data/webcams/<resort>-queues.json` holds each region, usually a
lift's waiting area. Panomax panoramas load only the tiles covering a region; cameras without CORS headers
go through `/api/webcam`. Every count keeps its crop with a box per person and a link to the picture on
the provider's site. Counts are what the camera sees, so long queues are underestimates.

Signed-in mappers add a camera and draw its boxes at `/contribute/webcam`. A new camera counts from its
first save; boxes added to it later stay suggestions until the person who added the camera publishes
them. To add a Panomax camera to the files by hand, give it an entry in `data/webcams/<resort>-queues.json`
with no regions, run `bun scripts/suggest-queue-boxes.ts <resort> <camera> --date <busy day> --frames 14`,
place boxes where people wait on the preview it saves in `data/cache/queue-suggest/`, then check each one
with `--sanity <region> --at HH:MM`.

## Open and closed

`/api/status/<resort>` reads the resort's live status feed (Intermaps, Infosnow, Itinemap, Lumiplay,
Lumiplan, Open Data Hub, MtnPowder, Aspen, Ski amadé, SkiStar or Monterosa; `src/lib/status/feeds.ts`),
caches it for 5 minutes and credits the publisher. The client matches feed names to the map: lifts by
name, pistes by number. Anything the feed does not name stays "unknown" and is never faded.

## Ask an AI

The Now screen sends what it shows (numbers and ids only) to `POST /api/snapshot`. The server writes
Markdown with names from the resort file, keeps it a week and answers with a short link (`/s/<id>`) that
can be pasted into any assistant. Every piste and lift in it links back to the map.

## OpenStreetMap edits

Signed-in mappers fix lifts and pistes from a map card (`/<resort>/edit`) or answer one-tap questions
(`/<resort>/questions`) about missing details such as seats, piste colour, grooming or lighting. Both show
a review before uploading one changeset under the mapper's own account. Survey answers only fill tags
that are missing on the live ways (including alternates such as `piste:lit` for `lit`) and only touch
the ways the mapper reviewed: the request lists them in `surveyWayIds` and the server refuses it if
they differ. Before uploading, the server refetches every way and checks it is still a ski lift or piste.
On a piste that is also a road (`highway=*`), the name, number, lighting and one-way answers go in
`piste:name`, `piste:ref`, `piste:lit` and `piste:oneway` so the road's own tags stay untouched.
