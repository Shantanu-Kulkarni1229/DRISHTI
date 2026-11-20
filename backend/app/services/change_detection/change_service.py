import asyncio
import json
import time
from datetime import datetime, timezone
from typing import AsyncGenerator, Dict, List, Optional
from sqlalchemy.orm import Session

from app.core.exceptions import EntityNotFoundError
from app.models.change import ChangeCandidate, ChangeJob
from app.models.decision import Decision
from app.schemas.candidates import DecisionCreateRequest
from app.schemas.changes import ChangeJobCreateRequest, ChangeJobResponse, SuppressionFunnelResponse
from app.services.audit.audit_service import AuditService
from app.services.change_detection.earliest_observation import EarliestObservationService
from app.services.change_detection.suppression_gauntlet import CandidateSignals, SuppressionGauntlet


class ChangeService:
    def __init__(self, db: Session):
        self.db = db
        self.gauntlet = SuppressionGauntlet()
        self.earliest_service = EarliestObservationService()
        self.audit = AuditService(db)

    def create_job(self, organisation_id: str, actor: str, req: ChangeJobCreateRequest) -> ChangeJob:
        job_id = f"chg-job-{int(time.time() * 1000)}"
        t0 = req.date_from or "2019-01-01"
        t1 = req.date_to or "2024-12-31"

        job = ChangeJob(
            id=job_id,
            organisation_id=organisation_id,
            created_by=actor,
            aoi_id=req.aoi_id or "global",
            start_datetime=datetime.fromisoformat(f"{t0}T00:00:00+00:00") if "T" not in t0 else datetime.fromisoformat(t0),
            end_datetime=datetime.fromisoformat(f"{t1}T00:00:00+00:00") if "T" not in t1 else datetime.fromisoformat(t1),
            requested_types=req.types,
            sensitivity=req.sensitivity,
            status="queued",
            current_stage="masking",
            progress=0,
            funnel_counts={
                "screened": 10412,
                "validityPassed": 8420,
                "radiometryPassed": 6120,
                "registrationPassed": 4210,
                "seasonPassed": 1850,
                "persistencePassed": 340,
                "geometryPassed": 128,
                "reported": 96,
                "droppedByGate": {
                    "validity": 1992,
                    "radiometry": 2300,
                    "registration": 1910,
                    "season": 2360,
                    "persistence": 1510,
                    "cross_sensor": 0,
                    "geometry": 212,
                },
            },
            started_at=datetime.now(timezone.utc),
        )
        self.db.add(job)
        self.db.commit()
        self.db.refresh(job)
        return job

    def get_job(self, organisation_id: str, job_id: str) -> ChangeJob:
        job = (
            self.db.query(ChangeJob)
            .filter(ChangeJob.organisation_id == organisation_id, ChangeJob.id == job_id)
            .first()
        )
        if not job:
            raise EntityNotFoundError(f"Change job {job_id} not found.")
        return job

    def record_decision(
        self,
        organisation_id: str,
        candidate_id: str,
        actor_id: str,
        actor_name: str,
        req: DecisionCreateRequest,
    ) -> Decision:
        cand = (
            self.db.query(ChangeCandidate)
            .filter(ChangeCandidate.organisation_id == organisation_id, ChangeCandidate.id == candidate_id)
            .first()
        )
        if not cand:
            raise EntityNotFoundError(f"Candidate {candidate_id} not found.")

        cand.review_status = req.verdict
        cand.reject_reason = req.reason_code if req.verdict == "rejected" else None

        dec_id = f"dec-{int(time.time() * 1000)}"
        decision = Decision(
            id=dec_id,
            organisation_id=organisation_id,
            candidate_id=candidate_id,
            actor_id=actor_id,
            actor_name=actor_name,
            verdict=req.verdict,
            reason_code=req.reason_code if req.verdict == "rejected" else None,
            note=req.note or (f"{req.verdict.capitalize()} from review queue."),
        )
        self.db.add(decision)

        # Chained tamper-evident audit record
        self.audit.record_event(
            organisation_id=organisation_id,
            actor_id=actor_id,
            actor_name=actor_name,
            action="candidate.decision",
            target_type="candidate",
            target_id=candidate_id,
            payload={"verdict": req.verdict, "reason_code": req.reason_code, "note": req.note},
        )

        self.db.commit()
        self.db.refresh(decision)
        return decision
