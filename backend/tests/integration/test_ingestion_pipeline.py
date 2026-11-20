from app.models.ingestion import IngestionJob
from app.models.scene import Scene
from app.models.tile import Tile
from app.services.ingestion.pipeline import IngestionPipeline


def test_incremental_scene_ingestion_workflow(db_session, test_org, synthetic_raster):
    pipeline = IngestionPipeline(db_session)
    job_id = "test-job-ingest-01"

    job = IngestionJob(
        id=job_id,
        organisation_id=test_org.id,
        source_path=str(synthetic_raster),
        filename=synthetic_raster.name,
        aoi_id="sector-14",
        status="queued",
        current_stage="queued",
        progress=0,
    )
    db_session.add(job)
    db_session.commit()

    scene = pipeline.process_scene(
        organisation_id=str(test_org.id),
        job_id=job_id,
        file_path=synthetic_raster,
        aoi_id="sector-14",
    )

    assert scene is not None
    assert scene.ingestion_status == "done"
    assert scene.organisation_id == test_org.id

    # Verify tiles were created
    tiles = db_session.query(Tile).filter(Tile.scene_id == scene.id).all()
    assert len(tiles) > 0

    # Verify idempotency: re-ingesting the exact same scene returns existing scene
    re_scene = pipeline.process_scene(
        organisation_id=str(test_org.id),
        job_id="test-job-ingest-02",
        file_path=synthetic_raster,
        aoi_id="sector-14",
    )
    assert re_scene.id == scene.id
