from datetime import datetime, timezone
from app.models.scene import Scene
from app.models.tile import Tile


def test_tiles_and_timeseries_endpoints(client, db_session, test_user):
    scene = Scene(
        id="scene-tile-api",
        organisation_id=test_user.organisation_id,
        sensor="S2",
        product_level="L2A",
        acquisition_datetime=datetime(2023, 6, 1, tzinfo=timezone.utc),
        source_path="/path/test",
        checksum="chk-tile-api",
        licence="Open",
        ingested_at=datetime.now(timezone.utc),
    )
    db_session.add(scene)
    db_session.commit()

    tile = Tile(
        id="tile-api-01",
        organisation_id=test_user.organisation_id,
        scene_id=scene.id,
        grid_cell_id="cell-api-01",
        aoi_id="sector-14",
        bbox=[72.88, 18.98, 72.90, 19.00],
        native_crs="EPSG:4326",
        datetime=scene.acquisition_datetime,
        sensor="S2",
        gsd_m=10.0,
        valid_fraction=1.0,
        cloud_fraction=0.01,
        thumb_pattern="airport",
        concept_terms=["runway"],
    )
    db_session.add(tile)
    db_session.commit()

    # Get tile
    res = client.get("/api/tiles/tile-api-01")
    assert res.status_code == 200
    assert res.json()["id"] == "tile-api-01"

    # Get timeseries
    ts_res = client.get("/api/tiles/tile-api-01/timeseries")
    assert ts_res.status_code == 200
    assert len(ts_res.json()) >= 1

    # Get thumbnail
    thumb_res = client.get("/api/tiles/tile-api-01/thumbnail")
    assert thumb_res.status_code == 200
    assert thumb_res.headers["content-type"] == "image/png"
