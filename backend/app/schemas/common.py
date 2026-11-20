from typing import Generic, List, Optional, TypeVar
from pydantic import BaseModel, Field

T = TypeVar("T")


class LngLat(BaseModel):
    lng: float
    lat: float


class Footprint(BaseModel):
    bbox: List[float] = Field(description="[minLng, minLat, maxLng, maxLat]")


class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    cursor: Optional[str] = None
    has_more: bool = False


class StatusMessage(BaseModel):
    status: str
    message: Optional[str] = None
    details: Optional[dict] = None
