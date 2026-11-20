from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Tuple


class VectorStoreAdapter(ABC):
    """Abstract interface for vector similarity search."""

    @abstractmethod
    def upsert_vector(
        self,
        organisation_id: str,
        tile_id: str,
        model_name: str,
        model_version: str,
        vector: List[float],
    ) -> None:
        """Inserts or updates an embedding vector without rebuilding index."""
        pass

    @abstractmethod
    def search_similar(
        self,
        organisation_id: str,
        model_name: str,
        query_vector: List[float],
        top_k: int = 24,
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[Tuple[str, float]]:
        """Returns list of (tile_id, similarity_score)."""
        pass
