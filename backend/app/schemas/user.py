from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr


class UserCreate(BaseModel):
    full_name: str
    email: EmailStr | None = None
    phone: str | None = None


class UserResponse(BaseModel):
    id: UUID
    full_name: str
    email: str | None
    phone: str | None
    created_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
    )