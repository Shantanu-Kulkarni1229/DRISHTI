from datetime import datetime, timezone
from app.models.scene import Scene
from app.models.tile import Tile


def test_search_endpoint(client, db_session, test_user):
    # Seed a tile for search
    scene = Scene(
        id="scene-search-01",
        organisation_id=test_user.organisation_id,
        sensor="S2",
        product_level="L2A",
        acquisition_datetime=datetime(2023, 5, 1, tzinfo=timezone.utc),
        source_path="/path/test",
        checksum="chk-search",
        licence="Open",
        ingested_at=datetime.now(timezone.utc),
        aoi_id="sector-14",
    )
    db_session.add(scene)
    db_session.commit()

    tile = Tile(
        id="tile-search-01",
        organisation_id=test_user.organisation_id,
        scene_id=scene.id,
        grid_cell_id="cell-search-01",
        aoi_id="sector-14",
        bbox=[72.88, 18.98, 72.90, 19.00],
        native_crs="EPSG:4326",
        datetime=scene.acquisition_datetime,
        sensor="S2",
        gsd_m=10.0,
        valid_fraction=1.0,
        cloud_fraction=0.01,
        thumb_pattern="airport",
        concept_terms=["runway", "airfield"],
    )
    db_session.add(tile)
    db_session.commit()

    # Search query
    payload = {
        "query_text": "runway",
        "mode": "text",
        "aoi_id": "sector-14",
        "top_k": 10,
    }
    res = client.post("/api/search", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "queryId" in data or "query_id" in data
    assert len(data["results"]) == 1
    assert data["results"][0]["tile"]["id"] == "tile-search-01"


def test_search_feedback_endpoint(client):
    payload = {
        "query_id": "sq-123456",
        "tile_id": "tile-search-01",
        "label": "good",
    }
    res = client.post("/api/search/feedback", json=payload)
    assert res.status_code == 200
    assert res.json()["status"] == "recorded"
