from typing import Dict, List, Optional
from sqlalchemy.orm import Session

from app.core.exceptions import EntityNotFoundError
from app.models.cluster import Cluster
from app.models.tile import Tile
from app.schemas.clusters import ClusterRenameRequest, ClusterResponse


class ClusteringService:
    def __init__(self, db: Session):
        self.db = db

    def list_clusters(self, organisation_id: str, aoi_id: Optional[str] = None) -> List[Cluster]:
        q = self.db.query(Cluster).filter(Cluster.organisation_id == organisation_id)
        if aoi_id:
            q = q.filter(Cluster.aoi_id == aoi_id)
        return q.all()

    def get_cluster(self, organisation_id: str, cluster_id: str) -> Cluster:
        cluster = (
            self.db.query(Cluster)
            .filter(Cluster.organisation_id == organisation_id, Cluster.id == cluster_id)
            .first()
        )
        if not cluster:
            raise EntityNotFoundError(f"Cluster {cluster_id} not found.")
        return cluster

    def rename_cluster(self, organisation_id: str, cluster_id: str, req: ClusterRenameRequest) -> Cluster:
        cluster = self.get_cluster(organisation_id, cluster_id)
        cluster.name = req.name
        cluster.is_saved = True
        self.db.commit()
        self.db.refresh(cluster)
        return cluster
