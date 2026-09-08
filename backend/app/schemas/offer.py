from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class OfferCreate(BaseModel):
    branch_id: UUID
    product_id: UUID | None = None

    type: str = "product"

    title: str
    description: str | None = None

    original_price: Decimal
    sale_price: Decimal

    quantity_total: int = Field(gt=0)

    pickup_start: datetime
    pickup_end: datetime

    @model_validator(mode="after")
    def validate_offer(self):
        if self.sale_price <= 0:
            raise ValueError("sale_price must be greater than 0")

        if self.original_price <= 0:
            raise ValueError("original_price must be greater than 0")

        if self.sale_price > self.original_price:
            raise ValueError(
                "sale_price cannot be greater than original_price"
            )

        if self.pickup_end <= self.pickup_start:
            raise ValueError(
                "pickup_end must be later than pickup_start"
            )

        if self.type == "product" and self.product_id is None:
            raise ValueError(
                "product_id is required for product offers"
            )

        return self


class OfferResponse(BaseModel):
    id: UUID

    branch_id: UUID
    product_id: UUID | None

    type: str

    title: str
    description: str | None

    original_price: Decimal
    sale_price: Decimal

    quantity_total: int
    quantity_remaining: int

    pickup_start: datetime
    pickup_end: datetime

    status: str

    created_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
    )