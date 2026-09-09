from uuid import UUID

from pydantic import (
    BaseModel,
    EmailStr,
    Field,
)

from app.schemas.business import (
    BusinessResponse,
)
from app.schemas.user import (
    UserResponse,
)


class BusinessRegisterRequest(
    BaseModel
):
    full_name: str = Field(
        min_length=2,
        max_length=150,
    )

    phone: str = Field(
        min_length=5,
        max_length=30,
    )

    email: EmailStr

    password: str = Field(
        min_length=8,
        max_length=128,
    )

    business_name: str = Field(
        min_length=2,
        max_length=150,
    )

    business_description: (
        str | None
    ) = Field(
        default=None,
        max_length=2000,
    )

    business_logo_url: (
        str | None
    ) = Field(
        default=None,
        max_length=500,
    )


class BusinessLoginRequest(
    BaseModel
):
    email: EmailStr
    password: str


class BusinessMembershipResponse(
    BaseModel
):
    id: UUID

    role: str
    status: str

    business: BusinessResponse


class BusinessAuthResponse(
    BaseModel
):
    access_token: str
    token_type: str = "bearer"

    user: UserResponse

    memberships: list[
        BusinessMembershipResponse
    ]


class BusinessMeResponse(
    BaseModel
):
    user: UserResponse

    memberships: list[
        BusinessMembershipResponse
    ]