from datetime import datetime, time
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)


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

class BranchUpdate(BaseModel):
    # Все поля необязательные:
    # PATCH меняет только то,
    # что реально прислали.
    name: str | None = None
    address: str | None = None

    latitude: float | None = Field(
        default=None,
        ge=-90,
        le=90,
    )

    longitude: float | None = Field(
        default=None,
        ge=-180,
        le=180,
    )

    opening_time: time | None = None
    closing_time: time | None = None

    model_config = ConfigDict(
        extra="forbid",
    )

    @field_validator(
        "name",
        "address",
    )
    @classmethod
    def validate_not_blank(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None:
            return None

        cleaned = value.strip()

        if not cleaned:
            raise ValueError(
                "Value cannot be empty"
            )

        return cleaned
