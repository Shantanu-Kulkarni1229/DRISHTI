import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import DateTime, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, GUID, TenantMixin
from app.models.types import JSONType


class AuditRecord(Base, TenantMixin):
    """Cryptographically chained append-only audit trail."""

    __tablename__ = "audit_records"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    actor_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    actor_name: Mapped[str] = mapped_column(String(150), nullable=False)
    action: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    target_type: Mapped[str] = mapped_column(String(50), nullable=False)
    target_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    payload: Mapped[dict] = mapped_column(JSONType(), nullable=False)
    model_versions: Mapped[dict] = mapped_column(JSONType(), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True
    )
    previous_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    record_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)

    @classmethod
    def compute_hash(
        cls,
        previous_hash: str,
        actor_id: str,
        action: str,
        target_type: str,
        target_id: str,
        payload: dict,
        created_at_iso: str,
    ) -> str:
        """Computes deterministic SHA-256 for audit chaining."""
        content = f"{previous_hash}|{actor_id}|{action}|{target_type}|{target_id}|{json.dumps(payload, sort_keys=True)}|{created_at_iso}"
        return hashlib.sha256(content.encode("utf-8")).hexdigest()

    __table_args__ = (
        Index("ix_audit_org_created", "organisation_id", "created_at"),
    )
