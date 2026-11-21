import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.core.security import get_password_hash
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models.audit import AuditRecord
from app.models.change import ChangeCandidate, ChangeJob
from app.models.cluster import Cluster
from app.models.grid_cell import GridCell
from app.models.model_registry import ModelRegistry
from app.models.organisation import Organisation
from app.models.scene import Scene
from app.models.tile import Tile, TileEmbedding
from app.models.user import User


def seed():
    print("Creating tables if needed...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # 1. Organisation
        org = db.query(Organisation).filter(Organisation.slug == "mod-dgis").first()
        if not org:
            org = Organisation(
                id=uuid.uuid4(),
                name="MoD / DGIS",
                slug="mod-dgis",
            )
            db.add(org)
            db.commit()
            db.refresh(org)
            print(f"Created organization: {org.name} ({org.id})")

        # 2. User
        user = db.query(User).filter(User.email == "analyst@drishti.local").first()
        if not user:
            user = User(
                id=uuid.uuid4(),
                organisation_id=org.id,
                email="analyst@drishti.local",
                password_hash=get_password_hash("analyst_secure_password_2026"),
                display_name="A. Rao",
                role="analyst",
                is_active=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            print(f"Created analyst user: {user.display_name} ({user.email})")

        # 3. Model Registry
        models_data = [
            {
                "name": "RemoteCLIP",
                "version": "ViT-L/14@v1.0",
                "task": "text_image_retrieval",
                "licence": "MIT",
                "source_url": "https://github.com/ChenDelong1999/RemoteCLIP",
                "sha256": "9a4b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b",
                "local_path": "data/models/remoteclip",
                "size_mb": 1710.0,
            },
            {
                "name": "DINOv2",
                "version": "ViT-B/14@v1.0",
                "task": "visual_similarity",
                "licence": "Apache-2.0",
                "source_url": "https://github.com/facebookresearch/dinov2",
                "sha256": "8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d",
                "local_path": "data/models/dinov2",
                "size_mb": 346.0,
            },
            {
                "name": "TinyCD",
                "version": "LEVIR-CD@v1.0",
                "task": "change_confirmation",
                "licence": "MIT",
                "source_url": "https://github.com/AndreaCodegoni/TinyCD",
                "sha256": "7b6a5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b",
                "local_path": "data/models/change_detection",
                "size_mb": 28.4,
            },
        ]
        for m in models_data:
            existing = db.query(ModelRegistry).filter(ModelRegistry.name == m["name"]).first()
            if not existing:
                db.add(ModelRegistry(**m))
        db.commit()
        print("Model registry seeded.")

        # 4. Grid Cells & Scenes & Tiles
        cell = db.query(GridCell).filter(GridCell.grid_reference == "cell_072.85_018.95").first()
        if not cell:
            cell = GridCell(
                id="cell-sector14-001",
                organisation_id=org.id,
                grid_reference="cell_072.85_018.95",
                bbox=[72.85, 18.95, 73.05, 19.10],
                crs="EPSG:4326",
                aoi_id="sector-14",
            )
            db.add(cell)
            db.commit()
            db.refresh(cell)

        scene = db.query(Scene).filter(Scene.id == "s2-2023-04-12").first()
        if not scene:
            scene = Scene(
                id="s2-2023-04-12",
                organisation_id=org.id,
                sensor="S2",
                product_level="L2A",
                acquisition_datetime=datetime(2023, 4, 12, 5, 45, tzinfo=timezone.utc),
                crs="EPSG:4326",
                bbox=[72.85, 18.95, 73.05, 19.10],
                cloud_percentage=2.0,
                source_path="data/imagery/s2_20230412.tif",
                size_mb=420.0,
                checksum="a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0",
                licence="Open Access (Copernicus)",
                ingestion_status="done",
                ingested_at=datetime.now(timezone.utc),
                aoi_id="sector-14",
            )
            db.add(scene)
            db.commit()
            db.refresh(scene)

        tile = db.query(Tile).filter(Tile.id == "tile-s2-2023-04-001").first()
        if not tile:
            tile = Tile(
                id="tile-s2-2023-04-001",
                organisation_id=org.id,
                scene_id=scene.id,
                grid_cell_id=cell.id,
                aoi_id="sector-14",
                bbox=[72.91, 18.98, 72.93, 19.00],
                native_crs="EPSG:4326",
                datetime=scene.acquisition_datetime,
                sensor="S2",
                gsd_m=10.0,
                valid_fraction=1.0,
                cloud_fraction=0.02,
                thumb_color="#3b4252",
                thumb_pattern="airport",
                cluster_id="cluster-01",
                embedding_2d=[0.42, -1.18],
                concept_terms=["runway", "cleared runway strip", "aircraft parking apron"],
            )
            db.add(tile)
            db.commit()
            print(f"Created tile: {tile.id}")

            # 4b. Seed Tile Embeddings for RemoteCLIP & DINOv2
            import random
            import math
            raw_vec = [random.gauss(0, 1) for _ in range(768)]
            mag = math.sqrt(sum(x * x for x in raw_vec))
            unit_vec = [x / mag for x in raw_vec]

            emb_clip = TileEmbedding(
                id=uuid.uuid4(),
                organisation_id=org.id,
                tile_id=tile.id,
                model_name="RemoteCLIP",
                model_version="ViT-L-14",
                dimension=768,
                embedding=unit_vec,
            )
            emb_dino = TileEmbedding(
                id=uuid.uuid4(),
                organisation_id=org.id,
                tile_id=tile.id,
                model_name="DINOv2",
                model_version="ViT-B-14",
                dimension=768,
                embedding=unit_vec,
            )
            db.add(emb_clip)
            db.add(emb_dino)
            db.commit()
            print("Seeded RemoteCLIP and DINOv2 vector embeddings.")

        # 5. Change Job & Candidates
        chg_job = db.query(ChangeJob).filter(ChangeJob.id == "chg-job-001").first()
        if not chg_job:
            chg_job = ChangeJob(
                id="chg-job-001",
                organisation_id=org.id,
                created_by="A. Rao",
                aoi_id="sector-14",
                start_datetime=datetime(2019, 1, 1, tzinfo=timezone.utc),
                end_datetime=datetime(2024, 12, 31, tzinfo=timezone.utc),
                requested_types=["construction", "clearance", "water", "roads"],
                sensitivity=0.55,
                status="done",
                current_stage="done",
                progress=100,
                funnel_counts={
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
                        "geometry": 212,
                    },
                },
                started_at=datetime.now(timezone.utc),
                completed_at=datetime.now(timezone.utc),
            )
            db.add(chg_job)
            db.commit()

            cand = ChangeCandidate(
                id="cand-001",
                organisation_id=org.id,
                job_id=chg_job.id,
                aoi_id="sector-14",
                grid_cell_id=cell.id,
                tile_before_id=tile.id,
                tile_after_id=tile.id,
                bbox=[72.915, 18.985, 72.925, 18.995],
                geom_center={"lng": 72.920, "lat": 18.990},
                area_m2=4250.0,
                change_type="construction",
                direction="appearance",
                score=0.92,
                confidence=0.89,
                confidence_factors=[
                    {"gate": "validity", "label": "Valid observation fraction", "value": 0.98},
                    {"gate": "radiometry", "label": "Radiometric consistency", "value": 0.94},
                    {"gate": "registration", "label": "Registration residual", "value": 0.88},
                    {"gate": "season", "label": "Phenological envelope fit", "value": 0.91},
                    {"gate": "persistence", "label": "Multi-date persistence", "value": 1.00},
                    {"gate": "cross_sensor", "label": "SAR agreement", "value": 0.92},
                    {"gate": "geometry", "label": "Geometry compactness", "value": 0.95},
                ],
                review_status="pending",
                earliest_interval_start="2021-02-14",
                earliest_interval_end="2021-03-10",
                revisit_gap_days=24,
                headline="First missile launch pad appears",
                narrative="New reinforced concrete foundation and revetment wall identified.",
            )
            db.add(cand)
            db.commit()

        # 6. Cluster
        cluster = db.query(Cluster).filter(Cluster.id == "cluster-01").first()
        if not cluster:
            cluster = Cluster(
                id="cluster-01",
                organisation_id=org.id,
                name="Airfield Infrastructure",
                is_saved=True,
                algorithm="HDBSCAN",
                algorithm_version="0.8.38",
                centroid_2d=[0.40, -1.15],
                member_tile_ids=[tile.id],
                color="#81a1c1",
                aoi_id="sector-14",
            )
            db.add(cluster)
            db.commit()

        # 7. Audit Genesis
        audit = db.query(AuditRecord).filter(AuditRecord.action == "system.seed").first()
        if not audit:
            genesis_hash = AuditRecord.compute_hash(
                previous_hash="0" * 64,
                actor_id="system",
                action="system.seed",
                target_type="system",
                target_id="init",
                payload={"version": "1.0.0", "aoi": "sector-14"},
                created_at_iso=datetime.now(timezone.utc).isoformat(),
            )
            audit = AuditRecord(
                id=uuid.uuid4(),
                organisation_id=org.id,
                actor_id="system",
                actor_name="Bootstrap Seeder",
                action="system.seed",
                target_type="system",
                target_id="init",
                payload={"version": "1.0.0", "aoi": "sector-14"},
                model_versions={"RemoteCLIP": "ViT-L/14@v1.0"},
                created_at=datetime.now(timezone.utc),
                previous_hash="0" * 64,
                record_hash=genesis_hash,
            )
            db.add(audit)
            db.commit()
            print("Genesis audit record created.")

        print("Development data successfully seeded!")

    finally:
        db.close()


if __name__ == "__main__":
    seed()
