from datetime import datetime, timezone
import numpy as np
from app.models.cluster import Cluster
from app.models.scene import Scene
from app.models.tile import Tile, TileEmbedding


def test_clusters_endpoints(client, db_session, test_user):
    cluster = Cluster(
        id="cluster-test-01",
        organisation_id=test_user.organisation_id,
        name="Quarry Extraction",
        is_saved=False,
        algorithm="HDBSCAN",
        algorithm_version="0.8.38",
        centroid_2d=[0.25, -0.75],
        member_tile_ids=["tile-1", "tile-2"],
        color="#81a1c1",
        aoi_id="sector-14",
    )
    db_session.add(cluster)
    db_session.commit()

    # List clusters
    list_res = client.get("/api/clusters?aoi_id=sector-14")
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 1
    item = list_res.json()[0]
    assert "centroid2d" in item
    assert "memberTileIds" in item
    assert "isSaved" in item

    # Get single cluster
    get_res = client.get(f"/api/clusters/{cluster.id}")
    assert get_res.status_code == 200
    assert get_res.json()["name"] == "Quarry Extraction"

    # Rename cluster
    rename_res = client.post(
        f"/api/clusters/{cluster.id}/name",
        json={"name": "Subsurface Bunkers"},
    )
    assert rename_res.status_code == 200
    assert rename_res.json()["name"] == "Subsurface Bunkers"
    assert rename_res.json()["isSaved"] is True


def test_clusters_recompute_endpoint(client, db_session, test_user):
    scene = Scene(
        id="scene-api-cluster-recompute",
        organisation_id=test_user.organisation_id,
        sensor="S2",
        product_level="L2A",
        acquisition_datetime=datetime(2023, 6, 1, tzinfo=timezone.utc),
        source_path="/path/test",
        checksum="chk-api-cluster-recompute",
        licence="Open",
        ingested_at=datetime.now(timezone.utc),
    )
    db_session.add(scene)
    db_session.commit()

    # Add 4 tiles with embeddings
    for i in range(4):
        t = Tile(
            id=f"tile-recompute-{i}",
            organisation_id=test_user.organisation_id,
            scene_id=scene.id,
            grid_cell_id=f"cell-recompute-{i}",
            aoi_id="sector-recompute",
            bbox=[72.85, 18.95, 72.86, 18.96],
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
            organisation_id=test_user.organisation_id,
            tile_id=t.id,
            model_name="dinov2",
            model_version="vits14",
            dimension=384,
            embedding=[0.1 * i] * 384,
        )
        db_session.add(emb)

    db_session.commit()

    # Trigger recomputation via API
    recompute_res = client.post("/api/clusters/recompute?aoi_id=sector-recompute&min_cluster_size=2")
    assert recompute_res.status_code == 200
    assert isinstance(recompute_res.json(), list)
