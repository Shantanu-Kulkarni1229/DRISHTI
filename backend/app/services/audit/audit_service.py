import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.models.audit import AuditRecord


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
        created_iso = created_at.isoformat()

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
            "RemoteCLIP": "ViT-L/14@v1.0",
            "DINOv2": "ViT-B/14@v1.0",
            "TinyCD": "LEVIR-CD@v1.0",
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
