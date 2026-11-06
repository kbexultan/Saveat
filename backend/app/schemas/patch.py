from typing import ClassVar
from pydantic import BaseModel, field_validator, ValidationInfo


class PatchModel(BaseModel):
    """Omitted fields remain optional; explicit null cannot clear a NOT NULL column."""
    non_nullable_fields: ClassVar[set[str]] = set()

    @field_validator("*", check_fields=False)
    @classmethod
    def reject_explicit_null(cls, value, info: ValidationInfo):
        if value is None and info.field_name in cls.non_nullable_fields:
            raise ValueError("Field cannot be null")
        return value
