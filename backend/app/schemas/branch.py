from datetime import datetime, time
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class BranchCreate(BaseModel):
    business_id: UUID
    name: str
    address: str
    latitude: float | None = None
    longitude: float | None = None
    opening_time: time | None = None
    closing_time: time | None = None


class BranchResponse(BaseModel):
    id: UUID
    business_id: UUID
    name: str
    address: str
    latitude: float | None
    longitude: float | None
    opening_time: time | None
    closing_time: time | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)