from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.clusters import ClusterRenameRequest, ClusterResponse
from app.services.discovery.clustering_service import ClusteringService

router = APIRouter(prefix="/clusters", tags=["Discovery"])


@router.get("", response_model=List[ClusterResponse])
def get_clusters(
    aoi_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = ClusteringService(db)
    clusters = service.list_clusters(organisation_id=str(current_user.organisation_id), aoi_id=aoi_id)
    return [
        ClusterResponse(
            id=c.id,
            name=c.name,
            is_saved=c.is_saved,
            member_tile_ids=c.member_tile_ids or [],
            color=c.color,
            centroid_2d=c.centroid_2d,
        )
        for c in clusters
    ]


@router.get("/{cluster_id}", response_model=ClusterResponse)
def get_cluster(
    cluster_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = ClusteringService(db)
    c = service.get_cluster(organisation_id=str(current_user.organisation_id), cluster_id=cluster_id)
    return ClusterResponse(
        id=c.id,
        name=c.name,
        is_saved=c.is_saved,
        member_tile_ids=c.member_tile_ids or [],
        color=c.color,
        centroid_2d=c.centroid_2d,
    )


@router.post("/{cluster_id}/name", response_model=ClusterResponse)
def rename_cluster(
    cluster_id: str,
    req: ClusterRenameRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = ClusteringService(db)
    c = service.rename_cluster(organisation_id=str(current_user.organisation_id), cluster_id=cluster_id, req=req)
    return ClusterResponse(
        id=c.id,
        name=c.name,
        is_saved=c.is_saved,
        member_tile_ids=c.member_tile_ids or [],
        color=c.color,
        centroid_2d=c.centroid_2d,
    )
