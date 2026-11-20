from typing import List, Optional
from pydantic import AliasChoices, BaseModel, ConfigDict, Field

from app.schemas.tiles import TileResponse


class SaliencyBlob(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    x: float
    y: float
    r: float


class SearchQueryRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    query_text: Optional[str] = Field(default=None, validation_alias=AliasChoices("queryText", "query_text"))
    mode: str = Field(default="text", description="'text' | 'image' | 'both'")
    blend: float = Field(default=0.5, ge=0.0, le=1.0)
    image_tile_id: Optional[str] = Field(default=None, validation_alias=AliasChoices("imageQueryTileId", "image_tile_id"))
    aoi_id: Optional[str] = Field(default=None, validation_alias=AliasChoices("aoiId", "aoi_id"))
    bbox: Optional[List[float]] = Field(default=None, description="[minLng, minLat, maxLng, maxLat]")
    date_from: Optional[str] = Field(default=None, validation_alias=AliasChoices("dateFrom", "date_from"))
    date_to: Optional[str] = Field(default=None, validation_alias=AliasChoices("dateTo", "date_to"))
    sensors: Optional[List[str]] = Field(default=["S2", "S1", "L8"])
    max_cloud: Optional[float] = Field(default=20.0, validation_alias=AliasChoices("maxCloud", "max_cloud"))
    top_k: int = Field(default=24, validation_alias=AliasChoices("k", "top_k"))
    cursor: Optional[str] = None


class SearchResultItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    tile: TileResponse
    score: float
    saliency: List[SaliencyBlob] = Field(default_factory=list)
    textScore: Optional[float] = Field(default=None, validation_alias=AliasChoices("text_score", "textScore"))
    imageScore: Optional[float] = Field(default=None, validation_alias=AliasChoices("image_score", "imageScore"))
    rocchioScore: Optional[float] = Field(default=None, validation_alias=AliasChoices("rocchio_score", "rocchioScore"))


class SearchResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    query_id: str = Field(validation_alias=AliasChoices("queryId", "query_id"))
    results: List[SearchResultItem]
    next_cursor: Optional[str] = Field(default=None, validation_alias=AliasChoices("nextCursor", "next_cursor"))


class RelevanceFeedbackRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    query_id: str = Field(validation_alias=AliasChoices("queryId", "query_id"))
    tile_id: str = Field(validation_alias=AliasChoices("tileId", "tile_id"))
    label: str = Field(description="'good' | 'bad'")


class RelevanceFeedbackResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    status: str
    message: str = "Relevance feedback recorded successfully."
    feedback_rounds: int = 1
