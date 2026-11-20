import uuid
from typing import Optional
from sqlalchemy import Boolean, Float, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, GUID, TimestampMixin
from app.models.types import JSONType


class ModelRegistry(Base, TimestampMixin):
    """Global system model registry holding provenance, licences, versions and weight checksums."""

    __tablename__ = "model_registry"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    version: Mapped[str] = mapped_column(String(50), nullable=False)
    task: Mapped[str] = mapped_column(String(100), nullable=False)
    licence: Mapped[str] = mapped_column(String(100), nullable=False)
    source_url: Mapped[str] = mapped_column(String(1024), nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    local_path: Mapped[str] = mapped_column(String(1024), nullable=False)
    size_mb: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSONType(), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
