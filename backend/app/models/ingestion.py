import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, GUID, TenantMixin, TimestampMixin


class IngestionJob(Base, TenantMixin, TimestampMixin):
    __tablename__ = "ingestion_jobs"

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    source_path: Mapped[str] = mapped_column(String(1024), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    aoi_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(50), default="queued", nullable=False, index=True)
    current_stage: Mapped[str] = mapped_column(String(50), default="queued", nullable=False)
    progress: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    scenes_processed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    tiles_created: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    embed_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    index_insert_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    retry_of: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
