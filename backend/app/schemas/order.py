from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class OrderCreate(BaseModel):
    offer_id: UUID
    quantity: int = Field(
        gt=0,
        le=20,
    )


class OrderResponse(BaseModel):
    id: UUID

    user_id: UUID
    offer_id: UUID

    quantity: int

    unit_price: Decimal
    total_price: Decimal

    status: str
    pickup_code: str

    created_at: datetime
    picked_up_at: datetime | None

    model_config = ConfigDict(
        from_attributes=True,
    )