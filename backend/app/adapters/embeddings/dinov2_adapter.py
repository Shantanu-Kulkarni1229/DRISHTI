from pathlib import Path
from typing import List, Optional

from app.adapters.embeddings.base import BaseEmbeddingAdapter
from app.core.config import get_settings
from app.core.exceptions import ModelNotAvailableError
from app.core.logging import get_logger

logger = get_logger(__name__)


class DINOv2Adapter(BaseEmbeddingAdapter):
    """Adapter for DINOv2 ViT-S/14 model weights staged offline."""

    def __init__(self, model_path: Optional[Path] = None):
        settings = get_settings()
        self.model_path = Path(model_path or settings.DINOV2_MODEL_PATH)
        self.dimension = 384  # DINOv2 ViT-S/14 produces 384-dim normalized embeddings
        self._model = None
        self._transform = None

    def _find_checkpoint(self) -> Optional[Path]:
        if not self.model_path:
            return None
        if self.model_path.is_file():
            return self.model_path
        if self.model_path.is_dir():
            candidates = (
                list(self.model_path.glob("*.pth"))
                + list(self.model_path.glob("*.pt"))
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
                "DINOv2 weights not found locally in MODEL_ROOT. Offline visual embedding unavailable.",
                {"expected_path": str(self.model_path), "model": "DINOv2-ViT-S/14"},
            )
        try:
            import timm
            import torch
            import torchvision.transforms as T

            logger.info("loading_dinov2_model checkpoint=%s", str(ckpt_path))
            model = timm.create_model("vit_small_patch14_dinov2", dynamic_img_size=True, pretrained=False, num_classes=0)
            state_dict = torch.load(str(ckpt_path), map_location="cpu")
            if "state_dict" in state_dict:
                state_dict = state_dict["state_dict"]
            state_dict.pop("mask_token", None)
            model.load_state_dict(state_dict, strict=True)
            model.eval()

            self._model = model
            self._transform = T.Compose([
                T.Resize((224, 224), interpolation=T.InterpolationMode.BICUBIC),
                T.ToTensor(),
                T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
            ])
            logger.info("dinov2_loaded_successfully dimension=%d", self.dimension)
        except Exception as exc:
            logger.error("dinov2_load_failed: %s", str(exc))
            raise ModelNotAvailableError(
                f"Failed to load DINOv2 weights: {exc}",
                {"checkpoint": str(ckpt_path)},
            ) from exc

    def embed_text(self, text: str) -> List[float]:
        raise NotImplementedError("DINOv2 is a vision-only transformer; embed_text is not supported.")

    def embed_image(self, image_bytes: bytes) -> List[float]:
        self._ensure_loaded()
        import io
        import torch
        from PIL import Image

        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        tensor = self._transform(image).unsqueeze(0)
        with torch.no_grad():
            feat = self._model(tensor)
            feat = feat / feat.norm(dim=-1, keepdim=True)
        return feat[0].cpu().tolist()
