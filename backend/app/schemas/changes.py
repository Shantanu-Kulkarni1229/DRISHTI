from typing import Dict, List, Optional
from pydantic import AliasChoices, BaseModel, ConfigDict, Field


class ChangeJobCreateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    aoi_id: Optional[str] = Field(default=None, validation_alias=AliasChoices("aoiId", "aoi_id"))
    date_mode: str = Field(default="range", validation_alias=AliasChoices("dateMode", "date_mode"))
    date_from: Optional[str] = Field(default=None, validation_alias=AliasChoices("dateFrom", "date_from"))
    date_to: Optional[str] = Field(default=None, validation_alias=AliasChoices("dateTo", "date_to"))
    pair_before: Optional[str] = Field(default=None, validation_alias=AliasChoices("pairBefore", "pair_before"))
    pair_after: Optional[str] = Field(default=None, validation_alias=AliasChoices("pairAfter", "pair_after"))
    types: List[str] = Field(default=["construction", "clearance", "water", "roads"])
    sensitivity: float = Field(default=0.55, ge=0.0, le=1.0)


class SuppressionFunnelResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    screened: int
    validityPassed: int
    radiometryPassed: int
    registrationPassed: int
    seasonPassed: int
    persistencePassed: int
    geometryPassed: int
    reported: int
    droppedByGate: Dict[str, int]


class ChangeJobResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    id: str
    status: str
    currentStage: str = Field(validation_alias=AliasChoices("current_stage", "currentStage"))
    progress: int
    sensitivity: float
    funnel: Optional[SuppressionFunnelResponse] = None
    startedAt: Optional[str] = Field(default=None, validation_alias=AliasChoices("started_at", "startedAt"))
    completedAt: Optional[str] = Field(default=None, validation_alias=AliasChoices("completed_at", "completedAt"))
    errorMessage: Optional[str] = Field(default=None, validation_alias=AliasChoices("error_message", "errorMessage"))


class StageLogEvent(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    stage: str
    progress: int
    status: str
    message: Optional[str] = None
