from datetime import datetime, timezone
import numpy as np
import pytest

from app.models.scene import Scene
from app.models.tile import Tile, TileEmbedding
from app.schemas.clusters import ClusterRenameRequest
from app.services.discovery.clustering_service import ClusteringService


def test_discovery_projection_clustering_and_similarity(db_session, test_user):
    service = ClusteringService(db_session)
    org_id = str(test_user.organisation_id)

    # 1. Create a parent scene
    scene = Scene(
        id="scene-discovery-01",
        organisation_id=org_id,
        sensor="S2",
        product_level="L2A",
        acquisition_datetime=datetime(2023, 6, 1, tzinfo=timezone.utc),
        source_path="/path/test",
        checksum="chk-discovery-01",
        licence="Open",
        ingested_at=datetime.now(timezone.utc),
    )
    db_session.add(scene)
    db_session.commit()

    # 2. Create two distinct clusters of tiles with synthetic 384-d embeddings
    # Group A: centered around base vector A
    # Group B: centered around base vector B
    np.random.seed(42)
    vec_a = np.zeros(384, dtype=np.float32)
    vec_a[:10] = 1.0
    vec_a /= np.linalg.norm(vec_a)

    vec_b = np.zeros(384, dtype=np.float32)
    vec_b[20:30] = 1.0
    vec_b /= np.linalg.norm(vec_b)

    tile_ids = []
    # 4 tiles in Group A
    for i in range(4):
        noise = np.random.normal(0, 0.05, 384).astype(np.float32)
        v = vec_a + noise
        v /= np.linalg.norm(v)

        t = Tile(
            id=f"tile-disc-a-{i}",
            organisation_id=org_id,
            scene_id=scene.id,
            grid_cell_id=f"cell-a-{i}",
            aoi_id="sector-alpha",
            bbox=[72.80 + i * 0.01, 18.90, 72.81 + i * 0.01, 18.91],
            native_crs="EPSG:4326",
            datetime=scene.acquisition_datetime,
            sensor="S2",
            gsd_m=10.0,
            valid_fraction=1.0,
            cloud_fraction=0.0,
        )
        db_session.add(t)
        db_session.flush()

        emb = TileEmbedding(
            organisation_id=org_id,
            tile_id=t.id,
            model_name="dinov2",
            model_version="vits14",
            dimension=384,
            embedding=v.tolist(),
        )
        db_session.add(emb)
        tile_ids.append(t.id)

    # 4 tiles in Group B
    for i in range(4):
        noise = np.random.normal(0, 0.05, 384).astype(np.float32)
        v = vec_b + noise
        v /= np.linalg.norm(v)

        t = Tile(
            id=f"tile-disc-b-{i}",
            organisation_id=org_id,
            scene_id=scene.id,
            grid_cell_id=f"cell-b-{i}",
            aoi_id="sector-alpha",
            bbox=[73.80 + i * 0.01, 19.90, 73.81 + i * 0.01, 19.91],
            native_crs="EPSG:4326",
            datetime=scene.acquisition_datetime,
            sensor="S2",
            gsd_m=10.0,
            valid_fraction=1.0,
            cloud_fraction=0.0,
        )
        db_session.add(t)
        db_session.flush()

        emb = TileEmbedding(
            organisation_id=org_id,
            tile_id=t.id,
            model_name="dinov2",
            model_version="vits14",
            dimension=384,
            embedding=v.tolist(),
        )
        db_session.add(emb)
        tile_ids.append(t.id)

    db_session.commit()

    # 3. Compute clusters and 2D projections
    clusters = service.compute_clusters_and_projections(
        organisation_id=org_id,
        aoi_id="sector-alpha",
        min_cluster_size=2,
    )

    assert len(clusters) >= 1
    for c in clusters:
        assert c.centroid_2d is not None
        assert len(c.centroid_2d) == 2
        assert len(c.member_tile_ids) >= 1
        assert c.color.startswith("#")

    # Verify tile 2D projections are updated
    refreshed_tiles = db_session.query(Tile).filter(Tile.id.in_(tile_ids)).all()
    for t in refreshed_tiles:
        assert t.embedding_2d is not None
        assert len(t.embedding_2d) == 2
        assert isinstance(t.embedding_2d[0], float)
        assert isinstance(t.embedding_2d[1], float)

    # 4. Test Visual Similarity Retrieval ("More sites like this")
    similar_to_a0 = service.get_similar_tiles(
        organisation_id=org_id,
        tile_id="tile-disc-a-0",
        k=3,
        space="dino",
    )
    assert len(similar_to_a0) == 3
    # The most similar tiles to a-0 must belong to Group A
    top_ids = [t.id for t in similar_to_a0]
    assert "tile-disc-a-0" not in top_ids
    assert any("tile-disc-a" in tid for tid in top_ids)

    # 5. Rename cluster
    target_cluster = clusters[0]
    renamed = service.rename_cluster(
        organisation_id=org_id,
        cluster_id=target_cluster.id,
        req=ClusterRenameRequest(name="Ammunition Depot Alpha"),
    )
    assert renamed.name == "Ammunition Depot Alpha"
    assert renamed.is_saved is True
