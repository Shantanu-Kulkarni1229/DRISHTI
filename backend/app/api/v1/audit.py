from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.audit import AuditRecordResponse
from app.services.audit.audit_service import AuditService

router = APIRouter(prefix="/audit", tags=["Audit Log"])


@router.get("", response_model=List[AuditRecordResponse])
def get_audit_trail(
    actor: Optional[str] = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = AuditService(db)
    records = service.list_records(
        organisation_id=str(current_user.organisation_id),
        limit=limit,
        offset=offset,
        actor=actor,
    )
    return [
        AuditRecordResponse(
            id=str(r.id),
            actor_name=r.actor_name,
            action=r.action,
            target_type=r.target_type,
            target_id=r.target_id,
            payload=r.payload,
            model_versions=r.model_versions,
            created_at=r.created_at.isoformat(),
            previous_hash=r.previous_hash,
            record_hash=r.record_hash,
        )
        for r in records
    ]


@router.get("/verify")
def verify_audit_trail(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    service = AuditService(db)
    return service.verify_chain(organisation_id=str(current_user.organisation_id))
