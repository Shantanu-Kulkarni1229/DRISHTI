from pathlib import Path
from typing import Optional
from app.db.session import SessionLocal
from app.services.ingestion.pipeline import IngestionPipeline
from app.workers.celery_app import celery_app
from app.core.logging import get_logger

logger = get_logger(__name__)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def process_scene_task(
    self,
    organisation_id: str,
    job_id: str,
    file_path_str: str,
    aoi_id: Optional[str] = None,
):
    """Celery background worker task for incremental raster ingestion."""
    logger.info("Starting ingestion task %s for file %s", job_id, file_path_str)
    db = SessionLocal()
    try:
        pipeline = IngestionPipeline(db)
        scene = pipeline.process_scene(
            organisation_id=organisation_id,
            job_id=job_id,
            file_path=Path(file_path_str),
            aoi_id=aoi_id,
            progress_callback=lambda stage, progress: self.update_state(
                state="PROGRESS",
                meta={"stage": stage, "progress": progress},
            ),
        )
        return {"status": "SUCCESS", "scene_id": scene.id}
    except Exception as exc:
        logger.exception("Ingestion task failed: %s", str(exc))
        raise self.retry(exc=exc)
    finally:
        db.close()
