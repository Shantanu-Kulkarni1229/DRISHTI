from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Generator, List, Optional, Tuple


@dataclass
class RasterMetadata:
    sensor: str
    product_level: str
    datetime_iso: str
    crs: str
    width: int
    height: int
    band_count: int
    bbox: List[float]  # [minLng, minLat, maxLng, maxLat]
    gsd_m: float
    cloud_percentage: float
    checksum: str
    size_mb: float


@dataclass
class TileChip:
    grid_index: str
    pixel_window: Dict[str, int]  # {col_off, row_off, width, height}
    bbox: List[float]  # [minLng, minLat, maxLng, maxLat]
    image_bytes: bytes


class RasterReaderAdapter(ABC):
    """Abstract interface for raster ingestion and windowed tiling."""

    @abstractmethod
    def read_metadata(self, file_path: Path) -> RasterMetadata:
        """Extracts georeferenced metadata, CRS, footprint, and band information."""
        pass

    @abstractmethod
    def compute_sha256(self, file_path: Path) -> str:
        """Computes deterministic SHA-256 checksum of the raster."""
        pass

    @abstractmethod
    def extract_tiles(
        self,
        file_path: Path,
        tile_size: int = 256,
        stride: int = 128,
    ) -> Generator[TileChip, None, None]:
        """Windowed read generator yielding fixed-size georeferenced tiles without loading entire scene."""
        pass

    @abstractmethod
    def generate_thumbnail(self, file_path: Path, max_size: int = 256) -> bytes:
        """Generates overview thumbnail image in PNG or JPEG format."""
        pass
