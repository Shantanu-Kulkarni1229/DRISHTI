import io
from app.models.ingestion import IngestionJob


def test_ingest_multipart_file_upload(client):
    file_content = b"II*\x00" + b"\x00" * 512
    files = {"file": ("test_scene_upload.tif", io.BytesIO(file_content), "image/tiff")}
    data = {"aoi_id": "sector-14"}

    res = client.post("/api/ingest", data=data, files=files)
    assert res.status_code == 202
    resp_data = res.json()
    assert "job_id" in resp_data
    assert resp_data["status"] == "queued"


def test_ingestion_jobs_list_and_detail(client, db_session, test_user):
    job = IngestionJob(
        id="ingest-test-job-99",
        organisation_id=test_user.organisation_id,
        source_path="/path/test.tif",
        filename="test.tif",
        status="done",
        current_stage="done",
        progress=100,
        tiles_created=8,
    )
    db_session.add(job)
    db_session.commit()

    list_res = client.get("/api/ingest/jobs")
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 1

    detail_res = client.get(f"/api/ingest/jobs/{job.id}")
    assert detail_res.status_code == 200
    assert detail_res.json()["tilesProduced"] == 8
