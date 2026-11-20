from abc import ABC, abstractmethod
from pathlib import Path
from typing import List, Optional


class BaseEmbeddingAdapter(ABC):
    """Abstract interface for offline vision and language embedding models."""

    @abstractmethod
    def is_available(self) -> bool:
        """Checks if local offline model weights exist and are loadable."""
        pass

    @abstractmethod
    def get_dimension(self) -> int:
        """Returns the output vector dimensionality."""
        pass

    @abstractmethod
    def embed_text(self, text: str) -> List[float]:
        """Encodes text query into embedding space."""
        pass

    @abstractmethod
    def embed_image(self, image_bytes: bytes) -> List[float]:
        """Encodes image raster crop into embedding space."""
        pass
