from pathlib import Path
from typing import List, Optional

from app.adapters.embeddings.base import BaseEmbeddingAdapter
from app.core.config import get_settings
from app.core.exceptions import ModelNotAvailableError
from app.core.logging import get_logger

logger = get_logger(__name__)


class RemoteCLIPAdapter(BaseEmbeddingAdapter):
    """Adapter for RemoteCLIP ViT model weights staged offline."""

    def __init__(self, model_path: Optional[Path] = None):
        settings = get_settings()
        self.model_path = Path(model_path or settings.REMOTECLIP_MODEL_PATH)
        self.dimension = 512  # RemoteCLIP ViT-B-32 produces 512-dim normalized embeddings
        self._model = None
        self._preprocess = None
        self._tokenizer = None

    def _find_checkpoint(self) -> Optional[Path]:
        if not self.model_path:
            return None
        if self.model_path.is_file():
            return self.model_path
        if self.model_path.is_dir():
            candidates = (
                list(self.model_path.glob("*.pt"))
                + list(self.model_path.glob("*.bin"))
                + list(self.model_path.glob("*.safetensors"))
            )
            if candidates:
                return candidates[0]
        return None

    def is_available(self) -> bool:
        """Checks for local checkpoint existence without network calls."""
        return self._find_checkpoint() is not None

    def get_dimension(self) -> int:
        return self.dimension

    def _ensure_loaded(self) -> None:
        if self._model is not None:
            return
        ckpt_path = self._find_checkpoint()
        if not ckpt_path:
            raise ModelNotAvailableError(
                "RemoteCLIP weights not found locally in MODEL_ROOT. Offline inference unavailable.",
                {"expected_path": str(self.model_path), "model": "RemoteCLIP-ViT-B-32"},
            )
        try:
            import open_clip
            import torch

            logger.info("loading_remoteclip_model checkpoint=%s", str(ckpt_path))
            model, _, preprocess = open_clip.create_model_and_transforms("ViT-B-32")
            state_dict = torch.load(str(ckpt_path), map_location="cpu")
            if "state_dict" in state_dict:
                state_dict = state_dict["state_dict"]
            model.load_state_dict(state_dict, strict=True)
            model.eval()

            self._model = model
            self._preprocess = preprocess
            self._tokenizer = open_clip.get_tokenizer("ViT-B-32")
            logger.info("remoteclip_loaded_successfully dimension=%d", self.dimension)
        except Exception as exc:
            logger.error("remoteclip_load_failed: %s", str(exc))
            raise ModelNotAvailableError(
                f"Failed to load RemoteCLIP weights: {exc}",
                {"checkpoint": str(ckpt_path)},
            ) from exc

    def embed_text(self, text: str) -> List[float]:
        self._ensure_loaded()
        import torch

        tokens = self._tokenizer([text])
        with torch.no_grad():
            feat = self._model.encode_text(tokens)
            feat = feat / feat.norm(dim=-1, keepdim=True)
        return feat[0].cpu().tolist()

    def embed_image(self, image_bytes: bytes) -> List[float]:
        self._ensure_loaded()
        import io
        import torch
        from PIL import Image

        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        tensor = self._preprocess(image).unsqueeze(0)
        with torch.no_grad():
            feat = self._model.encode_image(tensor)
            feat = feat / feat.norm(dim=-1, keepdim=True)
        return feat[0].cpu().tolist()
