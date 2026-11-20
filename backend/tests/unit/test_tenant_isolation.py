import uuid
from datetime import datetime, timezone
from app.models.change import ChangeJob
from app.models.scene import Scene
from app.models.tile import Tile


def test_tenant_data_isolation(db_session, test_org, other_org):
    # Create scene belonging to test_org
    scene_org1 = Scene(
        id="scene-org1",
        organisation_id=test_org.id,
        sensor="S2",
        product_level="L2A",
        acquisition_datetime=datetime.now(timezone.utc),
        source_path="/path/1",
        checksum="chk1",
        licence="Open",
        ingested_at=datetime.now(timezone.utc),
    )
    # Create scene belonging to other_org
    scene_org2 = Scene(
        id="scene-org2",
        organisation_id=other_org.id,
        sensor="S2",
        product_level="L2A",
        acquisition_datetime=datetime.now(timezone.utc),
        source_path="/path/2",
        checksum="chk2",
        licence="Open",
        ingested_at=datetime.now(timezone.utc),
    )
    db_session.add_all([scene_org1, scene_org2])
    db_session.commit()

    # Query filtered by test_org must only return scene_org1
    results_org1 = db_session.query(Scene).filter(Scene.organisation_id == test_org.id).all()
    assert len(results_org1) == 1
    assert results_org1[0].id == "scene-org1"

    # Query filtered by other_org must only return scene_org2
    results_org2 = db_session.query(Scene).filter(Scene.organisation_id == other_org.id).all()
    assert len(results_org2) == 1
    assert results_org2[0].id == "scene-org2"
