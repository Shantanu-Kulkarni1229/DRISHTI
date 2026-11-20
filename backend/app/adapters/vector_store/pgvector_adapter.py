import math
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.adapters.vector_store.base import VectorStoreAdapter
from app.models.tile import Tile, TileEmbedding


class PGVectorAdapter(VectorStoreAdapter):
    """pgvector implementation supporting incremental HNSW index inserts and pre-filtering."""

    def __init__(self, db_session: Session):
        self.db = db_session

    def upsert_vector(
        self,
        organisation_id: str,
        tile_id: str,
        model_name: str,
        model_version: str,
        vector: List[float],
    ) -> None:
        existing = (
            self.db.query(TileEmbedding)
            .filter(
                TileEmbedding.organisation_id == organisation_id,
                TileEmbedding.tile_id == tile_id,
                TileEmbedding.model_name == model_name,
            )
            .first()
        )
        if existing:
            existing.embedding = vector
            existing.model_version = model_version
        else:
            emb = TileEmbedding(
                organisation_id=organisation_id,
                tile_id=tile_id,
                model_name=model_name,
                model_version=model_version,
                dimension=len(vector),
                embedding=vector,
            )
            self.db.add(emb)
        self.db.commit()

    def search_similar(
        self,
        organisation_id: str,
        model_name: str,
        query_vector: List[float],
        top_k: int = 24,
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[Tuple[str, float]]:
        filters = filters or {}
        # Check dialect
        dialect_name = self.db.bind.dialect.name if self.db.bind else "postgresql"

        if dialect_name == "postgresql":
            # Real pgvector cosine similarity search: 1 - (embedding <=> query_vector)
            sql = """
                SELECT te.tile_id, (1 - (te.embedding <=> CAST(:query_vec AS vector))) as similarity
                FROM tile_embeddings te
                JOIN tiles t ON te.tile_id = t.id AND te.organisation_id = t.organisation_id
                WHERE te.organisation_id = :org_id
                  AND te.model_name = :model_name
            """
            params: Dict[str, Any] = {
                "org_id": organisation_id,
                "model_name": model_name,
                "query_vec": str(query_vector),
                "limit": top_k,
            }

            if filters.get("aoi_id"):
                sql += " AND t.aoi_id = :aoi_id"
                params["aoi_id"] = filters["aoi_id"]
            if filters.get("date_from"):
                sql += " AND t.datetime >= :date_from"
                params["date_from"] = filters["date_from"]
            if filters.get("date_to"):
                sql += " AND t.datetime <= :date_to"
                params["date_to"] = filters["date_to"]
            if filters.get("max_cloud") is not None:
                sql += " AND (t.cloud_fraction * 100) <= :max_cloud"
                params["max_cloud"] = float(filters["max_cloud"])

            sql += " ORDER BY similarity DESC LIMIT :limit;"

            res = self.db.execute(text(sql), params).fetchall()
            return [(r[0], float(r[1])) for r in res]
        else:
            # Fallback for SQLite in unit tests: compute cosine similarity in Python
            q = (
                self.db.query(TileEmbedding.tile_id, TileEmbedding.embedding)
                .join(Tile, (TileEmbedding.tile_id == Tile.id) & (TileEmbedding.organisation_id == Tile.organisation_id))
                .filter(
                    TileEmbedding.organisation_id == organisation_id,
                    TileEmbedding.model_name == model_name,
                )
            )
            if filters.get("aoi_id"):
                q = q.filter(Tile.aoi_id == filters["aoi_id"])
            if filters.get("date_from"):
                q = q.filter(Tile.datetime >= filters["date_from"])
            if filters.get("date_to"):
                q = q.filter(Tile.datetime <= filters["date_to"])

            rows = q.all()
            scored: List[Tuple[str, float]] = []
            q_norm = math.sqrt(sum(x * x for x in query_vector)) or 1.0

            for tile_id, emb in rows:
                if not emb or not isinstance(emb, list):
                    continue
                dot = sum(a * b for a, b in zip(query_vector, emb))
                v_norm = math.sqrt(sum(x * x for x in emb)) or 1.0
                sim = dot / (q_norm * v_norm)
                scored.append((tile_id, sim))

            scored.sort(key=lambda x: x[1], reverse=True)
            return scored[:top_k]
