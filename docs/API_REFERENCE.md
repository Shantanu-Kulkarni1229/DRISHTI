# DRISHTI — API Reference Guide

All API endpoints are mounted under the prefix `/api`.
Interactive OpenAPI documentation is served at `/docs` (Swagger UI) and `/redoc` (ReDoc).

---

## 1. System & Health

### `GET /api/health`
Checks high-level API operational status.
- **Status:** 200 OK
- **Response:**
  ```json
  {
    "status": "healthy",
    "app": "DRISHTI",
    "environment": "development",
    "offline_mode": true
  }
  ```

### `GET /api/health/ready`
Deep diagnostic check verifying database connectivity, spatial extensions (`postgis`, `vector`), redis, and staged offline model weights.
- **Status:** 200 OK
- **Response:**
  ```json
  {
    "status": "ready",
    "database": "connected",
    "postgis": "available",
    "pgvector": "available",
    "models": {
      "remoteclip": "available | not_configured",
      "dinov2": "available | not_configured",
      "change_detection": "available | not_configured"
    }
  }
  ```

---

## 2. Authentication

### `POST /api/auth/register`
Creates an analyst account and associated military/organisational unit.
- **Payload:**
  ```json
  {
    "email": "analyst.sharma@drishti.local",
    "password": "SecurePassword1234!",
    "display_name": "Maj. Sharma",
    "organisation_name": "Northern Command",
    "role": "analyst"
  }
  ```
- **Response:** Returns user profile, access token, and refresh token.

### `POST /api/auth/login`
Authenticates credentials and returns short-lived JWT access token and refresh token.

### `POST /api/auth/refresh`
Rotates tokens without re-prompting analyst credentials.

### `GET /api/auth/me`
Returns current authenticated analyst profile and organisation context.

---

## 3. Semantic & Visual Retrieval

### `POST /api/search`
Cross-modal search across imagery archive.
- **Payload:**
  ```json
  {
    "query_text": "newly built structures near a river",
    "mode": "text | image | both",
    "blend": 0.5,
    "image_tile_id": null,
    "aoi_id": "sector-14",
    "date_from": "2016-01-01",
    "date_to": "2025-12-31",
    "sensors": ["S2", "S1", "L8"],
    "max_cloud": 20,
    "top_k": 24
  }
  ```
- **Response:**
  ```json
  {
    "query_id": "sq-1732000000",
    "results": [
      {
        "tile": {
          "id": "tile-s2-2023-04-001",
          "sceneId": "s2-2023-04-12",
          "aoiId": "sector-14",
          "gridCellId": "cell-sector14-001",
          "footprint": { "bbox": [72.91, 18.98, 72.93, 19.00] },
          "datetime": "2023-04-12T05:45:00Z",
          "sensor": "S2",
          "gsdM": 10.0,
          "validFrac": 1.0,
          "cloudFrac": 0.02,
          "thumbColor": "#3b4252",
          "thumbPattern": "airport",
          "conceptTerms": ["runway", "cleared runway strip"]
        },
        "score": 0.91,
        "saliency": [{"x": 0.45, "y": 0.52, "r": 0.18}],
        "textScore": 0.91
      }
    ]
  }
  ```

### `POST /api/search/feedback`
Submits positive/negative analyst judgements to trigger the Rocchio query vector reformulation.

---

## 4. Tiles & Time-Series

### `GET /api/tiles/{id}`
Returns tile metadata, native CRS, pixel window offsets, and parent scene reference.

### `GET /api/tiles/{id}/similar`
Discovers nearest neighbors in DINOv2 or RemoteCLIP embedding space.

### `GET /api/tiles/{id}/timeseries`
Returns historical stack of observations for the tile's co-located grid cell (NDVI, NDWI, SAR backscatter, seasonal envelope, and usability).

---

## 5. Temporal Change Analysis & Gauntlet

### `POST /api/change/jobs`
Submits asynchronous bi-temporal change detection job. Returns immediately with `202 Accepted` and job ID.

### `GET /api/change/jobs/{id}`
Retrieves job progress and the **Suppression Funnel** statistics.

### `GET /api/change/jobs/{id}/events`
Server-Sent Events (SSE) connection streaming real-time stage progress (`masking` -> `normalising` -> `aligning` -> `scoring` -> `suppressing`).

---

## 6. Review Queue & Evidence

### `GET /api/candidates`
Returns filtered change candidates (`aoi_id`, `status`, `type`, `min_conf`).

### `GET /api/candidates/{id}`
Returns comprehensive candidate evidence: before/after scene pairs, confidence factor breakdown, and full provenance tree.

### `GET /api/candidates/{id}/earliest`
Returns the earliest-supported observation interval (`earliest_interval_start`, `earliest_interval_end`, `revisit_gap_days`).

### `POST /api/candidates/{id}/decision`
Persists analyst triage verdict (`accepted` or `rejected`), reason code, and analyst notes into the tamper-evident audit ledger.

---

## 7. Data Ingestion & Administration

### `POST /api/ingest`
Accepts GeoTIFF/COG uploads or triggers ingestion from the sandboxed watch directory.

### `GET /api/admin/index/stats`
Reports live index size, vector count, and query latency percentiles (p50/p95).

### `GET /api/admin/models`
Returns registered model metadata, checkpoint versions, licenses, and SHA-256 weight checksums.

### `POST /api/export`
Exports accepted intelligence products with full provenance in GeoJSON, CSV, KML, STAC, or GeoPackage formats.
