# DRISHTI — Offline Deployment & Sovereign Packaging

## 1. Zero-Egress Architecture

In national defense and sovereign intelligence environments, systems operate with physical network cables disconnected (air-gapped).

DRISHTI is engineered specifically for offline operation:
1. **In-Browser Outbound Guard:** The frontend intercepts all `fetch()` and `XMLHttpRequest()` calls using `installOfflineGuard()` (`Frontend/src/state/offlineStore.ts`). Any attempted call to a foreign origin is blocked and registered. The live count of blocked calls is surfaced in the offline badge.
2. **Offline Basemaps:** Local PMTiles or MBTiles files hosted in `data/local_basemaps/` serve offline tiles.
3. **No External Fonts or CDN Assets:** All icons (Lucide), styles (Tailwind), and fonts are bundled statically into the distribution.
4. **Environment Isolation Flags:**
   ```bash
   OFFLINE_MODE=true
   HF_HUB_OFFLINE=1
   TRANSFORMERS_OFFLINE=1
   ```
   These flags prevent Hugging Face Hub, PyTorch, and Timm from initiating phone-home network checks.

---

## 2. Staging Offline Weights & Assets

Before disconnecting the machine:
```bash
# 1. Download model weights into data/models:
mkdir -p data/models/remoteclip data/models/dinov2 data/models/change_detection

# 2. Verify SHA-256 checksums:
sha256sum data/models/remoteclip/*
sha256sum data/models/dinov2/*
sha256sum data/models/change_detection/*

# 3. Pull required Docker base images:
docker pull postgis/postgis:16-3.4
docker pull redis:7-alpine
docker pull python:3.11-slim
```

---

## 3. Cold Start from Disconnected State

Once staged, bringing up the platform requires a single command:
```bash
docker compose up -d
```
All services (Database, Redis, FastAPI, Celery, and static web UI) start locally without connecting to the public internet.


# 1. Activate virtual environment
.\backend\.venv\Scripts\Activate.ps1

# 2. Run the test suite (all 35 tests)
pytest -v backend/tests

# 3. Seed local demonstration dataset
python backend/scripts/seed_development_data.py

# 4. Start backend API server
uvicorn app.main:app --app-dir backend --reload --port 8000

# 5. In a separate terminal, launch the frontend
cd Frontend
npm run dev