from pathlib import Path
from typing import BinaryIO, Optional
import os

from app.adapters.storage.base import StorageAdapter
from app.core.config import get_settings


class LocalStorageAdapter(StorageAdapter):
    """Local filesystem implementation with sandboxed directory validation."""

    def __init__(self, root_dir: Optional[Path] = None):
        settings = get_settings()
        self.root_dir = (root_dir or settings.DATA_ROOT).resolve()
        try:
            self.root_dir.mkdir(parents=True, exist_ok=True)
        except OSError:
            pass

    def _resolve_safe_path(self, relative_path: str) -> Path:
        """Ensures the resolved path stays within the designated storage root."""
        clean_rel = relative_path.lstrip("/\\")
        target = (self.root_dir / clean_rel).resolve()
        if not str(target).startswith(str(self.root_dir)):
            raise ValueError(f"Path traversal attempt detected: {relative_path}")
        return target

    def save_bytes(self, relative_path: str, data: bytes) -> str:
        target = self._resolve_safe_path(relative_path)
        target.parent.mkdir(parents=True, exist_ok=True)
        # Write atomically using a temporary file in the same directory
        temp_target = target.with_suffix(f"{target.suffix}.tmp")
        with open(temp_target, "wb") as f:
            f.write(data)
        os.replace(temp_target, target)
        return str(target.relative_to(self.root_dir)).replace("\\", "/")

    def read_bytes(self, relative_path: str) -> bytes:
        target = self._resolve_safe_path(relative_path)
        if not target.is_file():
            raise FileNotFoundError(f"Stored file not found: {relative_path}")
        with open(target, "rb") as f:
            return f.read()

    def exists(self, relative_path: str) -> bool:
        try:
            target = self._resolve_safe_path(relative_path)
            return target.is_file()
        except ValueError:
            return False

    def get_absolute_path(self, relative_path: str) -> Path:
        return self._resolve_safe_path(relative_path)
