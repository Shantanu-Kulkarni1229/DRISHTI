import time
from pathlib import Path
from typing import Any, Dict, Optional, Union

from app.adapters.descriptions.base import BaseDescriptionAdapter
from app.core.logging import get_logger

logger = get_logger(__name__)


class CactusMirageAdapter(BaseDescriptionAdapter):
    """Adapter for Cactus Mirage on-device vision description engine."""

    def __init__(self):
        self._model = None
        self._available = False
        self._init_error = None
        self._check_availability()

    def _check_availability(self):
        try:
            import cactus
            self._available = True
        except ImportError as e:
            self._available = False
            self._init_error = str(e)
            logger.warning("cactus-compute is not installed: %s", e)

    def is_available(self) -> bool:
        return self._available

    def _get_engine(self):
        if self._model is None and self._available:
            import cactus
            self._model = cactus.Mirage()
        return self._model

    def describe_image(self, image_input: Union[str, Path, bytes]) -> Dict[str, Any]:
        """Runs image description using Cactus Mirage and returns structured results."""
        if not self.is_available():
            return {
                "success": False,
                "error": f"Cactus Mirage unavailable: {self._init_error}",
                "inference_ms": 0.0,
                "scene": {},
                "objects": [],
                "reasoning": "",
            }

        engine = self._get_engine()
        t0 = time.perf_counter()
        try:
            # If path is given as Path object, convert to string
            if isinstance(image_input, Path):
                image_input = str(image_input)

            res = engine.describe(image_input)
            elapsed_ms = (time.perf_counter() - t0) * 1000.0

            return {
                "success": True,
                "inference_ms": round(elapsed_ms, 2),
                "scene": res.get("scene", {}),
                "objects": res.get("objects", []),
                "reasoning": res.get("reasoning", ""),
                "raw": res,
            }
        except Exception as e:
            elapsed_ms = (time.perf_counter() - t0) * 1000.0
            logger.error("Cactus Mirage inference failed: %s", e)
            return {
                "success": False,
                "error": str(e),
                "inference_ms": round(elapsed_ms, 2),
                "scene": {},
                "objects": [],
                "reasoning": "",
            }
