from typing import Any, Dict, Optional
from pydantic import AliasChoices, BaseModel, ConfigDict, Field


class AuditRecordResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    id: str
    actor: str = Field(validation_alias=AliasChoices("actor_name", "actor"))
    action: str
    targetType: str = Field(validation_alias=AliasChoices("target_type", "targetType"))
    targetId: str = Field(validation_alias=AliasChoices("target_id", "targetId"))
    payload: Dict[str, Any]
    modelVersions: Dict[str, str] = Field(validation_alias=AliasChoices("model_versions", "modelVersions"))
    createdAt: str = Field(validation_alias=AliasChoices("created_at", "createdAt"))
    prevHash: str = Field(validation_alias=AliasChoices("previous_hash", "prevHash"))
    hash: str = Field(validation_alias=AliasChoices("record_hash", "hash"))


class AuditQueryFilter(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    actor: Optional[str] = None
    action: Optional[str] = None
    target_type: Optional[str] = None
    target_id: Optional[str] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
