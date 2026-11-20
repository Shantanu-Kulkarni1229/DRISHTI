import uuid
from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, GUID, TenantMixin, TimestampMixin


class Decision(Base, TenantMixin, TimestampMixin):
    __tablename__ = "decisions"

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    candidate_id: Mapped[str] = mapped_column(
        String(100), ForeignKey("change_candidates.id", ondelete="CASCADE"), nullable=False, index=True
    )
    actor_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    actor_name: Mapped[str] = mapped_column(String(150), nullable=False)
    verdict: Mapped[str] = mapped_column(String(50), nullable=False)
    reason_code: Mapped[str] = mapped_column(String(100), nullable=True)
    note: Mapped[str] = mapped_column(Text, default="", nullable=False)

    # Relationships
    candidate: Mapped["ChangeCandidate"] = relationship("ChangeCandidate", back_populates="decisions")

    __table_args__ = (
        Index("ix_decisions_org_candidate", "organisation_id", "candidate_id"),
    )
