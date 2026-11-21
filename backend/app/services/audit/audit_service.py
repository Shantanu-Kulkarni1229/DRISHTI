import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.models.audit import AuditRecord


def normalize_iso_datetime(dt: datetime) -> str:
    """Normalizes datetime to UTC ISO-8601 with timezone suffix for deterministic hashing."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat()


class AuditService:
    def __init__(self, db: Session):
        self.db = db

    def get_latest_hash(self, organisation_id: str) -> str:
        latest = (
            self.db.query(AuditRecord)
            .filter(AuditRecord.organisation_id == organisation_id)
            .order_by(desc(AuditRecord.created_at))
            .first()
        )
        if latest:
            return latest.record_hash
        # Genesis hash for organisation
        return hashlib.sha256(f"genesis-{organisation_id}".encode("utf-8")).hexdigest()

    def record_event(
        self,
        organisation_id: str,
        actor_id: str,
        actor_name: str,
        action: str,
        target_type: str,
        target_id: str,
        payload: Dict[str, Any],
        model_versions: Optional[Dict[str, str]] = None,
    ) -> AuditRecord:
        prev_hash = self.get_latest_hash(organisation_id)
        created_at = datetime.now(timezone.utc)
        created_iso = normalize_iso_datetime(created_at)

        rec_hash = AuditRecord.compute_hash(
            previous_hash=prev_hash,
            actor_id=actor_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            payload=payload,
            created_at_iso=created_iso,
        )

        models = model_versions or {
            "RemoteCLIP": "ViT-B/32@v1.0",
            "DINOv2": "ViT-S/14@v1.0",
            "CactusMirage": "4.2.6",
        }

        entry = AuditRecord(
            id=uuid.uuid4(),
            organisation_id=organisation_id,
            actor_id=actor_id,
            actor_name=actor_name,
            action=action,
            target_type=target_type,
            target_id=target_id,
            payload=payload,
            model_versions=models,
            created_at=created_at,
            previous_hash=prev_hash,
            record_hash=rec_hash,
        )
        self.db.add(entry)
        self.db.commit()
        self.db.refresh(entry)
        return entry

    def list_records(
        self,
        organisation_id: str,
        limit: int = 50,
        offset: int = 0,
        actor: Optional[str] = None,
    ) -> List[AuditRecord]:
        q = self.db.query(AuditRecord).filter(AuditRecord.organisation_id == organisation_id)
        if actor:
            q = q.filter(AuditRecord.actor_name == actor)
        return q.order_by(desc(AuditRecord.created_at)).offset(offset).limit(limit).all()

    def verify_chain(self, organisation_id: str) -> Dict[str, Any]:
        """Traverses the audit trail from genesis to head, verifying cryptographic SHA-256 integrity."""
        records = (
            self.db.query(AuditRecord)
            .filter(AuditRecord.organisation_id == organisation_id)
            .order_by(AuditRecord.created_at.asc())
            .all()
        )

        genesis_hash = hashlib.sha256(f"genesis-{organisation_id}".encode("utf-8")).hexdigest()
        if not records:
            return {
                "valid": True,
                "records_verified": 0,
                "latest_hash": genesis_hash,
            }

        prev_hash = genesis_hash
        for i, rec in enumerate(records):
            if rec.previous_hash != prev_hash:
                return {
                    "valid": False,
                    "records_verified": i,
                    "latest_hash": rec.record_hash,
                    "broken_at_id": str(rec.id),
                    "broken_at_index": i,
                    "reason": f"Previous hash mismatch at record {i}: expected {prev_hash}, got {rec.previous_hash}",
                }

            expected_hash = AuditRecord.compute_hash(
                previous_hash=rec.previous_hash,
                actor_id=rec.actor_id,
                action=rec.action,
                target_type=rec.target_type,
                target_id=rec.target_id,
                payload=rec.payload,
                created_at_iso=normalize_iso_datetime(rec.created_at),
            )
            if rec.record_hash != expected_hash:
                return {
                    "valid": False,
                    "records_verified": i,
                    "latest_hash": rec.record_hash,
                    "broken_at_id": str(rec.id),
                    "broken_at_index": i,
                    "reason": f"Content tampering detected at record {i}: expected {expected_hash}, got {rec.record_hash}",
                }

            prev_hash = rec.record_hash

        return {
            "valid": True,
            "records_verified": len(records),
            "latest_hash": records[-1].record_hash,
        }
