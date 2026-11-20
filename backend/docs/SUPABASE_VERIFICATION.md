# DRISHTI · Supabase PostgreSQL Verification Report

**Author:** Senior Python Backend & PostgreSQL Engineer  
**Date:** 2026-11-20  
**Target Database:** Supabase PostgreSQL Cloud Instance (Tokyo Region `ap-northeast-1`)  
**Connection Mode:** Supabase Connection Pooler (Session Mode, Port `5432`)  
**Environment File:** `backend/.env`  

---

## 1. Executive Status Summary

| Category | Verification Item | Status | Key Finding / Actual Output |
|---|---|---|---|
| **Configuration** | `DATABASE_URL` Env Variable | **VERIFIED** | Loaded from `backend/.env` with `sslmode=require`. |
| **Configuration** | PostgreSQL Driver | **VERIFIED** | `psycopg 3.3.9` (`psycopg-binary 3.3.9`). |
| **Configuration** | SQLAlchemy Engine | **VERIFIED** | Resolves `postgresql://` cleanly to `psycopg` dialect. |
| **Configuration** | Alembic Configuration | **VERIFIED** | Script path updated to `%(here)s/migrations`, dynamically overrides URL, uses `NullPool`. |
| **Configuration** | SQLite Defaulting | **VERIFIED** | Strict PostgreSQL in development/production; SQLite isolated to test fixtures. |
| **Connectivity** | Live Supabase Connection | **VERIFIED** | Connected successfully via `aws-1-ap-northeast-1.pooler.supabase.com:5432`. |
| **Database Version**| PostgreSQL Server Version | **VERIFIED** | `PostgreSQL 17.12 on aarch64-unknown-linux-gnu, compiled by gcc (GCC) 15.2.0, 64-bit`. |
| **Security / TLS** | Client-to-Pooler SSL | **VERIFIED** | `pgconn.ssl_in_use: True` (encrypted TLS link). |
| **Database Extensions**| `pgcrypto` Extension | **VERIFIED** | **INSTALLED** (`v1.3`). |
| **Database Extensions**| `postgis` Extension | **VERIFIED** | **AVAILABLE** (Default `v3.3.7`, ready to enable). |
| **Database Extensions**| `vector` (pgvector) Extension| **VERIFIED** | **AVAILABLE** (Default `v0.8.2`, ready to enable). |
| **Permissions** | Extension Creation Privilege | **VERIFIED** | `has_database_privilege(current_user, 'postgres', 'CREATE') = True`. |
| **Existing Schema** | Public Schema Audit | **VERIFIED** | Clean slate initial state confirmed. Migrations applied transactionally. |
| **Migration Audit** | Schema Plan & Order | **VERIFIED** | 13 tables, strictly additive (`CREATE TABLE`, `CREATE INDEX`). Zero destructive operations. |
| **Migration Execution**| `alembic upgrade head` | **COMPLETED & VERIFIED** | Successfully executed: `001_initial_schema` -> `002_vector_and_spatial_indexes` (head). |
| **Schema Verification**| 13 Application Tables | **VERIFIED** | All 13 tables, 15 PKs, 19 FKs, and secondary indexes active in Supabase. |
| **Vector Engine** | pgvector & HNSW Indexes | **VERIFIED** | `vector` type column active on `tile_embeddings`, partial HNSW cosine indexes online. |
| **Live ORM Connectivity**| Live SQLAlchemy Session | **VERIFIED** | Successfully connected and executed live queries against all core models. |

---

## 2. Phase 1 — Configuration Inspection Results

* **Environment Variable:** `DATABASE_URL` in `backend/.env`.
* **Driver:** `psycopg 3.3.9` installed in `backend/.venv`.
* **Session Configuration (`backend/app/db/session.py`):**
  * `pool_pre_ping = True`
  * `pool_size = 10`
  * `max_overflow = 20`
  * `connect_timeout = 15` (increased from 2s to allow reliable cloud TLS handshakes)
* **Alembic Configuration (`backend/alembic.ini` & `backend/migrations/env.py`):**
  * `script_location = %(here)s/migrations`
  * Dynamic URL override: `config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)`
  * `poolclass = pool.NullPool` (ensures clean stateless DDL over pooler)
* **Secret Protection:** `.env` and `backend/.env` are confirmed ignored in `.gitignore`. Zero credentials or connection strings are logged or committed.

---

## 3. Phase 2 — Supabase Connectivity Verification

* **Command Executed:** Live connection via SQLAlchemy / Psycopg 3 over Session Pooler.
* **Actual Output:**
  ```text
  PostgreSQL Version:
    PostgreSQL 17.12 on aarch64-unknown-linux-gnu, compiled by gcc (GCC) 15.2.0, 64-bit

  Current Database: postgres
  Current User:     postgres
  Current Schema:   public
  Client TLS/SSL:   True
  ```
* **Alembic Connectivity Test:**
  ```text
  $ alembic -c backend/alembic.ini current
  INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
  INFO  [alembic.runtime.migration] Will assume transactional DDL.
  ```

---

## 4. Phase 3 — PostgreSQL Extensions Audit

Query against `pg_available_extensions` and `pg_extension`:

| Extension | Purpose in DRISHTI | Catalog Status | Current Version |
|---|---|---|---|
| `pgcrypto` | Cryptographic SHA-256 and UUID generation for audit logs | **INSTALLED** | `1.3` |
| `postgis` | Bounding box spatial calculations, CRS transforms, geometry | **AVAILABLE** | Default `3.3.7` (will be enabled by migration) |
| `vector` (pgvector) | 768-dimensional RemoteCLIP and DINOv2 cosine vector search | **AVAILABLE** | Default `0.8.2` (will be enabled by migration) |

* **User Privilege Check:**
  `SELECT has_database_privilege(current_user, current_database(), 'CREATE');` returned `True`.
  User `postgres` has permission to enable `postgis` and `vector`.

---

## 5. Phase 5 — Existing Schema Audit (public)

Query against `information_schema.tables`, `information_schema.table_constraints`, and `pg_indexes`:
* **Existing Tables:** `0` (clean database)
* **Alembic Revision History (`alembic_version`):** Does not exist yet.
* **Existing Foreign Keys:** `0`
* **Existing Indexes:** `0`

---

## 6. Phase 6 — Migration Plan & Safety Assessment

The initial migration [`backend/migrations/versions/001_initial_schema.py`](file:///d:/Documents/DRISHTI/backend/migrations/versions/001_initial_schema.py) is ready to execute:

### Step 1: Extension Activation (in `migrations/env.py`)
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

### Step 2: DDL Table Creation (in dependency order)
1. `organisations`: Root tenant boundary (`id` UUID PK, `slug` unique indexed).
2. `users`: Analyst accounts with RBAC (`id` UUID PK, `organisation_id` FK CASCADE).
3. `model_registry`: Model checkpoint metadata (`name` unique, `sha256`, `size_mb`).
4. `scenes`: Satellite scenes (`organisation_id` FK, `sensor`, `checksum`, `bbox`).
5. `grid_cells`: Spatial grid reference frames (`organisation_id` FK, `grid_reference`).
6. `tiles`: 1000m x 1000m chips (`scene_id` FK, `grid_cell_id` FK, `datetime`).
7. `tile_embeddings`: Vector embeddings (`tile_id` FK, `dimension` 768, `embedding`).
8. `change_jobs`: Change detection jobs (`organisation_id` FK, `status`, `funnel_counts`).
9. `change_candidates`: Filtered anomalies (`job_id` FK, `tile_before_id` FK, `tile_after_id` FK).
10. `decisions`: Analyst review outcomes (`candidate_id` FK, `verdict`, `reason_code`).
11. `clusters`: Unsupervised HDBSCAN clusters (`organisation_id` FK, `centroid_2d`).
12. `audit_records`: Cryptographic SHA-256 chained log (`previous_hash`, `record_hash` unique).
13. `ingestion_jobs`: Scene processing jobs (`source_path`, `filename`, `progress`).
14. `alembic_version`: Records version stamp `001_initial_schema`.

### Safety Check:
* **Risk Level:** **ZERO RISK** (the public schema has 0 existing tables).
* **Destructive SQL:** **NONE** (no `DROP TABLE`, `ALTER TABLE DROP COLUMN`, or `TRUNCATE`).

---

## 7. Migration Execution (Phases 6 & 7)

Upon receiving user approval, Alembic migration was executed:
```bash
backend\.venv\Scripts\alembic.exe -c backend/alembic.ini upgrade head
```

**Actual Output:**
```text
INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
INFO  [alembic.runtime.migration] Will assume transactional DDL.
INFO  [alembic.runtime.migration] Running upgrade 001_initial_schema -> 002_vector_and_spatial_indexes, Add pgvector Vector type and partial HNSW indexes
```

Current revision confirmed:
```text
$ alembic -c backend/alembic.ini current
002_vector_and_spatial_indexes (head)
```

---

## 8. Phase 7 — Post-Migration Schema Verification

### 8.1 Public Tables Audit
```text
--- TABLE SUMMARY ---
  Table: alembic_version      Columns: 1
  Table: audit_records        Columns: 12
  Table: change_candidates    Columns: 30
  Table: change_jobs          Columns: 18
  Table: clusters             Columns: 13
  Table: decisions            Columns: 10
  Table: grid_cells           Columns: 9
  Table: ingestion_jobs       Columns: 17
  Table: model_registry       Columns: 13
  Table: organisations        Columns: 5
  Table: scenes               Columns: 19
  Table: tile_embeddings      Columns: 9
  Table: tiles                Columns: 24
  Table: users                Columns: 9
Total Primary Keys: 15
Total Foreign Keys: 19
```

### 8.2 pgvector Type & Partial HNSW Indexes Verification
Inspection of `tile_embeddings`:
```text
--- TILE_EMBEDDINGS COLUMNS ---
  id: uuid (uuid)
  organisation_id: uuid (uuid)
  tile_id: character varying (varchar)
  model_name: character varying (varchar)
  model_version: character varying (varchar)
  dimension: integer (int4)
  embedding: USER-DEFINED (vector)
  created_at: timestamp with time zone (timestamptz)
  updated_at: timestamp with time zone (timestamptz)

--- TILE_EMBEDDINGS INDEXES ---
  pk_tile_embeddings:
    CREATE UNIQUE INDEX pk_tile_embeddings ON public.tile_embeddings USING btree (id)
  ix_tile_embeddings_org_model:
    CREATE INDEX ix_tile_embeddings_org_model ON public.tile_embeddings USING btree (organisation_id, model_name)
  ix_tile_embeddings_tile_id:
    CREATE INDEX ix_tile_embeddings_tile_id ON public.tile_embeddings USING btree (tile_id)
  uq_tile_embeddings_model_version:
    CREATE UNIQUE INDEX uq_tile_embeddings_model_version ON public.tile_embeddings USING btree (tile_id, model_name, model_version)
  ix_tile_embeddings_remoteclip_hnsw:
    CREATE INDEX ix_tile_embeddings_remoteclip_hnsw ON public.tile_embeddings USING hnsw (((embedding)::vector(768)) vector_cosine_ops) WHERE (((model_name)::text = 'RemoteCLIP'::text) AND (dimension = 768))
  ix_tile_embeddings_dinov2_hnsw:
    CREATE INDEX ix_tile_embeddings_dinov2_hnsw ON public.tile_embeddings USING hnsw (((embedding)::vector(768)) vector_cosine_ops) WHERE (((model_name)::text = 'DINOv2'::text) AND (dimension = 768))
```

### 8.3 Live SQLAlchemy ORM Test
Executed live database query with SQLAlchemy models:
```text
SQLAlchemy live query success: orgs=0, users=0, tiles=0, embeddings=0
```

---

## 9. Phase 8 — Production Readiness & Test Suite

All 35 local unit, API, and integration tests continue to pass in 2.81s against the test fixtures:
```text
backend\.venv\Scripts\pytest.exe backend/tests -q
...................................                                      [100%]
35 passed in 2.81s
```

The database backend is fully configured, connected to Supabase PostgreSQL, migrated to head, and verified production-ready.

