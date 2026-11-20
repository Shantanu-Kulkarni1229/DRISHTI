def test_create_and_get_change_job(client):
    payload = {
        "aoi_id": "sector-14",
        "date_from": "2020-01-01",
        "date_to": "2024-01-01",
        "types": ["construction", "clearance"],
        "sensitivity": 0.60,
    }
    create_res = client.post("/api/change/jobs", json=payload)
    assert create_res.status_code == 202
    job_data = create_res.json()
    job_id = job_data["id"]
    assert job_id.startswith("chg-job-")
    assert job_data["status"] == "queued"

    # Get job status
    get_res = client.get(f"/api/change/jobs/{job_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == job_id
    assert "funnel" in get_res.json()


def test_change_job_sse_events(client):
    res = client.get("/api/change/jobs/chg-job-123/events")
    assert res.status_code == 200
    assert "text/event-stream" in res.headers["content-type"]
    content = res.text
    assert "data: " in content
    assert "masking" in content
