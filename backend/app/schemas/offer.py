from datetime import datetime
from decimal import Decimal
from uuid import UUID

from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)


def require_timezone(value: datetime | None) -> datetime | None:
    """
    Время выдачи должно приходить со смещением ("...+05:00").

    В базе pickup_start/pickup_end лежат как timestamptz, и сравнить
    их с датой без зоны Python не может — вместо понятной ошибки
    запрос падал с 500. Гадать за клиента, какой у него часовой пояс,
    хуже, чем сказать об этом прямо.
    """
    if value is not None and value.tzinfo is None:
        raise ValueError(
            "datetime must include a timezone offset, "
            "for example 2026-09-17T18:00:00+05:00"
        )

    return value


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

    _check_timezone = field_validator(
        "pickup_start",
        "pickup_end",
    )(require_timezone)

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

    # active / paused / sold_out — как в базе, плюс expired: его
    # backend считает по pickup_end на чтении, в базе такого
    # значения нет. См. offers.effective_offer_status.
    status: str

    created_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
    )

class OfferPublicResponse(BaseModel):
    id: UUID

    title: str
    description: str | None

    original_price: Decimal
    sale_price: Decimal

    quantity_remaining: int

    pickup_start: datetime
    pickup_end: datetime

    type: str
    status: str

    product_id: UUID | None
    product_name: str | None
    product_image_url: str | None
    category: str | None

    branch_id: UUID
    branch_name: str
    address: str
    latitude: float | None
    longitude: float | None

    business_id: UUID
    business_name: str

class OfferUpdate(BaseModel):
    # PATCH: меняем только
    # присланные поля.
    #
    # Поля, которые нельзя менять
    # после создания:
    # branch_id, product_id, type.
    # Они определяют, чей это offer.
    title: str | None = None
    description: str | None = None

    original_price: Decimal | None = Field(
        default=None,
        gt=0,
    )

    sale_price: Decimal | None = Field(
        default=None,
        gt=0,
    )

    quantity_total: int | None = Field(
        default=None,
        gt=0,
    )

    pickup_start: datetime | None = None
    pickup_end: datetime | None = None

    _check_timezone = field_validator(
        "pickup_start",
        "pickup_end",
    )(require_timezone)

    # Бизнес может только включить
    # или выключить предложение.
    # sold_out проставляет backend.
    status: Literal[
        "active",
        "paused",
    ] | None = None

    model_config = ConfigDict(
        extra="forbid",
    )

    @field_validator("title")
    @classmethod
    def validate_title(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None:
            return None

        cleaned = value.strip()

        if not cleaned:
            raise ValueError(
                "title cannot be empty"
            )

        return cleaned
