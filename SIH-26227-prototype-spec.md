# SIH 26227 — Prototype build spec: searchable satellite archive with change analysis

Everything to build before the grand finale — the pipeline, the models, every screen of the interface, the offline packaging, and the evaluation report the brief explicitly asks you to hand in.

Problem statement  
SIH 26227

Organisation  
MoD · Indian Army (DGIS)

Category  
Software · Space Technology

Hard constraint  
Runs with network off

## 1. Read the brief like a scorer

The statement is unusually precise. It names six capabilities, and evaluation happens against *held-out* queries and *held-out* labelled change cases you will never see beforehand. So the prototype is not judged on how pretty the demo AOI looks — it is judged on whether the system generalises and whether you can prove it with numbers.

| Brief              | What it actually demands                                                                                  | How it gets tested                                                 |
|--------------------|-----------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------|
| 2.2.1 Retrieval    | Free-text search over tiles, plus image-to-image, plus metadata filters, ranked                           | Held-out queries with relevance judgements → Recall@k, mAP, nDCG   |
| 2.2.2 Change       | Appearance / disappearance / expansion / contraction, typed, plus earliest supporting observation         | Held-out change and no-change cases                                |
| 2.2.3 False alarms | Season, cloud, haze, snow, shadow, view angle, radiometry, misregistration treated as confounders         | The no-change cases. Precision is explicitly preferred over recall |
| 2.2.4 Discovery    | Unsupervised grouping so one found site leads to others                                                   | Live demo, likely judged qualitatively                             |
| 2.2.5 Workflow     | Review queue, before/after evidence, accept/reject persisted, feedback reranking, provenance on export    | Live demo + exported artefacts inspected                           |
| 2.2.6 Scale        | Vector index, incremental ingest without rebuild, fully on-prem, GeoTIFF/COG in, georeferencing preserved | They will ask you to add a scene live, and to pull the cable       |
**The sentence that decides your score.** "Favour analytically useful precision over indiscriminate change recall." A system that reports 40 changes of which 34 are real beats one that reports 400 of which 90 are real. Build the suppression stack before you build anything clever, and make the suppression *visible* in the UI — judges cannot credit work they cannot see.
Note also the submission list at the end of the brief: source code, an architecture note, the index-build and incremental-ingestion procedure, model and dataset provenance, and a reproducible evaluation report stating indexed area, scene/tile count, build time, storage footprint, query latency and hardware. Treat those six items as features of the product, not as paperwork to write the night before.

## 2. Architecture

One ingestion pipeline feeds two query paths — semantic retrieval and temporal change — over a shared tile store and a shared embedding space. Sharing the embedding space is what lets a single found site expand into a cluster of similar sites, which is capability 2.2.4 almost for free.

```
INGEST (per scene, incremental)
  GeoTIFF / COG  →  validate + read metadata (CRS, datetime, sensor, bands)
                 →  cloud / shadow / snow mask  (SCL band or s2cloudless)
                 →  radiometric normalisation to a reference scene (IR-MAD)
                 →  co-registration to the AOI reference grid (phase correlation)
                 →  tile to 256 px, stride 128, fixed GSD, keep footprint polygon
                 →  write COG + overviews + thumbnail to object store
                 →  embed each tile  (RemoteCLIP  +  DINOv2)
                 →  upsert vectors + payload into index   [no rebuild]
                 →  append STAC item + provenance record
                 →  enqueue change scoring for tiles whose cell has priors

QUERY A — SEMANTIC                    QUERY B — CHANGE
  text / image / hybrid                 AOI + time window + types
  → encode query                        → pull tile time-series per cell
  → filter: AOI, dates, sensor,         → pairwise + sequential scoring
    cloud %, product level              → candidate mask → polygonise
  → ANN search (HNSW)                   → suppression gauntlet (§5.4)
  → rerank with analyst feedback        → type classifier (§5.3)
  → ranked tiles + score map            → earliest-observation search (§5.5)
                                        → ranked review queue

SHARED: embedding space → HDBSCAN clusters → "more sites like this"
```

### Services

- **api** — FastAPI. Search, change jobs, review decisions, export, admin.
- **worker** — Celery or RQ. Ingestion and change jobs; streams progress over SSE so the UI can show a live stage log.
- **db** — PostgreSQL + PostGIS. Catalogue, tile footprints, candidates, decisions, audit log.
- **vectors** — pgvector in the same Postgres for simplicity, or Qdrant if you cross a few million tiles.
- **tiler** — TiTiler or rio-tiler serving map tiles straight from your COGs, so the browser never needs the raw scene.
- **basemap** — a local MBTiles/PMTiles file served by the API. Non-negotiable; see §10.
- **web** — React app, built to static files, served by the API container.

## 3. Stack

| Layer                | Pick                                                                       | Why this one                                                                                           |
|----------------------|----------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------|
| Raster I/O           | rasterio, GDAL, rio-tiler                                                  | COG-native, windowed reads, no full-scene loads                                                        |
| Text↔image           | RemoteCLIP ViT-L/14                                                        | CLIP fine-tuned on remote sensing; generic CLIP is noticeably worse on overhead imagery                |
| Visual similarity    | DINOv2 ViT-B/14                                                            | Stronger pure-visual neighbours and better clusters than CLIP embeddings                               |
| Optional EO backbone | Prithvi-EO-2.0 or Clay v1                                                  | Multispectral-native; use if you want more than RGB. Adds weight — only if time allows                 |
| Change model         | TinyCD or BIT (bitemporal transformer)                                     | Small, fast, pretrained checkpoints on LEVIR-CD; TinyCD runs on modest GPUs                            |
| Registration         | AROSICS, or OpenCV phase correlation                                       | Sub-pixel shift estimate you can also report as a confidence input                                     |
| Normalisation        | IR-MAD (iteratively reweighted MAD)                                        | The standard relative radiometric normalisation for change detection; cite it in the architecture note |
| Clustering           | HDBSCAN + UMAP                                                             | No k to guess; UMAP gives you the 2-D scatter the discovery screen needs                               |
| Index                | pgvector HNSW (m=16, ef_construction=200)                                  | Supports inserts, sits beside PostGIS filters in one query. FAISS IVF-PQ only past ~5M vectors         |
| Catalogue            | pystac, local STAC JSON                                                    | Provenance for free, in a standard format judges recognise                                             |
| Frontend             | React + TypeScript, Vite, MapLibre GL, deck.gl, TanStack Query/Table, visx | MapLibre works fully offline with local tiles; deck.gl handles tens of thousands of footprints         |
| Packaging            | Docker Compose, one `make demo`                                            | Reproducibility is a graded deliverable                                                                |
**Two embeddings, one index.** Store both vectors per tile in separate columns. Text search hits the RemoteCLIP column; "find similar" and clustering hit the DINOv2 column; change screening uses cosine distance in the DINOv2 space, which is more sensitive to structural change and less to caption-level semantics.

## 4. Data plan

Everything must be public or organiser-supplied. Sentinel-2 L2A is your workhorse because the Scene Classification Layer gives you cloud, shadow and snow masks without running a separate model. Sentinel-1 GRD is your cloud-independent second opinion. Landsat Collection 2 extends history back further when you need the earliest observation. Bhuvan/NRSC gives you Indian coverage and a line in the presentation the judges will like.

### Demo AOIs — pick three, with different change signatures

- **Large earthworks / construction:** Navi Mumbai International Airport site, 2017→2024. Enormous, unambiguous, visible at 10 m.
- **Linear development:** a stretch of a recent expressway corridor — tests road-development typing and elongated-feature handling.
- **Water extent:** a reservoir across monsoon and pre-monsoon — this is your season trap, and the one you use on stage to show suppression working.

Add a fourth AOI you never tune on and hold it back for your own internal evaluation. If your numbers only hold on AOIs you tuned, the held-out evaluation will find out.

### Labelled sets for training and validation

- **OSCD** (Onera Satellite Change Detection) — Sentinel-2 pairs, urban change. Same sensor as your demo, so the most transferable.
- **LEVIR-CD / WHU-CD / S2Looking** — high-resolution building change; good for pretraining the Siamese head, but beware the resolution gap.
- **ESA WorldCover** — land-cover labels you use to derive change *types* by before/after class transition.
- **Your own no-change set** — the most valuable thing you can build. Sample hundreds of tile pairs across seasons, cloud fractions and view angles where nothing happened. This is your false-alarm regression suite.
**Build a retrieval ground truth too.** Write 40–60 natural-language queries over your AOIs and label the top candidates yourself. Without it you cannot report Recall@k, and the evaluation report is a listed deliverable. Two people, one evening.

## 5. The ML core

### 5.1 Tiling and embedding

Fixed ground sample distance, not fixed pixel size across sensors — resample everything to a common GSD (10 m for S2) before tiling, or your embeddings will encode resolution rather than content. Tile at 256 px with stride 128 so a feature straddling a boundary still lands whole in some tile. Store for every tile: footprint polygon in EPSG:4326, native CRS, acquisition datetime, sensor, product level, valid-pixel fraction, cloud fraction, and the parent scene ID.

### 5.2 Retrieval

- **Text:** encode the query with RemoteCLIP's text tower, ANN search over tile vectors, apply PostGIS and metadata filters. Prefer *pre-filtering* (filter then search) when the AOI is small, *post-filtering* when it is large — pgvector with a partial index handles this; measure both.
- **Image:** accept an uploaded chip or a selected tile, encode with DINOv2, search. Same filter path.
- **Hybrid:** weighted sum of the two similarities with a slider in the UI. Cheap, and it demos well.
- **Query expansion:** the brief's own examples are compound — "newly built structures near a river" is semantics *plus* a change condition *plus* a spatial relation. Handle it: detect temporal words ("new", "recent") and route to a change-constrained search; detect proximity words ("near a river") and intersect results with a local water mask derived from NDWI. Demonstrating exactly the brief's example queries working end to end is worth more than any generic improvement.
- **Relevance feedback:** when an analyst marks results good or bad, update the query vector with Rocchio (`q' = αq + β·mean(good) − γ·mean(bad)`) and re-search instantly. No training, visible effect, directly satisfies "use feedback for subsequent reranking".

### 5.3 Change detection

Two stages. Screening is cheap and runs everywhere; confirmation is expensive and runs only on survivors.

1.  **Screen:** cosine distance between co-located tile embeddings at t1 and t2. Fast, sensor-agnostic, reuses the index. Keep the top few percent.
2.  **Confirm:** run the Siamese change model (TinyCD/BIT) on the surviving pairs to get a pixel-level mask, then polygonise with a minimum-area threshold tied to your GSD — below roughly 3×3 pixels you are reporting noise.
3.  **Type:** classify by land-cover transition rather than by another black box. Segment before and after into coarse classes (built, bare, vegetation, water, road), then read the transition table: vegetation or bare → built is *construction*; built or vegetation → bare is *clearance*; water class area delta is *water-extent variation*; elongated high-aspect-ratio new bare/built polygons are *road development*. Expansion versus appearance falls out of whether the new polygon touches an existing same-class polygon; contraction and disappearance are the mirror cases.

That transition table is explainable, debuggable, and you can show it in the UI as the reason for the label — far stronger with judges than "the model said construction".

### 5.4 The suppression gauntlet

Run every candidate through these in order, and record which gate killed it. The counts per gate become the funnel chart in the UI.

| Gate            | Mechanism                                                                                                                                                                                                                              |
|-----------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Validity        | Reject if either date's tile has cloud, cirrus, shadow or snow over the candidate polygon, per the SCL mask. Require a minimum valid-pixel fraction on both dates.                                                                     |
| Radiometry      | IR-MAD normalise t2 to t1 before differencing. Flag candidates whose signal disappears after normalisation.                                                                                                                            |
| Registration    | Estimate sub-pixel shift by phase correlation. Reject changes narrower than ~1.5× the residual shift — misregistration produces thin edge-parallel slivers, and this single rule removes most of them.                                 |
| Season          | Compare like with like. Either restrict pairs to the same phenological window (±30 days of day-of-year), or fit a per-cell harmonic model to the NDVI/NDWI time series and flag only deviations beyond the expected seasonal envelope. |
| Persistence     | Require the change to still be present in at least two later usable acquisitions. This is the highest-value gate you will write: real construction persists, clouds and shadows do not.                                                |
| Cross-sensor    | Check Sentinel-1 backscatter over the same polygon. New hard structures raise VV/VH backscatter; agreement raises confidence, disagreement lowers it. Cloud-independent, and a genuine differentiator.                                 |
| Geometry sanity | Minimum area, maximum fragmentation, reject polygons hugging scene edges or nodata boundaries.                                                                                                                                         |

Combine the survivors' signals into a single calibrated confidence — a small logistic regression over \[model score, valid fraction, registration residual, seasonal z-score, persistence count, SAR agreement, area\] fitted on your own labelled set. Calibrated, inspectable, and it gives you the per-factor bar chart on the evidence page.

### 5.5 Earliest supported observation

The brief asks for the earliest acquisition at which the change is supported by *usable* imagery — which is a change-point problem constrained by data availability, not a simple first-crossing.

- Build the full time series of change score for the cell against a stable pre-change reference.
- Mark every acquisition usable or unusable from the quality masks.
- Run CUSUM or a simplified BFAST-style break detection over usable observations only.
- Report an **interval**, not a date: last clear observation without the change → first clear observation with it. State the revisit gap. If a two-week cloud run sits in the middle, say so.
**Say the quiet part in the UI.** Rendering the answer as a bar spanning the uncertainty interval, with cloudy dates greyed out, tells a domain judge that you understand revisit cadence. A single confident date tells them you do not.
### 5.6 Discovery and clustering

Reduce DINOv2 embeddings with UMAP, cluster with HDBSCAN, cache cluster IDs on each tile. Then "find more sites like this" is two operations: nearest neighbours of the seed tile, plus every member of the seed's cluster, merged and ranked. Let analysts name a cluster ("quarry", "vehicle park", "under construction") and save it as a reusable site type — naming turns an unsupervised artefact into an operational concept, and it makes the demo land.

## 6. The interface, screen by screen

Nine screens. Everything sits inside one shell: a slim left rail for navigation, and a top bar holding the **global filter context** — area of interest, date range, sensors, maximum cloud — which persists as you move between search, change and discovery. That persistence is the single biggest usability idea in this tool; without it, analysts retype the same AOI on every screen.

```
+------------------------------------------------------------------+
| AOI: Sector-7 v | 2019-01 -> 2024-12 v | S2 S1 L8 v | cloud <=20%|
|            offline, 0 blocked calls | 412k tiles | 1.8 TB        |
+-----+------------------------------------------------------------+
| Srch|                                                            |
| Chng|                      screen content                        |
| Disc|                                                            |
| Rvw |                                                            |
| Data|                                                            |
+-----+------------------------------------------------------------+
```

**Keep the offline badge visible on every screen.** A green pill reading "offline — no external calls" with a live counter of outbound requests blocked. It is the constraint the brief cares most about, and it should be impossible to miss.
### 1 · Search

Find imagery by meaning, not by coordinates.

```
+------------------------+------------------------+-------------------+
| query                  | map                    | results           |
+------------------------+------------------------+-------------------+
| (o)text (o)img (*)both |                        | 0.91  2023-04  [.]|
| .--------------------. |  footprints shaded     | 0.88  2022-11  [.]|
| | newly built        | |  by relevance          | 0.84  2023-04  [.]|
| | structures near a  | |                        | 0.79  2021-08  [.]|
| | river              | |  [draw AOI]            | 0.77  2023-01  [.]|
| '--------------------' |  [upload GeoJSON]      |                   |
| image chip: [thumb]    |                        | sort: relevance v |
| text ===O=== image     |                        | [ load more ]     |
| > saved queries        |                        |                   |
+------------------------+------------------------+-------------------+
```

#### Must have

- Query box with three modes — text, image, both — and a blend slider when both are on.
- Drop an image, or press "similar to this" on any result to make it the new query.
- AOI by drawing a box or polygon, by uploading GeoJSON, or by picking from a local gazetteer of place names. No online geocoder.
- Ranked result grid: thumbnail, score bar, date, sensor, cloud percentage. Hovering a card highlights its footprint on the map and vice versa.
- Result detail drawer: full-resolution view, all metadata, the parent scene, buttons for "similar tiles", "change history here", "add to queue".

#### The two that win marks

- **Why this matched.** A saliency overlay on the tile plus the nearest concept terms in the embedding space. Turns a black box into something an analyst can trust or dispute.
- **Thumbs up/down on results,** feeding the Rocchio update. Show the ranking visibly reshuffle. This is capability 2.2.5's feedback requirement, demonstrated in three seconds.
### 2 · Change analysis

What changed here, between when and when, and can I believe it.

```
+-----------------------+------------------------------------------+
| setup                 | compare                                  |
+-----------------------+------------------------------------------+
| dates ( )pair (*)range|  before <| swipe |> after   [blink]      |
| types [x] construction|  .----------------------------------.    |
|       [x] clearance   |  |                                  |    |
|       [x] water       |  |  change polygons, coloured by type|   |
|       [x] roads       |  |                                  |    |
|                       |  '----------------------------------'    |
| sensitivity           |  2019 |.:|.|:.|.::|. 2024  usable dates  |
| precision ==O== recall|+-----------------------------------------|
|                       | suppression funnel                       |
| [ run analysis ]      |   10,412  screened                       |
|                       |    1,203  passed quality                 |
| stage log:            |      340  persisted across later dates   |
|  done  masked         |       96  reported                       |
|  done  aligned        |  > why were 244 dropped?                 |
|  ..    scoring 62%    |                                          |
+-----------------------+------------------------------------------+
```

#### Must have

- Either a specific date pair or a whole window; if a window, the system picks the best usable pairs itself and says which it used.
- Change-type filters and a **precision↔recall sensitivity slider** that visibly moves the operating threshold. Exposing the brief's own trade-off as a control is a strong signal you read it.
- Comparison tools: swipe curtain, blink toggle, opacity fade, synchronised side-by-side pan and zoom.
- A timeline strip of every acquisition in the window, each tick coloured by usability — clear, partly cloudy, unusable, missing. Click a tick to load that date.
- Live stage log during the run: masking, normalising, aligning, scoring, suppressing. Long jobs without progress feel broken.

#### The one that wins marks

The **suppression funnel**, with every stage clickable to inspect what was dropped and why. It is the only way to prove precision work exists. Make "why were these dropped" open a gallery of rejected candidates tagged cloud, shadow, seasonal, misregistration.
### 3 · Site timeline

Everything that ever happened at one polygon.

- A filmstrip of thumbnails, one per acquisition, unusable dates dimmed.
- Charts stacked on a shared time axis: change score, NDVI, NDWI, Sentinel-1 backscatter. Shade the expected seasonal envelope so deviations read at a glance.
- The detected change point marked, with the earliest-supported-observation interval drawn as a bar rather than a line.
- Scrubbing the time axis drives the map. This is the single most cinematic thing in the whole build — a five-second scrub through seven years of an airport being built sells the project better than any slide.
### 4 · Discovery

I found one. Find me the rest.

```
+----------------------------+-------------------------------------+
| embedding space (UMAP)     | where they are                      |
+----------------------------+-------------------------------------+
|      .:.   ooo             |                                     |
|   xxx     ooooo    ###     |   map with the selected cluster     |
|  xxxxx     ooo   #####     |   lit in the same colour            |
|     xx       .   ###       |                                     |
|  < lasso to select >       |                                     |
+----------------------------+-------------------------------------+
| cluster 7 | 214 tiles | name: [ quarry        ] [ save ]         |
| [.] [.] [.] [.] [.] [.] [.] [.]   representative tiles           |
+------------------------------------------------------------------+
```

- UMAP scatter on the left, map on the right, **linked brushing** — lasso in the scatter lights up the map, select on the map highlights the scatter. Cheap to build with deck.gl, and it looks like serious analysis software.
- Cluster cards: representative thumbnails, member count, an editable name, and a "save as site type" action that makes the cluster a reusable filter elsewhere.
- "Find more like this" from any seed tile, merging nearest neighbours with cluster membership.
### 5 · Review queue

Work through candidates fast, and leave a record.

- Rows carrying a before/after thumbnail pair, location, dates, type, confidence, quality flags, status and assignee. Sort by confidence, filter by type or status.
- **Keyboard-first triage:** `J`/`K` to move, `A` accept, `R` reject, `S` skip, number keys for reject reasons. Analysts judge tools by how fast they can clear a queue; a visible shortcut legend costs an hour and reads as domain literacy.
- Reject reason codes — cloud, shadow, seasonal, misregistration, not of interest, duplicate — because these feed the reranker and become your own false-alarm dataset.
- Bulk accept/reject with confirmation, and assignment to a named analyst.
- A small counter showing how many decisions have fed back into ranking so far.
### 6 · Evidence page

Everything a decision needs, on one page.

- Large before/after with the change mask toggleable, plus the raw pair with no overlay.
- Metadata table: coordinates, area, both acquisition times, both sensors, product levels, cloud fractions, registration residual.
- **Confidence breakdown** as a horizontal bar chart — model score, persistence, SAR agreement, seasonal deviation, registration quality — so a rejection can be argued with.
- **Provenance tree**: source scene IDs → each processing step with its parameters → model names, versions and weight checksums. Render it as an actual tree; it is deliverable 2.2.5 made visible.
- Nearby and similar candidates, plus the full decision history with who, when and why.
### 7 · Data manager

Prove ingestion is incremental, and that provenance is real.

- Drag-and-drop or a watched folder. A job table with per-scene status, tiles produced, embed time, index insert time.
- Scene inventory with footprints on a map, cloud percentage, sensor, date, storage size.
- **Index statistics:** vector count, index size on disk, last build time, last incremental insert time, mean and p95 query latency. These are literally the numbers the evaluation report must contain — read them from the running system instead of measuring them by hand later.
- **Model registry:** every model with version, licence, source URL and SHA-256 of the weights. This satisfies "declare origin and licence" and takes an afternoon.
**The demo moment lives here.** Drop a new scene into the watch folder on stage. Watch the job run, the tile count increase, and then run a search that returns tiles from that scene — without any rebuild. That is capability 2.2.6 proven in forty seconds.
### 8 · Evaluation

Your evaluation report, as a screen.

- Retrieval panel: Recall@1/5/10, mAP, nDCG over your held-out query set, with a per-query table so failures are inspectable.
- Change panel: precision, recall, F1, a confusion matrix over change types, and a precision–recall curve with the current operating point marked. Move the sensitivity slider and watch the point move.
- Performance panel: index build time, storage footprint, query latency percentiles, tiles-per-second ingest rate, and the hardware it ran on.
- An **export report** button producing the reproducible evaluation document as Markdown and PDF, with the run's git commit, model checksums and configuration embedded.

Almost no team will have this screen. It converts a graded deliverable into a live feature, and it means you can answer "what are your numbers" instantly instead of hunting through a notebook.
### 9 · Export and audit

Get results out with their history intact.

- Select candidates → export GeoJSON, GeoPackage, KML, CSV, or STAC items, plus a formatted PDF brief with before/after plates.
- Every exported feature carries source scene IDs, processing chain, model versions, confidence and the analyst decision. Show a preview of the attributes before writing the file.
- Append-only audit log: actor, action, target, timestamp, model version, and a hash chained to the previous entry. Filterable and exportable.

## 7. Visual design of the tool

Build a dark, map-first interface — imagery is the content, and chrome should recede so that false colour and change overlays read correctly. A few rules that will keep it looking deliberate:

- One accent colour for interactive elements. Reserve saturated colour entirely for data: change types, confidence, cluster identity.
- Change-type palette must be colourblind-safe and consistent everywhere — construction, clearance, water, roads keep the same colour on the map, the funnel, the confusion matrix and the export legend.
- Monospace for coordinates, scene IDs, checksums and timings only. It aids scanning of fixed-width data; everywhere else it is costume.
- Density over whitespace. This is an analyst tool, not a landing page. Aim for tables that show fifteen rows, not five.
- Every long-running action needs a determinate progress state with a stage name. Every empty state needs an action, not an apology.
- Keyboard focus visible throughout, and a `?` shortcut overlay listing the triage keys.

## 8. API surface

```
POST   /api/search                  {text?, image?, blend, aoi, t0, t1,
                                     sensors[], max_cloud, k, cursor}
POST   /api/search/feedback         {query_id, tile_id, label}
GET    /api/tiles/{id}
GET    /api/tiles/{id}/similar      ?k=&space=dino|clip
GET    /api/tiles/{id}/timeseries

POST   /api/change/jobs             {aoi, t0, t1, types[], sensitivity}
GET    /api/change/jobs/{id}        → status, stage, funnel counts
GET    /api/change/jobs/{id}/events → SSE stage log
GET    /api/candidates              ?job=&status=&type=&min_conf=
GET    /api/candidates/{id}         → evidence, confidence breakdown, provenance
GET    /api/candidates/{id}/earliest→ {interval_start, interval_end, gap_days}
POST   /api/candidates/{id}/decision{verdict, reason_code, note}

GET    /api/clusters                ?aoi=
GET    /api/clusters/{id}
POST   /api/clusters/{id}/name      {name}

POST   /api/ingest                  multipart | {watch_path}
GET    /api/ingest/jobs
GET    /api/admin/index/stats       → vectors, bytes, build_ms, p50, p95
GET    /api/admin/models            → name, version, licence, sha256, source

POST   /api/export                  {candidate_ids[], format}
GET    /api/audit                   ?actor=&from=&to=
GET    /api/eval/retrieval | /api/eval/change | /api/eval/report
```

## 9. Data model

```
scene(id, sensor, product_level, datetime, crs, footprint GEOGRAPHY,
      cloud_pct, path, checksum, licence, ingested_at)

tile(id, scene_id → scene, grid_cell_id, footprint GEOGRAPHY, crs,
     gsd_m, valid_frac, cloud_frac, thumb_path, cog_window,
     emb_clip VECTOR(768), emb_dino VECTOR(768), cluster_id)
     -- HNSW index on each vector column; GiST on footprint

grid_cell(id, geom GEOGRAPHY)          -- stable cells so tiles across
                                       -- dates are co-located and comparable

change_candidate(id, grid_cell_id, tile_a → tile, tile_b → tile,
     geom GEOGRAPHY, area_m2, change_type, direction,
     score, confidence, factors JSONB, suppressed_by,
     earliest_start, earliest_end, revisit_gap_days, job_id)

decision(id, candidate_id, actor, verdict, reason_code, note, created_at)

audit(id, actor, action, target_type, target_id, payload JSONB,
      model_versions JSONB, created_at, prev_hash, hash)

model(name, version, task, licence, source_url, sha256, path)
```

The `grid_cell` table is the quiet keystone. Tiles from different dates and different sensors must land on the same cell to be comparable at all; define the grid once in a fixed projection and snap everything to it during ingestion.

## 10. Offline packaging

The brief says the demonstration runs with network access disabled after staging. Assume they will ask you to disconnect. Prepare so you can do it happily.

- **Offline basemap.** The most common silent failure. Leaflet and Mapbox defaults fetch tiles from the internet; with the cable pulled, your map goes blank in front of judges. Ship a local MBTiles or PMTiles basemap for your AOIs and point MapLibre at your own server.
- **Fonts and icons** bundled, not fetched from a CDN. Same failure mode, less visible.
- **All weights local**, with `HF_HUB_OFFLINE=1`, `TRANSFORMERS_OFFLINE=1` and `no_proxy` set. Torch hub and timm will both try to phone home otherwise.
- **MODELS.md** listing every model with origin, licence, version and weight checksum — the brief asks for exactly this.
- **Egress test in CI:** run the full pipeline in a container with networking disabled. If it passes there, it passes on stage.
- **Block and count outbound attempts** at the app layer and surface the count in the offline badge. Zero, displayed live, is a better answer than a verbal assurance.
- **One command** to bring the whole thing up from a cold machine, and a rehearsed cold start on the actual demo laptop.

## 11. Evaluation harness

Write this in week two, not week six. It is what stops you from tuning blind.

```
eval/
  queries.jsonl        # text query + relevant tile ids
  change_pairs.jsonl   # cell, t1, t2, label, type, mask path
  nochange_pairs.jsonl # the precision suite — season, cloud, shadow, angle
  run_eval.py          # writes metrics.json + report.md + plots
```

- **Retrieval:** Recall@1/5/10, mAP, nDCG@10.
- **Change:** precision, recall, F1 at your chosen operating point, plus IoU of masks where you have them, plus a confusion matrix over types. Report precision prominently — the brief asked for it.
- **False alarm rate** on the no-change suite, broken down by confounder. "Seasonal false-alarm rate fell from 31% to 4% after harmonic modelling" is the most persuasive sentence you can put in your report.
- **Earliest-date accuracy:** how often the true change date falls inside your reported interval, and the mean interval width.
- **Systems:** ingest rate in tiles/sec, index build time, incremental insert time, storage per 1000 tiles, query latency p50/p95, and the hardware.

Run it on every commit that touches the pipeline and keep the history. A plot of precision improving over six weeks is a slide that makes itself.

## 12. What to build first

| Priority                               | Item                                                                                |
|----------------------------------------|-------------------------------------------------------------------------------------|
| must     | Ingest GeoTIFF/COG → mask → normalise → align → tile → embed → index, incrementally |
| must     | Text and image search with AOI, date and sensor filters, ranked, on a map           |
| must     | Bi-temporal change with the full suppression gauntlet and calibrated confidence     |
| must     | Review queue with accept/reject, reasons, and an audit trail                        |
| must     | Export with provenance; evaluation harness and report                               |
| must     | Fully offline run, one command, model registry with licences                        |
| should | Change typing by land-cover transition; earliest-observation interval               |
| should | Clustering, UMAP scatter with linked brushing, "more like this"                     |
| should | Relevance feedback reranking; suppression funnel UI; site timeline scrubber         |
| should | Sentinel-1 corroboration                                                            |
| could   | Saliency "why this matched"; compound query parsing ("near a river")                |
| could   | Multi-user assignment; multispectral backbone; ONNX/TensorRT speedups               |
| could   | Learned reranker beyond logistic regression                                         |

Cut from the bottom without hesitation. A complete narrow system beats an incomplete broad one, because the evaluation walks the whole path from ingest to export.

## 13. Six-week plan

Assuming six people: two on the pipeline and models, one on change detection specifically, two on frontend, one on infrastructure, evaluation and the written deliverables. That last role is not a spare person — it is the one who makes the deliverables exist.

| Week | Target                                                                                                                                                                                                      |
|------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1    | Scenes downloaded and staged. Tiling and metadata working. Postgres/PostGIS/pgvector up. Frontend shell with map and global filters. Search over random vectors end to end, so the contract is fixed early. |
| 2    | RemoteCLIP and DINOv2 embedding real tiles. Real search returning real results. Evaluation harness skeleton and the first hand-labelled queries. Everything running in Docker Compose.                      |
| 3    | Change pipeline: masks, IR-MAD, co-registration, embedding-distance screening, Siamese confirmation, polygons on the map. Swipe and blink comparison. First precision number on the no-change suite.        |
| 4    | Suppression gauntlet complete including persistence. Confidence calibration. Review queue, decisions, audit trail, export with provenance. First full offline run.                                          |
| 5    | Clustering and discovery screen. Change typing. Earliest-observation intervals. Evaluation screen and report export. Data manager with incremental ingest demo. Freeze features at the end of this week.    |
| 6    | Nothing new. Tune thresholds against held-out data, fix the ugly, write the architecture note and ingestion procedure, rehearse the demo eight times on the actual laptop with the cable out.               |

## 14. Demo script

Twelve minutes, ordered so that the constraint is proved first and the cleverness lands last.

1.  **0:00** — Unplug the network. Show the offline badge and zero blocked calls. Everything after this is happening locally.
2.  **1:00** — Index statistics: scenes, tiles, area, storage, build time, hardware. The evaluation report's numbers, read from the running system.
3.  **2:00** — Run the brief's own query: "newly built structures near a river". Show ranked results, hover to map, open a tile, show why it matched.
4.  **3:30** — Thumbs-down two irrelevant results. Rerank. The list visibly improves.
5.  **4:30** — "Find similar" on a good result → the discovery screen. Lasso a cluster, see it light up on the map, name it "under construction", save it as a site type.
6.  **6:00** — Change analysis over the airport AOI, 2019 to 2024. Run it. Show the stage log, then the funnel: ten thousand screened down to ninety-six reported. Open "why were these dropped" and show cloud and shadow rejects.
7.  **7:30** — Now the reservoir AOI. Naive differencing would report the entire shoreline as change; show that the seasonal model suppresses it, and that a genuine embankment extension still survives. This is the moment that proves you understood the brief.
8.  **9:00** — Open one candidate. Evidence page: before/after, confidence breakdown, provenance tree, earliest-observation interval with the cloud gap shown. Accept it.
9.  **10:00** — Export to GeoPackage, open the attribute table, point at the source scene IDs and model versions in the fields.
10. **10:45** — Drop a new scene into the watch folder. It ingests, the tile count rises, and a search immediately returns tiles from it. No rebuild.
11. **11:30** — Evaluation screen. Precision, recall, Recall@k, latency. Close on the false-alarm-rate-by-confounder table.
**Rehearse the failure.** Have a pre-computed results cache behind a flag so that if a job hangs on stage you can keep talking over cached output rather than watching a spinner. Also have every screen reachable from a URL, so you can jump instead of navigating.

## 15. Where teams lose marks

- **Generic CLIP instead of a remote-sensing model.** Overhead imagery is out of distribution for web-trained CLIP; queries about bare ground, quarries and vehicle concentrations fail badly. Swapping in RemoteCLIP is a one-line change with a large effect.
- **Reporting every difference as change.** Without persistence, seasonal and registration gates, precision collapses on the held-out no-change set, which is precisely what the brief warns about.
- **The map going blank offline.** Test with the cable out in week two, not week six.
- **Rebuilding the index on ingest.** If your answer to "add a scene" is "re-run the build script", you have failed 2.2.6 in front of the judges. Use an index that supports inserts, and demonstrate it.
- **Provenance as a footnote.** It appears twice in the brief. It needs to be in the database, on the evidence page, and in the export attributes.
- **Losing georeferencing.** Tiles, masks and polygons all need to round-trip back to real coordinates. Write a test that exports a polygon and re-imports it over the source scene.
- **Mixing resolutions.** Landsat at 30 m and Sentinel-2 at 10 m in one embedding space without resampling gives you clusters of "resolution" rather than clusters of content.
- **No numbers.** A working demo with no metrics loses to a slightly weaker demo with an evaluation report, because the report is a listed deliverable.
- **Tuning on the demo AOI only.** Hold one AOI back. The evaluation is held-out by design.

## 16. Deliverables checklist

Straight from the brief's section 2.3 — tick these before you tick anything else.

- Source code, with a README that gets a stranger to a running system on one machine.
- Architecture note: the diagram from §2, model choices with reasons, and the data flow.
- Index-build and incremental-ingestion procedure, written as a runnable document.
- Model and dataset provenance: names, versions, licences, source URLs, checksums.
- Reproducible evaluation report containing indexed area, number of scenes and tiles, build time, storage footprint, query latency and hardware — generated by the system, not typed by hand.
**One line to close your pitch.** "Ten thousand candidate changes screened, ninety-six reported, eighty-nine confirmed by an analyst — on a disconnected laptop, with every result traceable to its source scene." Precision, sovereignty and provenance in one sentence. That is the brief, restated as a result.
Built as a working reference for SIH 26227. Assumptions: a six-person team, Python and React, one GPU machine for embedding and a laptop for the demo. Adjust the six-week plan to whatever runway you actually have.
