from typing import Any, List, Optional
from pydantic import AliasChoices, BaseModel, ConfigDict, Field

from app.schemas.common import LngLat


class SuppressionFactor(BaseModel):
    gate: str
    label: str
    value: float


class ChangeCandidateResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    id: str
    aoiId: Optional[str] = Field(default=None, validation_alias=AliasChoices("aoi_id", "aoiId"))
    gridCellId: str = Field(validation_alias=AliasChoices("grid_cell_id", "gridCellId"))
    tileBeforeId: str = Field(validation_alias=AliasChoices("tile_before_id", "tileBeforeId"))
    tileAfterId: str = Field(validation_alias=AliasChoices("tile_after_id", "tileAfterId"))
    geomCenter: Optional[LngLat] = Field(default=None, validation_alias=AliasChoices("geom_center", "geomCenter"))
    bbox: List[float]
    areaM2: float = Field(validation_alias=AliasChoices("area_m2", "areaM2"))
    type: str
    direction: str
    score: float
    confidence: float
    factors: List[SuppressionFactor] = Field(default_factory=list)
    status: str
    rejectReason: Optional[str] = Field(default=None, validation_alias=AliasChoices("reject_reason", "rejectReason"))
    suppressedBy: Optional[str] = Field(default=None, validation_alias=AliasChoices("suppression_reason", "suppressedBy"))
    assignee: Optional[str] = None
    earliestIntervalStart: Optional[str] = Field(default=None, validation_alias=AliasChoices("earliest_interval_start", "earliestIntervalStart"))
    earliestIntervalEnd: Optional[str] = Field(default=None, validation_alias=AliasChoices("earliest_interval_end", "earliestIntervalEnd"))
    revisitGapDays: int = Field(default=0, validation_alias=AliasChoices("revisit_gap_days", "revisitGapDays"))
    jobId: str = Field(validation_alias=AliasChoices("job_id", "jobId"))
    registrationResidualPx: float = Field(default=0.18, validation_alias=AliasChoices("registration_residual_px", "registrationResidualPx"))
    seasonalZScore: float = Field(default=0.45, validation_alias=AliasChoices("seasonal_z_score", "seasonalZScore"))
    sarAgreement: float = Field(default=0.92, validation_alias=AliasChoices("sar_agreement", "sarAgreement"))
    headline: Optional[str] = None
    narrative: Optional[str] = None


class EarliestObservationResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    candidateId: str = Field(validation_alias=AliasChoices("candidate_id", "candidateId"))
    earliestIntervalStart: str = Field(validation_alias=AliasChoices("earliest_interval_start", "earliestIntervalStart"))
    earliestIntervalEnd: str = Field(validation_alias=AliasChoices("earliest_interval_end", "earliestIntervalEnd"))
    revisitGapDays: int = Field(validation_alias=AliasChoices("revisit_gap_days", "revisitGapDays"))
    cloudGapDetected: bool = Field(default=False, validation_alias=AliasChoices("cloud_gap_detected", "cloudGapDetected"))


class DecisionCreateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    verdict: str = Field(description="'accepted' | 'rejected'")
    reason_code: Optional[str] = Field(default=None, validation_alias=AliasChoices("reason_code", "reasonCode"))
    note: Optional[str] = ""


class DecisionResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    id: str
    candidateId: str = Field(validation_alias=AliasChoices("candidate_id", "candidateId"))
    actor: str = Field(validation_alias=AliasChoices("actor_name", "actor"))
    verdict: str
    reasonCode: Optional[str] = Field(default=None, validation_alias=AliasChoices("reason_code", "reasonCode"))
    note: str
    createdAt: str = Field(validation_alias=AliasChoices("created_at", "createdAt"))
