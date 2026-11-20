import asyncio
import json
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.change import ChangeJob
from app.models.user import User
from app.schemas.changes import ChangeJobCreateRequest, ChangeJobResponse, SuppressionFunnelResponse
from app.services.change_detection.change_service import ChangeService

router = APIRouter(prefix="/change", tags=["Change Analysis"])


@router.post("/jobs", response_model=ChangeJobResponse, status_code=status.HTTP_202_ACCEPTED)
def submit_change_job(
    req: ChangeJobCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = ChangeService(db)
    job = service.create_job(organisation_id=str(current_user.organisation_id), actor=current_user.display_name, req=req)

    funnel = None
    if job.funnel_counts:
        funnel = SuppressionFunnelResponse(**job.funnel_counts)

    return ChangeJobResponse(
        id=job.id,
        status=job.status,
        current_stage=job.current_stage,
        progress=job.progress,
        sensitivity=job.sensitivity,
        funnel=funnel,
        started_at=job.started_at.isoformat() if job.started_at else None,
        completed_at=job.completed_at.isoformat() if job.completed_at else None,
        error_message=job.error_message,
    )


@router.get("/jobs/{job_id}", response_model=ChangeJobResponse)
def get_change_job_status(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = ChangeService(db)
    job = service.get_job(organisation_id=str(current_user.organisation_id), job_id=job_id)

    funnel = None
    if job.funnel_counts:
        funnel = SuppressionFunnelResponse(**job.funnel_counts)

    return ChangeJobResponse(
        id=job.id,
        status=job.status,
        current_stage=job.current_stage,
        progress=job.progress,
        sensitivity=job.sensitivity,
        funnel=funnel,
        started_at=job.started_at.isoformat() if job.started_at else None,
        completed_at=job.completed_at.isoformat() if job.completed_at else None,
        error_message=job.error_message,
    )


@router.get("/jobs/{job_id}/events")
async def stream_job_events(
    job_id: str,
    db: Session = Depends(get_db),
):
    """Server-Sent Events (SSE) streaming live stage progress for change detection."""
    stages = [
        ("masking", "Masking cloud / shadow / snow", 20),
        ("normalising", "Radiometric normalisation (IR-MAD)", 40),
        ("aligning", "Co-registration to reference grid", 60),
        ("scoring", "Screening + Siamese confirmation", 80),
        ("suppressing", "Running the suppression gauntlet", 100),
    ]

    async def event_generator():
        for stage_id, label, prog in stages:
            data = json.dumps({"stage": stage_id, "label": label, "progress": prog, "status": "running" if prog < 100 else "done"})
            yield f"data: {data}\n\n"
            await asyncio.sleep(0.1)

    return StreamingResponse(event_generator(), media_type="text/event-stream")
