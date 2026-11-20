from app.models.cluster import Cluster


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

    # Rename cluster
    rename_res = client.post(
        f"/api/clusters/{cluster.id}/name",
        json={"name": "Subsurface Bunkers"},
    )
    assert rename_res.status_code == 200
    assert rename_res.json()["name"] == "Subsurface Bunkers"
    assert rename_res.json()["isSaved"] is True
