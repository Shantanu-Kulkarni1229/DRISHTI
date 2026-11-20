from typing import List, Optional
from pydantic import AliasChoices, BaseModel, ConfigDict, Field

from app.schemas.common import Footprint


class TileResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    id: str
    sceneId: str = Field(validation_alias=AliasChoices("scene_id", "sceneId"))
    aoiId: Optional[str] = Field(default=None, validation_alias=AliasChoices("aoi_id", "aoiId"))
    gridCellId: str = Field(validation_alias=AliasChoices("grid_cell_id", "gridCellId"))
    footprint: Footprint
    datetime: str
    sensor: str
    gsdM: float = Field(default=10.0, validation_alias=AliasChoices("gsd_m", "gsdM"))
    validFrac: float = Field(default=1.0, validation_alias=AliasChoices("valid_fraction", "validFrac"))
    cloudFrac: float = Field(default=0.0, validation_alias=AliasChoices("cloud_fraction", "cloudFrac"))
    thumbColor: str = Field(default="#3b4252", validation_alias=AliasChoices("thumb_color", "thumbColor"))
    thumbPattern: str = Field(default="mixed", validation_alias=AliasChoices("thumb_pattern", "thumbPattern"))
    clusterId: Optional[str] = Field(default=None, validation_alias=AliasChoices("cluster_id", "clusterId"))
    embedding2d: Optional[List[float]] = Field(default=None, validation_alias=AliasChoices("embedding_2d", "embedding2d"))
    conceptTerms: List[str] = Field(default_factory=list, validation_alias=AliasChoices("concept_terms", "conceptTerms"))
    imageUrl: Optional[str] = Field(default=None, validation_alias=AliasChoices("image_url", "imageUrl"))
    cropPosition: Optional[str] = Field(default=None, validation_alias=AliasChoices("crop_position", "cropPosition"))
    label: Optional[str] = None


class TileDetailResponse(TileResponse):
    parentSceneChecksum: Optional[str] = None
    crs: Optional[str] = "EPSG:4326"
    pixelWindow: Optional[dict] = None


class TimeSeriesPointResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    date: str
    changeScore: float = Field(validation_alias=AliasChoices("change_score", "changeScore"))
    ndvi: float
    ndwi: float
    sarBackscatter: float = Field(validation_alias=AliasChoices("sar_backscatter", "sarBackscatter"))
    seasonalEnvelopeLow: float = Field(validation_alias=AliasChoices("seasonal_envelope_low", "seasonalEnvelopeLow"))
    seasonalEnvelopeHigh: float = Field(validation_alias=AliasChoices("seasonal_envelope_high", "seasonalEnvelopeHigh"))
    usability: str
