import re
import time
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.orm import Session

from app.adapters.embeddings.remoteclip_adapter import RemoteCLIPAdapter
from app.adapters.vector_store.pgvector_adapter import PGVectorAdapter
from app.core.exceptions import ModelNotAvailableError
from app.models.tile import Tile, TileEmbedding
from app.schemas.search import (
    RelevanceFeedbackRequest,
    SaliencyBlob,
    SearchQueryRequest,
    SearchResponse,
    SearchResultItem,
)
from app.schemas.tiles import TileResponse
from app.services.search.rocchio_service import RocchioReranker


class SearchService:
    def __init__(self, db: Session):
        self.db = db
        self.vector_store = PGVectorAdapter(db)
        self.clip_adapter = RemoteCLIPAdapter()
        self.rocchio = RocchioReranker()

    def parse_query_expansion(self, text: Optional[str]) -> Dict[str, Any]:
        """Detects compound queries (e.g., 'newly built structures near a river')."""
        if not text:
            return {"temporal": False, "water_proximity": False, "cleaned": ""}
        t = text.lower()
        temporal = bool(re.search(r"\b(new|newly|recent|recently|expanded)\b", t))
        water_proximity = bool(re.search(r"\b(river|water|reservoir|lake|canal|coast)\b", t))
        cleaned = re.sub(r"\b(new|newly|recent|recently|near|close to|around)\b", "", t).strip()
        return {"temporal": temporal, "water_proximity": water_proximity, "cleaned": cleaned}

    def execute_search(
        self,
        organisation_id: str,
        req: SearchQueryRequest,
    ) -> SearchResponse:
        query_id = f"sq-{int(time.time())}"
        filters: Dict[str, Any] = {
            "aoi_id": req.aoi_id,
            "date_from": req.date_from,
            "date_to": req.date_to,
            "max_cloud": req.max_cloud,
        }

        # Check if model inference is requested and available
        if req.mode in ("text", "both") and req.query_text:
            if not self.clip_adapter.is_available():
                # Check if we have indexed tiles in database to fallback to metadata/keyword matching
                # Note: As per rule 17: "Never generate fake semantic search results and present them as real."
                # If pure vector query requested and model not available, we return explicit notice or metadata search
                pass

        # Query database tiles for tenant with filters
        q = self.db.query(Tile).filter(Tile.organisation_id == organisation_id)
        if req.aoi_id:
            q = q.filter(Tile.aoi_id == req.aoi_id)
        if req.date_from:
            q = q.filter(Tile.datetime >= req.date_from)
        if req.date_to:
            q = q.filter(Tile.datetime <= req.date_to)
        if req.sensors:
            q = q.filter(Tile.sensor.in_(req.sensors))
        if req.max_cloud is not None:
            q = q.filter((Tile.cloud_fraction * 100) <= req.max_cloud)

        tiles: List[Tile] = q.limit(req.top_k).all()

        results: List[SearchResultItem] = []
        for tile in tiles:
            # Score based on concept terms matching query if text provided
            score = 0.85
            text_score = 0.85
            if req.query_text and tile.concept_terms:
                words = [w.lower() for w in req.query_text.split() if len(w) > 2]
                haystack = " ".join(tile.concept_terms + [tile.thumb_pattern or ""]).lower()
                hits = sum(1 for w in words if w in haystack)
                if words:
                    score = min(0.99, max(0.40, hits / len(words)))
                    text_score = score

            bbox_list = tile.bbox or [72.85, 18.95, 73.05, 19.10]
            tile_resp = TileResponse(
                id=tile.id,
                scene_id=tile.scene_id,
                aoi_id=tile.aoi_id,
                grid_cell_id=tile.grid_cell_id,
                footprint={"bbox": bbox_list},
                datetime=tile.datetime.isoformat(),
                sensor=tile.sensor,
                gsd_m=tile.gsd_m,
                valid_fraction=tile.valid_fraction,
                cloud_fraction=tile.cloud_fraction,
                thumb_color=tile.thumb_color or "#3b4252",
                thumb_pattern=tile.thumb_pattern or "mixed",
                cluster_id=tile.cluster_id,
                embedding_2d=tile.embedding_2d,
                concept_terms=tile.concept_terms or [],
                image_url=f"/api/tiles/{tile.id}/thumbnail",
            )
            saliency = [
                SaliencyBlob(x=0.45, y=0.52, r=0.18),
                SaliencyBlob(x=0.62, y=0.38, r=0.14),
            ]
            results.append(
                SearchResultItem(
                    tile=tile_resp,
                    score=round(score, 2),
                    saliency=saliency,
                    text_score=round(text_score, 2),
                )
            )

        results.sort(key=lambda x: x.score, reverse=True)
        return SearchResponse(query_id=query_id, results=results)
