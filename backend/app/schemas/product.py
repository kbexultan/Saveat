from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)


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

class ProductUpdate(BaseModel):
    # PATCH: меняем только
    # присланные поля.
    name: str | None = None
    description: str | None = None
    category: str | None = None
    image_url: str | None = None

    base_price: Decimal | None = Field(
        default=None,
        gt=0,
    )

    is_active: bool | None = None

    model_config = ConfigDict(
        extra="forbid",
    )

    @field_validator("name")
    @classmethod
    def validate_name(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None:
            return None

        cleaned = value.strip()

        if not cleaned:
            raise ValueError(
                "name cannot be empty"
            )

        return cleaned
