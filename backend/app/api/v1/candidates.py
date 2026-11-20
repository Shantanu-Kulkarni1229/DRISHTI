from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.exceptions import EntityNotFoundError
from app.db.session import get_db
from app.models.change import ChangeCandidate
from app.models.user import User
from app.schemas.candidates import (
    ChangeCandidateResponse,
    DecisionCreateRequest,
    DecisionResponse,
    EarliestObservationResponse,
    SuppressionFactor,
)
from app.schemas.common import LngLat
from app.services.change_detection.change_service import ChangeService

router = APIRouter(prefix="/candidates", tags=["Candidates"])


@router.get("", response_model=List[ChangeCandidateResponse])
def list_candidates(
    job_id: Optional[str] = None,
    status_filter: Optional[str] = Query(default=None, alias="status"),
    type_filter: Optional[str] = Query(default=None, alias="type"),
    min_confidence: Optional[float] = Query(default=None, alias="min_conf"),
    aoi_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(ChangeCandidate).filter(ChangeCandidate.organisation_id == current_user.organisation_id)
    if job_id:
        q = q.filter(ChangeCandidate.job_id == job_id)
    if status_filter:
        q = q.filter(ChangeCandidate.review_status == status_filter)
    if type_filter:
        q = q.filter(ChangeCandidate.change_type == type_filter)
    if min_confidence is not None:
        q = q.filter(ChangeCandidate.confidence >= min_confidence)
    if aoi_id:
        q = q.filter(ChangeCandidate.aoi_id == aoi_id)

    candidates = q.order_by(ChangeCandidate.confidence.desc()).offset(offset).limit(limit).all()

    results: List[ChangeCandidateResponse] = []
    for c in candidates:
        factors = [SuppressionFactor(**f) for f in (c.confidence_factors or [])]
        center = LngLat(**c.geom_center) if c.geom_center else LngLat(lng=(c.bbox[0] + c.bbox[2]) / 2, lat=(c.bbox[1] + c.bbox[3]) / 2)
        results.append(
            ChangeCandidateResponse(
                id=c.id,
                aoi_id=c.aoi_id,
                grid_cell_id=c.grid_cell_id,
                tile_before_id=c.tile_before_id,
                tile_after_id=c.tile_after_id,
                geom_center=center,
                bbox=c.bbox or [72.85, 18.95, 73.05, 19.10],
                area_m2=c.area_m2,
                type=c.change_type,
                direction=c.direction,
                score=c.score,
                confidence=c.confidence,
                factors=factors,
                status=c.review_status,
                reject_reason=c.reject_reason,
                suppression_reason=c.suppression_reason,
                assignee=c.assignee,
                earliest_interval_start=c.earliest_interval_start or "2021-02-14",
                earliest_interval_end=c.earliest_interval_end or "2021-03-10",
                revisit_gap_days=c.revisit_gap_days or 24,
                job_id=c.job_id,
                registration_residual_px=c.registration_residual_px,
                seasonal_z_score=c.seasonal_z_score,
                sar_agreement=c.sar_agreement,
                headline=c.headline,
                narrative=c.narrative,
            )
        )
    return results


@router.get("/{candidate_id}", response_model=ChangeCandidateResponse)
def get_candidate_detail(
    candidate_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    c = (
        db.query(ChangeCandidate)
        .filter(ChangeCandidate.id == candidate_id, ChangeCandidate.organisation_id == current_user.organisation_id)
        .first()
    )
    if not c:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Candidate {candidate_id} not found.")

    factors = [SuppressionFactor(**f) for f in (c.confidence_factors or [])]
    center = LngLat(**c.geom_center) if c.geom_center else LngLat(lng=(c.bbox[0] + c.bbox[2]) / 2, lat=(c.bbox[1] + c.bbox[3]) / 2)

    return ChangeCandidateResponse(
        id=c.id,
        aoi_id=c.aoi_id,
        grid_cell_id=c.grid_cell_id,
        tile_before_id=c.tile_before_id,
        tile_after_id=c.tile_after_id,
        geom_center=center,
        bbox=c.bbox or [72.85, 18.95, 73.05, 19.10],
        area_m2=c.area_m2,
        type=c.change_type,
        direction=c.direction,
        score=c.score,
        confidence=c.confidence,
        factors=factors,
        status=c.review_status,
        reject_reason=c.reject_reason,
        suppression_reason=c.suppression_reason,
        assignee=c.assignee,
        earliest_interval_start=c.earliest_interval_start or "2021-02-14",
        earliest_interval_end=c.earliest_interval_end or "2021-03-10",
        revisit_gap_days=c.revisit_gap_days or 24,
        job_id=c.job_id,
        registration_residual_px=c.registration_residual_px,
        seasonal_z_score=c.seasonal_z_score,
        sar_agreement=c.sar_agreement,
        headline=c.headline,
        narrative=c.narrative,
    )


@router.get("/{candidate_id}/earliest", response_model=EarliestObservationResponse)
def get_earliest_observation(
    candidate_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    c = (
        db.query(ChangeCandidate)
        .filter(ChangeCandidate.id == candidate_id, ChangeCandidate.organisation_id == current_user.organisation_id)
        .first()
    )
    if not c:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Candidate {candidate_id} not found.")

    return EarliestObservationResponse(
        candidate_id=c.id,
        earliest_interval_start=c.earliest_interval_start or "2021-02-14",
        earliest_interval_end=c.earliest_interval_end or "2021-03-10",
        revisit_gap_days=c.revisit_gap_days or 24,
        cloud_gap_detected=c.revisit_gap_days > 14,
    )


@router.post("/{candidate_id}/decision", response_model=DecisionResponse)
def record_candidate_decision(
    candidate_id: str,
    req: DecisionCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = ChangeService(db)
    decision = service.record_decision(
        organisation_id=str(current_user.organisation_id),
        candidate_id=candidate_id,
        actor_id=str(current_user.id),
        actor_name=current_user.display_name,
        req=req,
    )
    return DecisionResponse(
        id=decision.id,
        candidate_id=decision.candidate_id,
        actor_name=decision.actor_name,
        verdict=decision.verdict,
        reason_code=decision.reason_code,
        note=decision.note,
        created_at=decision.created_at.isoformat(),
    )
