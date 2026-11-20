from pathlib import Path
from typing import List, Optional

from app.adapters.embeddings.base import BaseEmbeddingAdapter
from app.core.config import get_settings
from app.core.exceptions import ModelNotAvailableError
from app.core.logging import get_logger

logger = get_logger(__name__)


class DINOv2Adapter(BaseEmbeddingAdapter):
    """Adapter for DINOv2 ViT-B/14 model weights staged offline."""

    def __init__(self, model_path: Optional[Path] = None):
        settings = get_settings()
        self.model_path = model_path or settings.DINOV2_MODEL_PATH
        self.dimension = settings.VECTOR_DIMENSION_DINO
        self._model = None

    def is_available(self) -> bool:
        """Checks for local checkpoint existence without network calls."""
        if not self.model_path:
            return False
        path = Path(self.model_path)
        if not path.exists():
            return False
        weight_files = list(path.glob("*.pt")) + list(path.glob("*.bin")) + list(path.glob("*.safetensors"))
        return len(weight_files) > 0

    def get_dimension(self) -> int:
        return self.dimension

    def embed_text(self, text: str) -> List[float]:
        raise NotImplementedError("DINOv2 is a vision-only transformer; embed_text is not supported.")

    def embed_image(self, image_bytes: bytes) -> List[float]:
        if not self.is_available():
            raise ModelNotAvailableError(
                "DINOv2 weights not found locally in MODEL_ROOT. Offline visual embedding unavailable.",
                {"expected_path": str(self.model_path), "model": "DINOv2-ViT-B/14"},
            )
        raise NotImplementedError("Model weights found but runtime weights loading requires PyTorch staging.")
