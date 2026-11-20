import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import DateTime, Float, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, GUID, TenantMixin, TimestampMixin
from app.models.types import FlexibleGeometry, JSONType


class Scene(Base, TenantMixin, TimestampMixin):
    __tablename__ = "scenes"

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    sensor: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    product_level: Mapped[str] = mapped_column(String(50), nullable=False)
    acquisition_datetime: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    crs: Mapped[str] = mapped_column(String(50), default="EPSG:4326", nullable=False)
    footprint: Mapped[Optional[str]] = mapped_column(FlexibleGeometry("POLYGON", srid=4326), nullable=True)
    bbox: Mapped[Optional[list]] = mapped_column(JSONType(), nullable=True)
    cloud_percentage: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    source_path: Mapped[str] = mapped_column(String(1024), nullable=False)
    size_mb: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    checksum: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    licence: Mapped[str] = mapped_column(String(255), default="Open Access", nullable=False)
    ingestion_status: Mapped[str] = mapped_column(String(50), default="done", nullable=False)
    ingested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    aoi_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSONType(), nullable=True)

    __table_args__ = (
        Index("ix_scenes_org_sensor_dt", "organisation_id", "sensor", "acquisition_datetime"),
    )
