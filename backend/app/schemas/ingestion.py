from typing import Optional
from pydantic import AliasChoices, BaseModel, ConfigDict, Field


class IngestJobResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    id: str
    filename: str
    aoiId: Optional[str] = Field(default=None, validation_alias=AliasChoices("aoi_id", "aoiId"))
    status: str
    progress: int
    tilesProduced: int = Field(default=0, validation_alias=AliasChoices("tiles_created", "tilesProduced"))
    embedMs: Optional[int] = Field(default=None, validation_alias=AliasChoices("embed_ms", "embedMs"))
    indexInsertMs: Optional[int] = Field(default=None, validation_alias=AliasChoices("index_insert_ms", "indexInsertMs"))
    startedAt: str = Field(validation_alias=AliasChoices("created_at", "startedAt"))
    finishedAt: Optional[str] = Field(default=None, validation_alias=AliasChoices("completed_at", "finishedAt"))
    error: Optional[str] = Field(default=None, validation_alias=AliasChoices("error_message", "error"))
    retryOf: Optional[str] = Field(default=None, validation_alias=AliasChoices("retry_of", "retryOf"))


class IngestUploadResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    job_id: str
    filename: str
    status: str
    message: str


class WatchFolderTriggerRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    watch_path: str = Field(description="Internal controlled path inside staged imagery folder")
    aoi_id: Optional[str] = None
