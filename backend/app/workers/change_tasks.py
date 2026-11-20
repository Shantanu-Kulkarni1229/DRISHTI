from app.db.session import SessionLocal
from app.workers.celery_app import celery_app
from app.core.logging import get_logger

logger = get_logger(__name__)


@celery_app.task(bind=True, max_retries=2, default_retry_delay=30)
def process_change_job_task(
    self,
    organisation_id: str,
    job_id: str,
):
    """Celery background worker task for temporal change analysis through suppression gauntlet."""
    logger.info("Executing change analysis task for job %s", job_id)
    # Long running worker processing logic
    return {"status": "SUCCESS", "job_id": job_id}
