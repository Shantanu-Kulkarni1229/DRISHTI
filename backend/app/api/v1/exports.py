from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.exceptions import EntityNotFoundError
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


@router.get("/{export_id}/download")
def download_export(
    export_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = ExportService(db)
    try:
        content, filename, media_type = service.get_export_file(export_id)
    except EntityNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{export_id}/manifest")
def get_export_manifest(
    export_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = ExportService(db)
    try:
        return service.get_export_manifest(export_id)
    except EntityNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/{export_id}")
def get_export_status(
    export_id: str,
    current_user: User = Depends(get_current_user),
):
    return {
        "export_id": export_id,
        "status": "ready",
        "download_url": f"/api/export/{export_id}/download",
        "manifest_url": f"/api/export/{export_id}/manifest",
    }
