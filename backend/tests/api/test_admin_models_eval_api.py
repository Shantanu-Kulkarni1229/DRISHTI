def test_admin_models_registry(client):
    res = client.get("/api/admin/models")
    assert res.status_code == 200
    models = res.json()
    assert len(models) >= 3
    names = [m["name"] for m in models]
    assert "RemoteCLIP" in names
    assert "DINOv2" in names
    assert "TinyCD" in names


def test_admin_index_stats(client):
    res = client.get("/api/admin/index/stats")
    assert res.status_code == 200
    stats = res.json()
    assert "vectorCount" in stats
    assert "indexedAreaKm2" in stats
    assert "meanQueryLatencyMs" in stats


def test_evaluation_endpoints(client):
    # Retrieval eval
    r_res = client.get("/api/eval/retrieval")
    assert r_res.status_code == 200
    r_data = r_res.json()
    assert "recallAt1" in r_data
    assert "map" in r_data

    # Change eval
    c_res = client.get("/api/eval/change")
    assert c_res.status_code == 200
    c_data = c_res.json()
    assert "precision" in c_data
    assert "confusion" in c_data

    # Full report
    rep_res = client.get("/api/eval/report")
    assert rep_res.status_code == 200
    rep_data = rep_res.json()
    assert "retrieval" in rep_data
    assert "change" in rep_data
    assert "performance" in rep_data


def test_export_and_audit(client, db_session, test_user):
    # Export endpoint
    exp_res = client.post(
        "/api/export",
        json={"candidateIds": ["cand-fake-none"], "format": "geojson"},
    )
    # If not found returns 404 cleanly
    assert exp_res.status_code in (404, 201)

    # Audit endpoint
    audit_res = client.get("/api/audit")
    assert audit_res.status_code == 200
    assert isinstance(audit_res.json(), list)
