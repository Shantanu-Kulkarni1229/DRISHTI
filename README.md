# DRISHTI (दृष्टि)

> **Offline-first AI-powered geospatial intelligence application for satellite imagery search, similar-location discovery, temporal change analysis, evidence management, and analyst review.**

Designed for defence and sovereign space intelligence operations (SIH 26227 · Indian Army / DGIS).

---

## 1. Key Capabilities

- **Cross-Modal Semantic Retrieval:** Search satellite tiles by natural language concepts ("newly built structures near a river", "aircraft revetment") using RemoteCLIP ViT-L/14 with interactive Rocchio relevance feedback reranking.
- **Bi-Temporal Change Analysis:** Detects structural change over Sentinel-2, Sentinel-1, and Landsat archives using Siamese change models (TinyCD) and land-cover transition typing.
- **7-Stage Suppression Gauntlet:** Fosters high precision over indiscriminate change recall by passing candidates through sequential gates: *Validity*, *Radiometry (IR-MAD)*, *Registration Quality*, *Phenological Seasonality*, *Multi-Date Persistence*, *Cross-Sensor SAR Corroboration*, and *Geometry Sanity*.
- **Earliest-Supported Observation:** Identifies the precise uncertainty interval between the last clear observation without change and the first clear observation with change, highlighting cloud revisit gaps.
- **Unsupervised Discovery:** UMAP + HDBSCAN clustering on DINOv2 embeddings to discover similar sites across vast regions with linked brushing.
- **Triage & Audit Trail:** Analyst decision queue with keyboard shortcuts (`J`/`K`/`A`/`R`), reason codes, and an append-only, SHA-256 chained audit ledger.
- **Zero-Egress Sovereignty:** Designed to run with all network cables pulled; features a visible in-browser offline guard counting and blocking any outbound foreign request attempts.

---

## 2. Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **API Framework** | FastAPI (Python 3.11+) | High-performance asynchronous REST & SSE API |
| **Validation** | Pydantic v2 & Pydantic-Settings | Strict request/response typing and environment config |
| **Database & ORM** | PostgreSQL 16 + SQLAlchemy 2.x | Relational storage with row-level tenant isolation |
| **Geospatial Engine** | PostGIS 3.4 & GeoAlchemy2 | Geographic boundaries, spatial indexing (GiST) |
| **Vector Store** | pgvector | Approximate Nearest Neighbour search (HNSW index) |
| **Background Workers** | Celery + Redis 7 | Asynchronous windowed tiling & heavy change jobs |
| **Raster Processing** | Rasterio & GDAL | Windowed reads, affine transforms, cloud masks |
| **Frontend** | React 19, TypeScript, Vite, Tailwind | Analyst console with dark-mode map UI |

---

## 3. Quick Start

### Prerequisites
- Docker & Docker Compose (or Python 3.11+ and PostgreSQL with PostGIS & pgvector)
- Node.js 20+ (for Frontend development)

### One-Command Startup (Docker)
```bash
# 1. Clone repository and setup environment
cp .env.example .env

# 2. Build and start all services (API, Worker, PostGIS, Redis)
make up

# 3. Apply database migrations
make migrate

# 4. Seed initial development data (analyst user, models, Sector-14 scenes)
make seed
```
The services will be available at:
- **API Documentation (Swagger):** [http://localhost:8000/docs](http://localhost:8000/docs)
- **API Health Endpoint:** [http://localhost:8000/api/health](http://localhost:8000/api/health)
- **Readiness & Diagnostic Check:** [http://localhost:8000/api/health/ready](http://localhost:8000/api/health/ready)

### Starting the Frontend
```bash
cd Frontend
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 4. Local Development Workflow (Without Docker)

If developing directly on a local workstation:
```bash
# Create virtual environment
python -m venv backend/.venv
source backend/.venv/bin/activate  # Or on Windows: backend\.venv\Scripts\activate

# Install backend dependencies
pip install -r backend/requirements/base.txt
pip install -r backend/requirements/dev.txt

# Run migrations
cd backend
alembic upgrade head

# Seed development database
python scripts/seed_development_data.py

# Start FastAPI development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Start Celery worker in a separate terminal
celery -A app.workers.celery_app.celery_app worker --loglevel=info
```

---

## 5. Running Automated Tests

The test suite validates configuration, password security, tenant isolation, raster tiling, audit hash chaining, Rocchio calculations, suppression gates, and all REST endpoints.

```bash
# Run full test suite with pytest
pytest -v backend/tests
```

---

## 6. Project Structure

```
DRISHTI/
├── Frontend/                 # React 19 / Vite analyst interface
├── backend/                  # FastAPI backend modular monolith
│   ├── app/
│   │   ├── main.py           # FastAPI entrypoint & middleware
│   │   ├── core/             # Configuration, logging, security, exceptions
│   │   ├── api/              # REST routers (v1 endpoints)
│   │   ├── schemas/          # Pydantic v2 schemas
│   │   ├── models/           # SQLAlchemy 2.x PostGIS/pgvector models
│   │   ├── services/         # Ingestion, search, change detection, audit
│   │   ├── adapters/         # Raster (GDAL), vectors (pgvector), storage
│   │   ├── workers/          # Celery worker tasks
│   │   └── db/               # Database session, base model, extension init
│   ├── migrations/           # Alembic schema migrations
│   ├── tests/                # Unit, integration, and API test suite
│   ├── scripts/              # Data seeding & maintenance scripts
│   ├── Dockerfile
│   └── pyproject.toml
├── data/                     # Offline imagery, tiles, thumbnails & models
├── docs/                     # Technical specifications & architecture notes
│   ├── ARCHITECTURE.md
│   ├── DATABASE_SCHEMA.md
│   ├── API_REFERENCE.md
│   ├── FRONTEND_BACKEND_CONTRACT.md
│   ├── INGESTION_PIPELINE.md
│   ├── OFFLINE_DEPLOYMENT.md
│   └── MODEL_REGISTRY.md
├── docker-compose.yml
├── Makefile
└── .env.example
```

---

## 7. Default Credentials (Development)

- **Analyst Email:** `analyst@drishti.local`
- **Analyst Password:** `analyst_secure_password_2026`
- **Organisation:** `MoD / DGIS`
