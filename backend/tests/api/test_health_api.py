def test_health_endpoint(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["app"] == "DRISHTI"
    assert data["offline_mode"] is True


def test_health_ready_endpoint(client):
    res = client.get("/api/health/ready")
    assert res.status_code == 200
    data = res.json()
    assert "status" in data
    assert "database" in data
    assert "models" in data
