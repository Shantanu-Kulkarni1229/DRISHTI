import uuid
from datetime import datetime
from typing import List, Optional
from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, GUID, TenantMixin, TimestampMixin
from app.models.types import FlexibleGeometry, FlexibleVector, JSONType


class Tile(Base, TenantMixin, TimestampMixin):
    __tablename__ = "tiles"

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    scene_id: Mapped[str] = mapped_column(
        String(100), ForeignKey("scenes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    grid_cell_id: Mapped[str] = mapped_column(
        String(100), ForeignKey("grid_cells.id", ondelete="CASCADE"), nullable=False, index=True
    )
    aoi_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    footprint: Mapped[Optional[str]] = mapped_column(FlexibleGeometry("POLYGON", srid=4326), nullable=True)
    bbox: Mapped[Optional[list]] = mapped_column(JSONType(), nullable=True)
    native_crs: Mapped[str] = mapped_column(String(50), default="EPSG:4326", nullable=False)
    datetime: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    sensor: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    gsd_m: Mapped[float] = mapped_column(Float, default=10.0, nullable=False)
    valid_fraction: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    cloud_fraction: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    thumbnail_path: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    cog_path: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    pixel_window: Mapped[Optional[dict]] = mapped_column(JSONType(), nullable=True)
    embedding_status: Mapped[str] = mapped_column(String(50), default="pending", nullable=False)
    cluster_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    embedding_2d: Mapped[Optional[list]] = mapped_column(JSONType(), nullable=True)
    concept_terms: Mapped[Optional[list]] = mapped_column(JSONType(), nullable=True)
    thumb_pattern: Mapped[Optional[str]] = mapped_column(String(50), default="mixed", nullable=True)
    thumb_color: Mapped[Optional[str]] = mapped_column(String(30), default="#3b4252", nullable=True)

    # Relationships
    embeddings: Mapped[List["TileEmbedding"]] = relationship(
        "TileEmbedding", back_populates="tile", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_tiles_org_aoi_dt", "organisation_id", "aoi_id", "datetime"),
        Index("ix_tiles_org_sensor_cloud", "organisation_id", "sensor", "cloud_fraction"),
    )


class TileEmbedding(Base, TenantMixin, TimestampMixin):
    __tablename__ = "tile_embeddings"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    tile_id: Mapped[str] = mapped_column(
        String(100), ForeignKey("tiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    model_name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    model_version: Mapped[str] = mapped_column(String(50), nullable=False)
    dimension: Mapped[int] = mapped_column(Integer, nullable=False)
    embedding: Mapped[Optional[list]] = mapped_column(FlexibleVector(), nullable=True)

    # Relationships
    tile: Mapped["Tile"] = relationship("Tile", back_populates="embeddings")

    __table_args__ = (
        Index("ix_tile_embeddings_org_model", "organisation_id", "model_name"),
    )
