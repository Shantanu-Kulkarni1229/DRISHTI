from typing import Any, Dict, Optional
from pydantic import AliasChoices, BaseModel, ConfigDict, Field


class ModelInfoResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    name: str
    version: str
    task: str
    licence: str
    sourceUrl: str = Field(validation_alias=AliasChoices("source_url", "sourceUrl"))
    sha256: str
    sizeMb: float = Field(validation_alias=AliasChoices("size_mb", "sizeMb"))


class IndexStatsResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    vectorCount: int
    indexSizeBytes: int
    lastBuildMs: int
    lastIncrementalInsertMs: int
    meanQueryLatencyMs: float
    p95QueryLatencyMs: float
    indexedAreaKm2: float
    sceneCount: int
    tileCount: int
