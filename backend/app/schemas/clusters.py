from typing import List, Optional
from pydantic import AliasChoices, BaseModel, ConfigDict, Field


class ClusterResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    id: str
    name: str
    isSaved: bool = Field(validation_alias=AliasChoices("is_saved", "isSaved"))
    memberTileIds: List[str] = Field(default_factory=list, validation_alias=AliasChoices("member_tile_ids", "memberTileIds"))
    color: str
    centroid2d: Optional[List[float]] = Field(default=None, validation_alias=AliasChoices("centroid_2d", "centroid2d"))


class ClusterRenameRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(min_length=1, max_length=255)
