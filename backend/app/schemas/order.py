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


class OrderDetailsResponse(BaseModel):
    id: UUID
    offer_id: UUID

    quantity: int
    unit_price: Decimal
    total_price: Decimal

    status: str
    pickup_code: str

    created_at: datetime
    picked_up_at: datetime | None

    offer_title: str

    product_name: str | None
    product_image_url: str | None

    business_name: str
    branch_name: str
    address: str

    pickup_start: datetime
    pickup_end: datetime
    
class CheckoutItem(BaseModel):
    offer_id: UUID

    quantity: int = Field(
        gt=0,
        le=20,
    )


class CheckoutRequest(BaseModel):
    items: list[CheckoutItem] = Field(
        min_length=1,
        max_length=20,
    )  