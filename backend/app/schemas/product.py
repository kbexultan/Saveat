from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ProductCreate(BaseModel):
    business_id: UUID
    name: str
    description: str | None = None
    category: str | None = None
    image_url: str | None = None
    base_price: Decimal


class ProductResponse(BaseModel):
    id: UUID
    business_id: UUID
    name: str
    description: str | None
    category: str | None
    image_url: str | None
    base_price: Decimal
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)