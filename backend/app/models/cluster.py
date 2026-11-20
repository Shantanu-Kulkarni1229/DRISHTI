import uuid
from typing import Optional
from sqlalchemy import Boolean, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, GUID, TenantMixin, TimestampMixin
from app.models.types import JSONType


class Cluster(Base, TenantMixin, TimestampMixin):
    __tablename__ = "clusters"

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_saved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    algorithm: Mapped[str] = mapped_column(String(50), default="HDBSCAN", nullable=False)
    algorithm_version: Mapped[str] = mapped_column(String(50), default="0.8.38", nullable=False)
    parameters: Mapped[Optional[dict]] = mapped_column(JSONType(), nullable=True)
    centroid_2d: Mapped[Optional[list]] = mapped_column(JSONType(), nullable=True)
    member_tile_ids: Mapped[Optional[list]] = mapped_column(JSONType(), nullable=True)
    color: Mapped[str] = mapped_column(String(50), default="#81a1c1", nullable=False)
    aoi_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)

    __table_args__ = (
        Index("ix_clusters_org_aoi", "organisation_id", "aoi_id"),
    )
