# DRISHTI — System Architecture Note

## 1. Executive Summary

**DRISHTI** is an offline-first AI-powered geospatial intelligence application designed for high-precision satellite imagery search, similar-site discovery, temporal change analysis, evidence management, and analyst review.

Built for mission-critical deployments under strict sovereignty constraints (including complete offline operation with network interfaces disabled), DRISHTI balances modular design, low latency, and explainable decision provenance.

---

## 2. Architectural Blueprint

The architecture is designed as a **modular monolith** with independently scalable background workers.

```
                      +---------------------------------------+
                      |       Browser (React 19 / Vite)       |
                      |   Offline Guard (0 foreign calls)     |
                      +-------------------+-------------------+
                                          |
                                    REST / SSE
                                          |
                                          v
+-----------------------------------------------------------------------------------+
| DRISHTI Backend (FastAPI)                                                         |
|                                                                                   |
|  +--------------------+  +--------------------+  +--------------------+           |
|  |   Auth & Tenant    |  |  Semantic Search   |  |  Change Analysis   |           |
|  |     Isolation      |  |  & Rocchio Rerank  |  |  & Suppression     |           |
|  +--------------------+  +--------------------+  +--------------------+           |
|                                                                                   |
|  +--------------------+  +--------------------+  +--------------------+           |
|  |     Discovery      |  |  Data Manager &    |  |  Audit & Evidence  |           |
|  |  (UMAP / HDBSCAN)  |  |  Ingest Service    |  |   Chained Hashes   |           |
|  +--------------------+  +--------------------+  +--------------------+           |
+-------------------+-------------------+-------------------+-----------------------+
                    |                   |                   |
                    v                   v                   v
     +---------------------+  +-----------------+  +-----------------+
     | PostgreSQL 16       |  |  Redis 7        |  | Object Storage  |
     | - PostGIS (Spatial) |  |  (Broker &      |  | (Local / S3     |
     | - pgvector (ANN)    |  |   SSE PubSub)   |  |  Abstraction)   |
     +---------------------+  +--------+--------+  +-----------------+
                                       |
                                       v
                     +-----------------------------------+
                     | Celery Worker Layer               |
                     | - Windowed Raster Tiling (GDAL)   |
                     | - Embedding Extraction (CPU/CUDA) |
                     | - Siamese Change Confirmation     |
                     +-----------------------------------+
```

---

## 3. Ingestion Pipeline & Shared Embedding Space

One unified ingestion pipeline feeds both **semantic retrieval** and **temporal change analysis** over a shared tile store and dual embedding space:

1. **RemoteCLIP ViT-L/14 (768-d):** Remote-sensing fine-tuned vision-language tower for cross-modal text-to-image queries.
2. **DINOv2 ViT-B/14 (768-d):** Pure visual feature extractor for structural similarity, unsupervised clustering, and change screening.

```
INGESTION WORKFLOW:
GeoTIFF / COG
  │
  ├─► Checksum & Duplicate Detection (SHA-256 chunked streaming)
  ├─► Metadata Extraction (CRS, Affine Transform, Sensor, Datetime, Cloud %)
  ├─► Reference Analysis Grid Snapping (GridCell co-location)
  ├─► Windowed Tiling (256x256 px, stride 128 px, GSD 10m)
  ├─► Thumbnail Generation
  ├─► Model Inference (Local weights, batching)
  ├─► Vector Store Insertion (pgvector HNSW index, no full rebuilds)
  └─► Tamper-Evident Chained Audit Logging
```

---

## 4. The 7-Stage Suppression Gauntlet

To satisfy the military requirement ("*Favour analytically useful precision over indiscriminate change recall*"), DRISHTI subjects candidate anomalies to seven sequential suppression filters:

| Stage | Gate | Filter Mechanism |
|---|---|---|
| 1 | **Validity** | Rejects pixels covered by cloud, cloud shadow, cirrus, or snow using the Scene Classification Layer (SCL) or s2cloudless mask. Requires >=75% valid pixels. |
| 2 | **Radiometry** | Normalises the target acquisition to the reference scene using Iteratively Reweighted Multivariate Alteration Detection (IR-MAD). Drops differences that vanish post-normalisation. |
| 3 | **Registration** | Estimates sub-pixel misalignment via phase correlation. Drops thin sliver polygons whose width is <= 1.5x the residual shift. |
| 4 | **Seasonality** | Restricts comparisons to equivalent phenological windows (±30 days of day-of-year) or fits a harmonic curve to suppress seasonal vegetation and water fluctuations. |
| 5 | **Persistence** | Requires confirmed structural changes to remain present in at least 2 subsequent usable acquisitions. This single gate eliminates 95%+ of transient false alarms. |
| 6 | **Cross-Sensor** | Corroborates optical detections with Sentinel-1 SAR backscatter (VV/VH delta), providing cloud-independent confirmation. |
| 7 | **Geometry** | Enforces minimum area thresholds (>=100 m²) and eliminates scene edge clipping artifacts. |

---

## 5. Security & Multi-Tenant SaaS Architecture

1. **Row-Level Tenant Isolation:** Every core entity incorporates `organisation_id` with foreign key cascades, compound B-tree indexes, and automated repository filtering.
2. **Short-Lived Access Tokens & Rotation:** JWT access tokens expire in 30 minutes; refresh tokens rotate securely.
3. **Cryptographically Chained Audit Trail:** Every analyst action and system operation calculates a deterministic SHA-256 hash incorporating the previous record's hash (`previous_hash` -> `record_hash`), guaranteeing tamper-evident provenance.
