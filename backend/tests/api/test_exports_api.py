import json
from datetime import datetime, timezone
from app.models.change import ChangeCandidate, ChangeJob
from app.models.grid_cell import GridCell
from app.models.scene import Scene
from app.models.tile import Tile


def test_audit_verify_api_endpoint(client, db_session, test_user):
    # Verify audit endpoint via client
    res = client.get("/api/audit/verify")
    assert res.status_code == 200
    data = res.json()
    assert "valid" in data
    assert "records_verified" in data
    assert "latest_hash" in data


def test_multi_format_export_and_download(client, db_session, test_user):
    org_id = test_user.organisation_id

    # 1. Setup prerequisite records
    job = ChangeJob(
        id="job-exp-01",
        organisation_id=org_id,
        created_by="Analyst",
        start_datetime=datetime.now(timezone.utc),
        end_datetime=datetime.now(timezone.utc),
        requested_types=["construction"],
        status="done",
    )
    cell = GridCell(
        id="cell-exp-01",
        organisation_id=org_id,
        grid_reference="grid-ref-exp-1",
    )
    scene = Scene(
        id="scene-exp-01",
        organisation_id=org_id,
        sensor="S2",
        product_level="L2A",
        acquisition_datetime=datetime(2023, 6, 1, tzinfo=timezone.utc),
        source_path="/path/test",
        checksum="chk-exp-01",
        licence="Open",
        ingested_at=datetime.now(timezone.utc),
    )
    db_session.add_all([job, cell, scene])
    db_session.commit()

    tile = Tile(
        id="tile-exp-01",
        organisation_id=org_id,
        scene_id=scene.id,
        grid_cell_id=cell.id,
        datetime=datetime.now(timezone.utc),
        sensor="S2",
    )
    db_session.add(tile)
    db_session.commit()

    cand = ChangeCandidate(
        id="cand-exp-01",
        organisation_id=org_id,
        job_id=job.id,
        aoi_id="sector-bravo",
        grid_cell_id=cell.id,
        tile_before_id=tile.id,
        tile_after_id=tile.id,
        bbox=[72.85, 18.95, 73.05, 19.10],
        area_m2=12500.0,
        change_type="construction",
        direction="increase",
        score=0.88,
        confidence=0.92,
        review_status="confirmed",
        revisit_gap_days=12,
        earliest_interval_start="2023-01-15",
        earliest_interval_end="2023-01-27",
    )
    db_session.add(cand)
    db_session.commit()

    # 2. Test GeoJSON export
    res_geojson = client.post(
        "/api/export",
        json={"candidateIds": [cand.id], "format": "geojson"},
    )
    assert res_geojson.status_code == 201
    geo_data = res_geojson.json()
    assert geo_data["format"] == "geojson"
    assert geo_data["item_count"] == 1
    export_id = geo_data["export_id"]

    # Download GeoJSON
    dl_res = client.get(f"/api/export/{export_id}/download")
    assert dl_res.status_code == 200
    assert "application/geo+json" in dl_res.headers["content-type"]
    parsed_geo = dl_res.json()
    assert parsed_geo["type"] == "FeatureCollection"
    assert len(parsed_geo["features"]) == 1
    assert parsed_geo["features"][0]["properties"]["candidate_id"] == cand.id

    # Manifest
    manifest_res = client.get(f"/api/export/{export_id}/manifest")
    assert manifest_res.status_code == 200
    assert "sha256" in manifest_res.json()

    # 3. Test CSV export
    res_csv = client.post(
        "/api/export",
        json={"candidateIds": [cand.id], "format": "csv"},
    )
    assert res_csv.status_code == 201
    csv_id = res_csv.json()["export_id"]
    dl_csv = client.get(f"/api/export/{csv_id}/download")
    assert dl_csv.status_code == 200
    assert "text/csv" in dl_csv.headers["content-type"]
    assert "cand-exp-01" in dl_csv.text

    # 4. Test KML export
    res_kml = client.post(
        "/api/export",
        json={"candidateIds": [cand.id], "format": "kml"},
    )
    assert res_kml.status_code == 201
    kml_id = res_kml.json()["export_id"]
    dl_kml = client.get(f"/api/export/{kml_id}/download")
    assert dl_kml.status_code == 200
    assert "<kml xmlns" in dl_kml.text
    assert "cand-exp-01" in dl_kml.text

    # 5. Test STAC export
    res_stac = client.post(
        "/api/export",
        json={"candidateIds": [cand.id], "format": "stac"},
    )
    assert res_stac.status_code == 201
    stac_id = res_stac.json()["export_id"]
    dl_stac = client.get(f"/api/export/{stac_id}/download")
    assert dl_stac.status_code == 200
    stac_json = dl_stac.json()
    assert stac_json["type"] == "FeatureCollection"
    assert "stac_version" in stac_json
