from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.export import ExportRequest, ExportResponse
from app.services.export.export_service import ExportService

router = APIRouter(prefix="/export", tags=["Export"])


@router.post("", response_model=ExportResponse, status_code=status.HTTP_201_CREATED)
def export_candidates(
    req: ExportRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = ExportService(db)
    return service.generate_export(organisation_id=str(current_user.organisation_id), req=req)


@router.get("/{export_id}")
def get_export_status(
    export_id: str,
    current_user: User = Depends(get_current_user),
):
    return {
        "export_id": export_id,
        "status": "ready",
        "download_url": f"/api/export/{export_id}/download",
    }
