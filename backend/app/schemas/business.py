from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class BusinessCreate(BaseModel):
    name: str
    description: str | None = None
    logo_url: str | None = None


class BusinessResponse(BaseModel):
    id: UUID
    name: str
    description: str | None
    logo_url: str | None
    status: str
    created_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
    )