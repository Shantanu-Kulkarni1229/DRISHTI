# DRISHTI — Frontend-Backend Integration Contract

## 1. Overview & Architectural Principles

This document defines the formal integration contract between the DRISHTI React/Vite frontend and the FastAPI backend. It reflects the exact data structures, TypeScript interfaces, and operational assumptions discovered during frontend inspection (`Frontend/src/lib/types.ts`, `Frontend/src/lib/mockData.ts`, `Frontend/src/state/*.ts`).

### Core Rules
- **API Prefix:** All endpoints are mounted under `/api` (OpenAPI schema and docs available at `/docs` and `/redoc`).
- **Offline Guard Compatibility:** The frontend enforces an in-browser outbound traffic guard (`installOfflineGuard` in `Frontend/src/state/offlineStore.ts`). Any call to a foreign origin is blocked and counted. Therefore, the backend API must be accessible either on the same origin (via Vite proxy in local dev or reverse proxy in production) or explicitly whitelisted.
- **Geographic Representation:**
  - Coordinates follow GeoJSON convention `[longitude, latitude]` (EPSG:4326).
  - Bounding boxes follow `[minLng, minLat, maxLng, maxLat]`.
  - Polygons follow RFC 7946 GeoJSON format.
- **Timestamps:** All datetimes are formatted as ISO 8601 UTC strings (`YYYY-MM-DDTHH:mm:ss.sssZ` or `YYYY-MM-DD`).
- **Field Naming:** JSON payloads support camelCase for direct frontend TypeScript mapping while preserving snake_case aliases where standard in geospatial specifications (e.g. STAC, GeoJSON properties).
- **Authentication & Tenant Isolation:** Analyst requests include standard Bearer JWT tokens. Every data query and mutation is strictly scoped to the authenticated user's `organisation_id`.

---

## 2. Shared Domain Enums & Literals

| Type | Valid Values | Notes |
|---|---|---|
| `Sensor` | `"S2"`, `"S1"`, `"L8"`, `"BHUVAN"` | Sentinel-2, Sentinel-1, Landsat-8, Bhuvan |
| `ChangeType` | `"construction"`, `"clearance"`, `"water"`, `"roads"` | Coarse land-cover transition classes |
| `ChangeDirection` | `"appearance"`, `"disappearance"`, `"expansion"`, `"contraction"` | Structural change vector |
| `AcquisitionUsability` | `"clear"`, `"partly_cloudy"`, `"unusable"`, `"missing"` | Timeline and quality mask state |
| `SuppressionGateId` | `"validity"`, `"radiometry"`, `"registration"`, `"season"`, `"persistence"`, `"cross_sensor"`, `"geometry"` | Sequential gates in suppression gauntlet |
| `RejectReasonCode` | `"cloud"`, `"shadow"`, `"seasonal"`, `"misregistration"`, `"not_of_interest"`, `"duplicate"` | Feedback & decision reason codes |
| `IngestStage` | `"queued"`, `"masking"`, `"normalising"`, `"aligning"`, `"tiling"`, `"embedding"`, `"indexing"`, `"done"`, `"failed"` | Ingestion pipeline stages |
| `ChangeStage` | `"masking"`, `"normalising"`, `"aligning"`, `"scoring"`, `"suppressing"`, `"done"`, `"failed"` | Temporal analysis stages |

---

## 3. Endpoints Specification

### 3.1 Health & Readiness
- `GET /api/health`
  - Response: `{ "status": "healthy", "version": "1.0.0", "offline_mode": true }`
- `GET /api/health/ready`
  - Response:
    ```json
    {
      "status": "ready",
      "database": "connected",
      "postgis": "available",
      "pgvector": "available",
      "redis": "connected",
      "models": {
        "remoteclip": "available | not_configured",
        "dinov2": "available | not_configured",
        "tinycd": "available | not_configured"
      }
    }
    ```

### 3.2 Authentication & Organization
- `POST /api/auth/register`
  - Request: `{ "email": "analyst@drishti.local", "password": "...", "display_name": "A. Rao", "organisation_name": "MoD" }`
  - Response: `{ "user": { "id": "...", "email": "...", "role": "analyst", "organisation_id": "..." }, "access_token": "...", "refresh_token": "..." }`
- `POST /api/auth/login`
  - Request: `{ "email": "analyst@drishti.local", "password": "..." }`
  - Response: `{ "access_token": "...", "refresh_token": "...", "token_type": "bearer", "user": { ... } }`
- `POST /api/auth/refresh`
  - Request: `{ "refresh_token": "..." }`
  - Response: `{ "access_token": "...", "refresh_token": "..." }`
- `GET /api/auth/me`
  - Headers: `Authorization: Bearer <token>`
  - Response: User profile and organization details.

### 3.3 Semantic & Visual Search
- `POST /api/search`
  - Request:
    ```json
    {
      "query_text": "missile launch pad or erector launcher",
      "mode": "text | image | both",
      "blend": 0.5,
      "image_tile_id": null,
      "aoi_id": "sector-14",
      "bbox": [72.85, 18.95, 73.05, 19.10],
      "date_from": "2016-01-01",
      "date_to": "2025-12-31",
      "sensors": ["S2", "S1"],
      "max_cloud": 20,
      "top_k": 24,
      "cursor": null
    }
    ```
  - Response:
    ```json
    {
      "query_id": "sq-1732000000",
      "results": [
        {
          "tile": {
            "id": "tile-s2-2023-04-001",
            "sceneId": "s2-2023-04-12",
            "aoiId": "sector-14",
            "gridCellId": "cell-014-082",
            "footprint": { "bbox": [72.91, 18.98, 72.93, 19.00] },
            "datetime": "2023-04-12T05:45:00Z",
            "sensor": "S2",
            "gsdM": 10.0,
            "validFrac": 1.0,
            "cloudFrac": 0.02,
            "thumbColor": "#3b4252",
            "thumbPattern": "airport",
            "clusterId": "cluster-04",
            "embedding2d": [0.42, -1.18],
            "conceptTerms": ["runway", "cleared runway strip", "aircraft parking apron"],
            "imageUrl": "/api/tiles/tile-s2-2023-04-001/thumbnail"
          },
          "score": 0.91,
          "saliency": [{ "x": 0.45, "y": 0.52, "r": 0.18 }],
          "textScore": 0.91,
          "imageScore": null,
          "rocchioScore": null
        }
      ],
      "next_cursor": null
    }
    ```
- `POST /api/search/feedback`
  - Request: `{ "query_id": "sq-1732000000", "tile_id": "tile-s2-2023-04-001", "label": "good | bad" }`
  - Response: `{ "status": "recorded", "feedback_rounds": 1 }`

### 3.4 Tiles & Time-Series
- `GET /api/tiles/{id}`
  - Response: Full Tile entity and parent Scene metadata.
- `GET /api/tiles/{id}/similar?k=12&space=dino|clip`
  - Response: Ranked similar tiles.
- `GET /api/tiles/{id}/timeseries`
  - Response: Array of `TimeSeriesPoint`:
    ```json
    [
      {
        "date": "2020-03-15",
        "changeScore": 0.12,
        "ndvi": 0.62,
        "ndwi": -0.25,
        "sarBackscatter": -14.2,
        "seasonalEnvelopeLow": 0.55,
        "seasonalEnvelopeHigh": 0.72,
        "usability": "clear"
      }
    ]
    ```

### 3.5 Change Analysis & Suppression Gauntlet
- `POST /api/change/jobs`
  - Request:
    ```json
    {
      "aoi_id": "sector-14",
      "date_from": "2019-01-01",
      "date_to": "2024-12-31",
      "date_mode": "range | pair",
      "pair_before": null,
      "pair_after": null,
      "types": ["construction", "clearance", "water", "roads"],
      "sensitivity": 0.55
    }
    ```
  - Response: `{ "job_id": "chg-job-001", "status": "queued" }`
- `GET /api/change/jobs/{id}`
  - Response: Status, progress, current stage, and the **Suppression Funnel**:
    ```json
    {
      "id": "chg-job-001",
      "status": "done",
      "progress": 100,
      "funnel": {
        "screened": 10412,
        "validityPassed": 8420,
        "radiometryPassed": 6120,
        "registrationPassed": 4210,
        "seasonPassed": 1850,
        "persistencePassed": 340,
        "geometryPassed": 128,
        "reported": 96,
        "droppedByGate": {
          "validity": 1992,
          "radiometry": 2300,
          "registration": 1910,
          "season": 2360,
          "persistence": 1510,
          "cross_sensor": 0,
          "geometry": 212
        }
      }
    }
    ```
- `GET /api/change/jobs/{id}/events`
  - Server-Sent Events (SSE) streaming live progress and stage updates:
    `data: {"stage": "scoring", "progress": 60, "status": "running"}\n\n`

### 3.6 Candidates, Decisions & Earliest Observation
- `GET /api/candidates?job_id=...&status=...&type=...&min_confidence=...`
  - Response: Paginated array of `ChangeCandidate` objects.
- `GET /api/candidates/{id}`
  - Response: Change candidate detail with suppression factors, source scenes, and provenance tree data.
- `GET /api/candidates/{id}/earliest`
  - Response:
    ```json
    {
      "candidate_id": "cand-001",
      "earliest_interval_start": "2021-02-14",
      "earliest_interval_end": "2021-03-10",
      "revisit_gap_days": 24,
      "cloud_gap_detected": true
    }
    ```
- `POST /api/candidates/{id}/decision`
  - Request:
    ```json
    {
      "verdict": "accepted | rejected",
      "reason_code": "cloud | shadow | seasonal | misregistration | not_of_interest | duplicate | null",
      "note": "Confirmed foundation works for new aircraft revetment."
    }
    ```
  - Response: `{ "status": "persisted", "decision_id": "dec-001", "audit_record_id": "audit-001" }`

### 3.7 Discovery & Clusters
- `GET /api/clusters?aoi_id=...`
  - Response: Array of `Cluster` objects (centroid2d, memberTileIds, name, color, isSaved).
- `POST /api/clusters/{id}/name`
  - Request: `{ "name": "Underground Munitions Storage" }`
  - Response: `{ "id": "cluster-01", "name": "Underground Munitions Storage", "isSaved": true }`

### 3.8 Ingestion
- `POST /api/ingest`
  - Supports multipart file upload (`file`, `aoi_id`, `sensor`) or watched-directory trigger (`watch_path`).
  - Response: `{ "job_id": "ingest-001", "status": "queued" }`
- `GET /api/ingest/jobs`
  - Response: Array of `IngestJob` records.

### 3.9 Administration & Evaluation
- `GET /api/admin/index/stats`
  - Returns real database and pgvector statistics: `vectorCount`, `indexSizeBytes`, `indexedAreaKm2`, `sceneCount`, `tileCount`, query latencies.
- `GET /api/admin/models`
  - Returns array of `ModelInfo` records (name, version, task, licence, sourceUrl, sha256).
- `GET /api/eval/retrieval`, `GET /api/eval/change`, `GET /api/eval/report`
  - Returns formal evaluation metrics matching `EvalMetrics` interface.

---

## 4. Frontend Vite Proxy Configuration

To allow seamless development without touching existing mock fallbacks, Vite's dev server (`Frontend/vite.config.ts`) can forward `/api` requests directly to FastAPI:

```ts
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8000',
      changeOrigin: true,
    },
  },
}
```
This ensures `isExternal("/api/...")` in the offline guard evaluates to `false`, allowing genuine offline operation with network cables disconnected.
