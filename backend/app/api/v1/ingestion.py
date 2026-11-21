import os
import shutil
import time
from pathlib import Path
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.db.session import get_db
from app.models.ingestion import IngestionJob
from app.models.user import User
from app.schemas.ingestion import IngestJobResponse, IngestUploadResponse, WatchFolderTriggerRequest
from app.services.ingestion.pipeline import IngestionPipeline

router = APIRouter(prefix="/ingest", tags=["Ingestion"])


@router.post("", response_model=IngestUploadResponse, status_code=status.HTTP_202_ACCEPTED)
async def ingest_raster_file(
    file: Optional[UploadFile] = File(None),
    watch_path: Optional[str] = Form(None),
    aoi_id: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    settings = get_settings()
    job_id = f"ingest-{int(time.time() * 1000)}"

    if file:
        filename = os.path.basename(file.filename or "uploaded_scene.tif")
        # Save to sandboxed imagery directory
        target_path = settings.IMAGERY_ROOT / filename
        with open(target_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        source_path = str(target_path)
    elif watch_path:
        # Prevent path traversal outside staged imagery root
        safe_rel = watch_path.lstrip("/\\")
        candidate_path = (settings.IMAGERY_ROOT / safe_rel).resolve()
        if not str(candidate_path).startswith(str(settings.IMAGERY_ROOT.resolve())):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid watched folder path traversal.")
        if not candidate_path.is_file():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"File not found in watch folder: {watch_path}")
        filename = candidate_path.name
        source_path = str(candidate_path)
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Either file upload or watch_path must be provided.")

    job = IngestionJob(
        id=job_id,
        organisation_id=current_user.organisation_id,
        source_path=source_path,
        filename=filename,
        aoi_id=aoi_id or "global",
        status="queued",
        current_stage="queued",
        progress=0,
    )
    db.add(job)
    db.commit()

    # Trigger pipeline
    pipeline = IngestionPipeline(db)
    try:
        pipeline.process_scene(
            organisation_id=str(current_user.organisation_id),
            job_id=job_id,
            file_path=Path(source_path),
            aoi_id=aoi_id,
        )
    except Exception:
        # Failure is captured inside pipeline and persisted to job record
        pass

    return IngestUploadResponse(
        job_id=job_id,
        filename=filename,
        status="queued",
        message="Scene accepted for asynchronous incremental ingestion.",
    )


@router.post("/watch")
def trigger_watch_folder(
    req: WatchFolderTriggerRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    settings = get_settings()
    job_id = f"ingest-watch-{int(time.time() * 1000)}"

    safe_rel = req.watch_path.lstrip("/\\")
    candidate_path = (settings.IMAGERY_ROOT / safe_rel).resolve()
    if not str(candidate_path).startswith(str(settings.IMAGERY_ROOT.resolve())):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid watched folder path traversal.")
    if not candidate_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"File not found in watch folder: {req.watch_path}")

    filename = candidate_path.name
    source_path = str(candidate_path)

    job = IngestionJob(
        id=job_id,
        organisation_id=current_user.organisation_id,
        source_path=source_path,
        filename=filename,
        aoi_id=req.aoi_id or "global",
        status="queued",
        current_stage="queued",
        progress=0,
    )
    db.add(job)
    db.commit()

    pipeline = IngestionPipeline(db)
    try:
        pipeline.process_scene(
            organisation_id=str(current_user.organisation_id),
            job_id=job_id,
            file_path=Path(source_path),
            aoi_id=req.aoi_id,
        )
    except Exception:
        pass

    return {
        "jobId": job_id,
        "job_id": job_id,
        "filename": filename,
        "status": "queued",
    }


@router.get("/jobs", response_model=List[IngestJobResponse])
def list_ingestion_jobs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    jobs = (
        db.query(IngestionJob)
        .filter(IngestionJob.organisation_id == current_user.organisation_id)
        .order_by(IngestionJob.created_at.desc())
        .all()
    )
    return [
        IngestJobResponse(
            id=j.id,
            filename=j.filename,
            aoi_id=j.aoi_id,
            status=j.status,
            progress=j.progress,
            tiles_created=j.tiles_created,
            embed_ms=j.embed_ms,
            index_insert_ms=j.index_insert_ms,
            created_at=j.created_at.isoformat(),
            completed_at=j.completed_at.isoformat() if j.completed_at else None,
            error_message=j.error_message,
            retry_of=j.retry_of,
        )
        for j in jobs
    ]


@router.get("/jobs/{job_id}", response_model=IngestJobResponse)
def get_ingestion_job(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job = (
        db.query(IngestionJob)
        .filter(IngestionJob.id == job_id, IngestionJob.organisation_id == current_user.organisation_id)
        .first()
    )
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Ingest job {job_id} not found.")

    return IngestJobResponse(
        id=job.id,
        filename=job.filename,
        aoi_id=job.aoi_id,
        status=job.status,
        progress=job.progress,
        tiles_created=job.tiles_created,
        embed_ms=job.embed_ms,
        index_insert_ms=job.index_insert_ms,
        created_at=job.created_at.isoformat(),
        completed_at=job.completed_at.isoformat() if job.completed_at else None,
        error_message=job.error_message,
        retry_of=job.retry_of,
    )
