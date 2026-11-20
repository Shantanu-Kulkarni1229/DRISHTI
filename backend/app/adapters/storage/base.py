from abc import ABC, abstractmethod
from pathlib import Path
from typing import BinaryIO, Optional


class StorageAdapter(ABC):
    """Abstract interface for object/blob storage."""

    @abstractmethod
    def save_bytes(self, relative_path: str, data: bytes) -> str:
        """Saves byte content and returns storage URI/path."""
        pass

    @abstractmethod
    def read_bytes(self, relative_path: str) -> bytes:
        """Reads byte content from relative storage path."""
        pass

    @abstractmethod
    def exists(self, relative_path: str) -> bool:
        """Checks if a file exists in storage."""
        pass

    @abstractmethod
    def get_absolute_path(self, relative_path: str) -> Path:
        """Resolves internal absolute filesystem path for local access."""
        pass
