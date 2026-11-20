from typing import List, Optional
from pydantic import AliasChoices, BaseModel, ConfigDict, Field


class ExportRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    candidate_ids: List[str] = Field(validation_alias=AliasChoices("candidateIds", "candidate_ids"))
    format: str = Field(description="'geojson' | 'csv' | 'kml' | 'stac' | 'geopackage'")
    include_provenance: bool = Field(default=True, validation_alias=AliasChoices("includeProvenance", "include_provenance"))


class ExportResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    export_id: str
    format: str
    item_count: int
    download_url: str
    file_size_bytes: int
