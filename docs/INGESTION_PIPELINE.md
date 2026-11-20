# DRISHTI — Ingestion Pipeline Documentation

## 1. Pipeline Objectives & Guarantees

The DRISHTI Ingestion Pipeline processes satellite rasters into georeferenced, searchable, and comparable tiles.

### Core Guarantees:
1. **Resumable & Idempotent:** Re-running ingestion on an already ingested scene detects identical content via SHA-256 and skips recomputation without creating duplicate tiles or scenes.
2. **Windowed Memory Consumption:** Rasters are read in small windows (256x256 px) using Rasterio/GDAL window iterators. Rasters up to tens of gigabytes are processed without exhausting system RAM.
3. **Incremental Index Inserts:** New scenes and tiles append their embeddings into pgvector HNSW structures immediately. No index rebuild is required.
4. **Honest Model Provenance:** If offline model weights are missing, the pipeline completes raster validation, grid registration, tiling, and thumbnail generation, while explicitly recording embedding status as `pending`.

---

## 2. Ingestion Stages

```
STAGE 1: VALIDATION & CHECKSUM
  - File exists and is valid GeoTIFF / Cloud-Optimised GeoTIFF (COG).
  - Compute deterministic SHA-256 in 64 KB streamed chunks.
  - Query existing scenes by (organisation_id, checksum).
  - If match exists, exit immediately with existing scene ID.

STAGE 2: METADATA & GRID SNAPPING
  - Read native CRS, affine transform, dimensions, and band count.
  - Extract acquisition datetime and sensor type (S2, S1, L8, BHUVAN).
  - Derive geographic bounding box in EPSG:4326.
  - Compute scene record and persist to database.

STAGE 3: WINDOWED TILING & THUMBNAILS
  - Stride 128 px, tile window 256x256 px (10 m GSD for Sentinel-2).
  - Overlap ensures features straddling tile boundaries land whole in some tile.
  - For each chip:
      * Calculate spatial footprint polygon.
      * Snap to reference GridCell.
      * Generate overview thumbnail.
      * Persist Tile entity.

STAGE 4: EMBEDDING EXTRACTION
  - If weights exist in MODEL_ROOT:
      * Encode crop with RemoteCLIP vision tower (768-d).
      * Encode crop with DINOv2 vision tower (768-d).
      * Upsert into tile_embeddings.
      * Update tile embedding_status to 'completed'.
  - If weights absent:
      * Mark embedding_status as 'pending'.

STAGE 5: AUDIT LOGGING & COMPLETION
  - Record chained audit event 'ingest.scene'.
  - Update IngestionJob progress to 100% and status to 'done'.
```

---

## 3. Demonstration & Live Ingestion Walkthrough

To demonstrate incremental ingestion live:
```bash
# 1. Place a new GeoTIFF into the watched folder:
cp sector14_2024.tif data/imagery/

# 2. Trigger ingestion via CLI or API:
curl -X POST http://localhost:8000/api/ingest \
  -H "Authorization: Bearer <TOKEN>" \
  -F "watch_path=sector14_2024.tif" \
  -F "aoi_id=sector-14"

# 3. Monitor live progress via SSE:
curl -N http://localhost:8000/api/change/jobs/<JOB_ID>/events
```
Tiles from the new scene are immediately searchable in the search interface without restarting the server or rebuilding the vector index.
