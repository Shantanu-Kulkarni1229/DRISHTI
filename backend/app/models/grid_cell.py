import uuid
from typing import Optional
from sqlalchemy import Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, GUID, TenantMixin, TimestampMixin
from app.models.types import FlexibleGeometry, JSONType


class GridCell(Base, TenantMixin, TimestampMixin):
    __tablename__ = "grid_cells"

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    grid_reference: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    geometry: Mapped[Optional[str]] = mapped_column(FlexibleGeometry("POLYGON", srid=4326), nullable=True)
    bbox: Mapped[Optional[list]] = mapped_column(JSONType(), nullable=True)
    crs: Mapped[str] = mapped_column(String(50), default="EPSG:4326", nullable=False)
    aoi_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)

    __table_args__ = (
        Index("ix_grid_cells_org_ref", "organisation_id", "grid_reference"),
    )
