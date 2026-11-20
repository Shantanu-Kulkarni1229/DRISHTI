from datetime import datetime, timezone
from app.models.change import ChangeCandidate, ChangeJob
from app.models.grid_cell import GridCell
from app.models.scene import Scene
from app.models.tile import Tile


def test_candidates_and_decision_lifecycle(client, db_session, test_user):
    # Setup prerequisite records
    job = ChangeJob(
        id="chg-job-cand-test",
        organisation_id=test_user.organisation_id,
        created_by="Analyst",
        start_datetime=datetime.now(timezone.utc),
        end_datetime=datetime.now(timezone.utc),
        requested_types=["construction"],
        status="done",
    )
    cell = GridCell(
        id="cell-cand-test",
        organisation_id=test_user.organisation_id,
        grid_reference="grid-ref-1",
    )
    scene = Scene(
        id="scene-cand-test",
        organisation_id=test_user.organisation_id,
        sensor="S2",
        product_level="L2A",
        acquisition_datetime=datetime.now(timezone.utc),
        source_path="/path",
        checksum="chk",
        ingested_at=datetime.now(timezone.utc),
    )
    db_session.add_all([job, cell, scene])
    db_session.commit()

    tile = Tile(
        id="tile-cand-test",
        organisation_id=test_user.organisation_id,
        scene_id=scene.id,
        grid_cell_id=cell.id,
        datetime=datetime.now(timezone.utc),
        sensor="S2",
    )
    db_session.add(tile)
    db_session.commit()

    cand = ChangeCandidate(
        id="cand-lifecycle-01",
        organisation_id=test_user.organisation_id,
        job_id=job.id,
        aoi_id="sector-14",
        grid_cell_id=cell.id,
        tile_before_id=tile.id,
        tile_after_id=tile.id,
        bbox=[72.85, 18.95, 72.90, 19.00],
        area_m2=1250.0,
        change_type="construction",
        direction="appearance",
        score=0.88,
        confidence=0.85,
        review_status="pending",
        earliest_interval_start="2021-02-14",
        earliest_interval_end="2021-03-10",
        revisit_gap_days=24,
    )
    db_session.add(cand)
    db_session.commit()

    # List candidates
    list_res = client.get("/api/candidates?aoi_id=sector-14")
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 1

    # Candidate detail
    detail_res = client.get(f"/api/candidates/{cand.id}")
    assert detail_res.status_code == 200
    assert detail_res.json()["id"] == cand.id

    # Earliest observation
    earliest_res = client.get(f"/api/candidates/{cand.id}/earliest")
    assert earliest_res.status_code == 200
    assert earliest_res.json()["earliestIntervalStart"] == "2021-02-14"

    # Persist decision
    dec_res = client.post(
        f"/api/candidates/{cand.id}/decision",
        json={"verdict": "accepted", "note": "Confirmed missile revetment structure."},
    )
    assert dec_res.status_code == 200
    dec_data = dec_res.json()
    assert dec_data["verdict"] == "accepted"
    assert dec_data["candidateId"] == cand.id
