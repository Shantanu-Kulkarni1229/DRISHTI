import uuid
from datetime import datetime
from typing import List, Optional
from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, GUID, TenantMixin, TimestampMixin
from app.models.types import FlexibleGeometry, JSONType


class ChangeJob(Base, TenantMixin, TimestampMixin):
    __tablename__ = "change_jobs"

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    created_by: Mapped[str] = mapped_column(String(150), default="analyst", nullable=False)
    aoi_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    aoi_bbox: Mapped[Optional[list]] = mapped_column(JSONType(), nullable=True)
    start_datetime: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_datetime: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    requested_types: Mapped[list] = mapped_column(JSONType(), nullable=False)
    sensitivity: Mapped[float] = mapped_column(Float, default=0.55, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="queued", nullable=False, index=True)
    current_stage: Mapped[str] = mapped_column(String(50), default="masking", nullable=False)
    progress: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    funnel_counts: Mapped[Optional[dict]] = mapped_column(JSONType(), nullable=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)

    # Relationships
    candidates: Mapped[List["ChangeCandidate"]] = relationship(
        "ChangeCandidate", back_populates="job", cascade="all, delete-orphan"
    )


class ChangeCandidate(Base, TenantMixin, TimestampMixin):
    __tablename__ = "change_candidates"

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    job_id: Mapped[str] = mapped_column(
        String(100), ForeignKey("change_jobs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    aoi_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    grid_cell_id: Mapped[str] = mapped_column(
        String(100), ForeignKey("grid_cells.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tile_before_id: Mapped[str] = mapped_column(
        String(100), ForeignKey("tiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tile_after_id: Mapped[str] = mapped_column(
        String(100), ForeignKey("tiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    geometry: Mapped[Optional[str]] = mapped_column(FlexibleGeometry("POLYGON", srid=4326), nullable=True)
    geom_center: Mapped[Optional[dict]] = mapped_column(JSONType(), nullable=True)
    bbox: Mapped[Optional[list]] = mapped_column(JSONType(), nullable=True)
    area_m2: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    change_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    direction: Mapped[str] = mapped_column(String(50), default="appearance", nullable=False)
    score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=0.0, nullable=False, index=True)
    confidence_factors: Mapped[Optional[list]] = mapped_column(JSONType(), nullable=True)
    suppression_reason: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    earliest_interval_start: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    earliest_interval_end: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    revisit_gap_days: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    review_status: Mapped[str] = mapped_column(String(50), default="pending", nullable=False, index=True)
    reject_reason: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    assignee: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    headline: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    narrative: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)

    registration_residual_px: Mapped[float] = mapped_column(Float, default=0.18, nullable=False)
    seasonal_z_score: Mapped[float] = mapped_column(Float, default=0.45, nullable=False)
    sar_agreement: Mapped[float] = mapped_column(Float, default=0.92, nullable=False)

    # Relationships
    job: Mapped["ChangeJob"] = relationship("ChangeJob", back_populates="candidates")
    decisions: Mapped[List["Decision"]] = relationship(
        "Decision", back_populates="candidate", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_change_cand_org_status", "organisation_id", "review_status"),
        Index("ix_change_cand_org_type", "organisation_id", "change_type"),
    )
