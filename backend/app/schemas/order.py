from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class OrderCreate(BaseModel):
    # Оставляем старый endpoint
    # совместимым с одним товаром.
    offer_id: UUID

    quantity: int = Field(
        gt=0,
        le=20,
    )


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

    payment_method: Literal[
        "pay_on_pickup"
    ] = "pay_on_pickup"


class OrderItemResponse(BaseModel):
    id: UUID
    offer_id: UUID | None

    offer_title: str

    product_name: str | None
    product_image_url: str | None

    quantity: int

    unit_price: Decimal
    total_price: Decimal

    model_config = ConfigDict(
        from_attributes=True,
    )


class OrderResponse(BaseModel):
    id: UUID
    user_id: UUID
    branch_id: UUID

    business_name: str
    branch_name: str
    address: str

    pickup_start: datetime
    pickup_end: datetime

    total_price: Decimal

    payment_method: str

    status: str
    pickup_code: str

    created_at: datetime
    picked_up_at: datetime | None

    items: list[OrderItemResponse]


class OrderDetailsResponse(
    OrderResponse
):
    pass