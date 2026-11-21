import math
import uuid
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.adapters.vector_store.pgvector_adapter import PGVectorAdapter
from app.core.exceptions import EntityNotFoundError
from app.core.logging import get_logger
from app.models.cluster import Cluster
from app.models.tile import Tile, TileEmbedding
from app.schemas.clusters import ClusterRenameRequest

logger = get_logger(__name__)

CLUSTER_PALETTE = [
    "#81a1c1",  # Arctic Blue
    "#88c0d0",  # Frost Cyan
    "#8fbcbb",  # Polar Green
    "#a3be8c",  # Olive Green
    "#ebcb8b",  # Amber Yellow
    "#d08770",  # Clay Orange
    "#bf616a",  # Crimson Red
    "#b48ead",  # Dusk Purple
    "#5e81ac",  # Deep Navy
    "#4c566a",  # Slate Gray
]


class ClusteringService:
    def __init__(self, db: Session):
        self.db = db
        self.vector_store = PGVectorAdapter(db)

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

    def get_similar_tiles(
        self,
        organisation_id: str,
        tile_id: str,
        k: int = 12,
        space: str = "dino",
    ) -> List[Tile]:
        """Finds structurally or semantically similar tiles via pgvector cosine distance."""
        tile = (
            self.db.query(Tile)
            .filter(Tile.id == tile_id, Tile.organisation_id == organisation_id)
            .first()
        )
        if not tile:
            raise EntityNotFoundError(f"Tile {tile_id} not found.")

        model_name = "dinov2" if space.lower() == "dino" else "remoteclip"
        embedding_record = (
            self.db.query(TileEmbedding)
            .filter(
                TileEmbedding.tile_id == tile_id,
                TileEmbedding.organisation_id == organisation_id,
                TileEmbedding.model_name == model_name,
            )
            .first()
        )

        if embedding_record and embedding_record.embedding:
            # Query vector store for top k + 1 (excluding self)
            scored = self.vector_store.search_similar(
                organisation_id=organisation_id,
                model_name=model_name,
                query_vector=embedding_record.embedding,
                top_k=k + 5,
            )
            scored_ids = [tid for tid, _ in scored if tid != tile_id][:k]
            if scored_ids:
                tiles_by_id = {
                    t.id: t
                    for t in self.db.query(Tile)
                    .filter(Tile.id.in_(scored_ids), Tile.organisation_id == organisation_id)
                    .all()
                }
                # Preserve rank ordering
                ordered = [tiles_by_id[tid] for tid in scored_ids if tid in tiles_by_id]
                if ordered:
                    return ordered

        # Fallback: cluster co-members or nearest AOI tiles
        fallback_query = self.db.query(Tile).filter(
            Tile.organisation_id == organisation_id,
            Tile.id != tile_id,
        )
        if tile.cluster_id:
            fallback_query = fallback_query.filter(Tile.cluster_id == tile.cluster_id)
        elif tile.aoi_id:
            fallback_query = fallback_query.filter(Tile.aoi_id == tile.aoi_id)
        return fallback_query.limit(k).all()

    def compute_clusters_and_projections(
        self,
        organisation_id: str,
        aoi_id: Optional[str] = None,
        min_cluster_size: int = 3,
        n_neighbors: int = 15,
        min_dist: float = 0.1,
        model_name: str = "dinov2",
    ) -> List[Cluster]:
        """Computes 2D UMAP/PCA projections and HDBSCAN/DBSCAN clusters over tile embeddings."""
        q = (
            self.db.query(Tile, TileEmbedding)
            .join(
                TileEmbedding,
                (Tile.id == TileEmbedding.tile_id)
                & (Tile.organisation_id == TileEmbedding.organisation_id),
            )
            .filter(
                Tile.organisation_id == organisation_id,
                TileEmbedding.model_name == model_name,
            )
        )
        if aoi_id:
            q = q.filter(Tile.aoi_id == aoi_id)

        rows = q.all()
        if not rows:
            logger.info("No tile embeddings found for clustering org=%s aoi=%s", organisation_id, aoi_id)
            return []

        tiles: List[Tile] = [r[0] for r in rows]
        embeddings: List[List[float]] = [r[1].embedding for r in rows if r[1].embedding is not None]
        n_tiles = len(tiles)

        if n_tiles < 2 or len(embeddings) != n_tiles:
            # Degenerate case: single tile or missing embeddings
            for t in tiles:
                t.embedding_2d = [0.0, 0.0]
            self.db.commit()
            return []

        X = np.array(embeddings, dtype=np.float32)

        # 1. 2D Dimensionality Reduction (UMAP -> Scikit-learn PCA -> NumPy SVD PCA)
        coords_2d = self._project_2d(X, n_neighbors=n_neighbors, min_dist=min_dist)

        for i, t in enumerate(tiles):
            t.embedding_2d = [round(float(coords_2d[i, 0]), 4), round(float(coords_2d[i, 1]), 4)]

        # 2. Density-based Clustering (HDBSCAN -> DBSCAN -> Connected Components)
        labels = self._cluster_embeddings(coords_2d, min_cluster_size=min_cluster_size)

        # 3. Form Cluster Records & Centroids
        unique_labels = sorted(list(set(labels)))
        clusters_formed: List[Cluster] = []
        cluster_idx = 0

        # Remove previous unsaved clusters for this AOI/org
        unsaved_q = self.db.query(Cluster).filter(
            Cluster.organisation_id == organisation_id,
            Cluster.is_saved.is_(False),
        )
        if aoi_id:
            unsaved_q = unsaved_q.filter(Cluster.aoi_id == aoi_id)
        unsaved_q.delete(synchronize_session=False)

        for lbl in unique_labels:
            if lbl < 0:
                # Noise / unassigned
                continue

            member_indices = [i for i, l in enumerate(labels) if l == lbl]
            member_tiles = [tiles[i] for i in member_indices]
            member_coords = coords_2d[member_indices]

            centroid = [
                round(float(np.mean(member_coords[:, 0])), 4),
                round(float(np.mean(member_coords[:, 1])), 4),
            ]
            member_ids = [t.id for t in member_tiles]

            cluster_id = f"clust-{uuid.uuid4().hex[:8]}"
            color = CLUSTER_PALETTE[cluster_idx % len(CLUSTER_PALETTE)]
            cluster_name = f"Cluster {cluster_idx + 1:02d}"

            cluster = Cluster(
                id=cluster_id,
                organisation_id=organisation_id,
                name=cluster_name,
                is_saved=False,
                algorithm="HDBSCAN",
                algorithm_version="0.8.38",
                parameters={"min_cluster_size": min_cluster_size},
                centroid_2d=centroid,
                member_tile_ids=member_ids,
                color=color,
                aoi_id=aoi_id,
            )
            self.db.add(cluster)

            for t in member_tiles:
                t.cluster_id = cluster_id

            clusters_formed.append(cluster)
            cluster_idx += 1

        self.db.commit()
        for c in clusters_formed:
            self.db.refresh(c)

        logger.info(
            "Clustering completed: tiles=%d clusters=%d org=%s",
            n_tiles,
            len(clusters_formed),
            organisation_id,
        )
        return clusters_formed

    def _project_2d(self, X: np.ndarray, n_neighbors: int = 15, min_dist: float = 0.1) -> np.ndarray:
        """Projects high-dimensional embeddings to 2D using UMAP or SVD PCA."""
        n_samples = X.shape[0]

        # Try UMAP
        try:
            import umap  # type: ignore

            reducer = umap.UMAP(
                n_neighbors=min(n_neighbors, max(2, n_samples - 1)),
                min_dist=min_dist,
                n_components=2,
                metric="cosine",
                random_state=42,
            )
            return reducer.fit_transform(X)
        except Exception:
            pass

        # Try Scikit-learn PCA
        try:
            from sklearn.decomposition import PCA  # type: ignore

            pca = PCA(n_components=2, random_state=42)
            return pca.fit_transform(X)
        except Exception:
            pass

        # Robust pure NumPy SVD PCA fallback
        X_centered = X - np.mean(X, axis=0, keepdims=True)
        _, _, Vt = np.linalg.svd(X_centered, full_matrices=False)
        proj = X_centered @ Vt[:2].T
        return proj

    def _cluster_embeddings(self, coords_2d: np.ndarray, min_cluster_size: int = 3) -> List[int]:
        """Clusters 2D coordinates using HDBSCAN, DBSCAN, or spatial thresholding."""
        n_samples = coords_2d.shape[0]

        # Try HDBSCAN (scikit-learn or hdbscan)
        try:
            from sklearn.cluster import HDBSCAN  # type: ignore

            clusterer = HDBSCAN(
                min_cluster_size=min(min_cluster_size, max(2, n_samples // 2)),
                metric="euclidean",
            )
            return list(clusterer.fit_predict(coords_2d))
        except Exception:
            pass

        try:
            import hdbscan  # type: ignore

            clusterer = hdbscan.HDBSCAN(
                min_cluster_size=min(min_cluster_size, max(2, n_samples // 2)),
                metric="euclidean",
            )
            return list(clusterer.fit_predict(coords_2d))
        except Exception:
            pass

        # Try DBSCAN
        try:
            from sklearn.cluster import DBSCAN  # type: ignore

            clusterer = DBSCAN(eps=1.5, min_samples=min(2, max(2, n_samples // 3)))
            return list(clusterer.fit_predict(coords_2d))
        except Exception:
            pass

        # Pure NumPy distance-based clustering fallback
        return self._numpy_dbscan(coords_2d, eps=1.5, min_samples=min(2, max(2, n_samples // 3)))

    def _numpy_dbscan(self, X: np.ndarray, eps: float = 1.5, min_samples: int = 2) -> List[int]:
        """Minimal self-contained density clustering fallback."""
        n = X.shape[0]
        labels = [-1] * n
        cluster_id = 0

        # Pairwise euclidean distances
        diffs = X[:, np.newaxis, :] - X[np.newaxis, :, :]
        dist_matrix = np.sqrt(np.sum(diffs**2, axis=-1))

        visited = [False] * n

        for i in range(n):
            if visited[i]:
                continue
            visited[i] = True
            neighbors = [j for j in range(n) if dist_matrix[i, j] <= eps]

            if len(neighbors) < min_samples:
                labels[i] = -1
            else:
                labels[i] = cluster_id
                queue = list(neighbors)
                while queue:
                    curr = queue.pop(0)
                    if not visited[curr]:
                        visited[curr] = True
                        curr_neighbors = [j for j in range(n) if dist_matrix[curr, j] <= eps]
                        if len(curr_neighbors) >= min_samples:
                            queue.extend(curr_neighbors)
                    if labels[curr] == -1 or labels[curr] is None:
                        labels[curr] = cluster_id
                cluster_id += 1

        # If all noise, assign top grouping
        if all(lbl == -1 for lbl in labels) and n > 1:
            labels = [0] * n

        return labels
