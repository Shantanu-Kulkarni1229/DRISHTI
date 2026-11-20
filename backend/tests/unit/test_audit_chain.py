import uuid
from datetime import datetime, timezone
from app.models.audit import AuditRecord
from app.services.audit.audit_service import AuditService


def test_audit_hash_deterministic():
    h1 = AuditRecord.compute_hash(
        previous_hash="prev-123",
        actor_id="actor-1",
        action="candidate.decision",
        target_type="candidate",
        target_id="cand-1",
        payload={"verdict": "accepted"},
        created_at_iso="2026-11-20T00:00:00+00:00",
    )
    h2 = AuditRecord.compute_hash(
        previous_hash="prev-123",
        actor_id="actor-1",
        action="candidate.decision",
        target_type="candidate",
        target_id="cand-1",
        payload={"verdict": "accepted"},
        created_at_iso="2026-11-20T00:00:00+00:00",
    )
    assert h1 == h2
    assert len(h1) == 64


def test_audit_record_chaining(db_session, test_org):
    service = AuditService(db_session)
    org_id = str(test_org.id)

    rec1 = service.record_event(
        organisation_id=org_id,
        actor_id="analyst-1",
        actor_name="A. Rao",
        action="ingest.scene",
        target_type="scene",
        target_id="scene-1",
        payload={"tiles": 12},
    )

    rec2 = service.record_event(
        organisation_id=org_id,
        actor_id="analyst-1",
        actor_name="A. Rao",
        action="candidate.decision",
        target_type="candidate",
        target_id="cand-1",
        payload={"verdict": "accepted"},
    )

    # Verify that rec2 chained back to rec1's record_hash
    assert rec2.previous_hash == rec1.record_hash
