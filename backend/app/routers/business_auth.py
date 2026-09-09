from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db

from app.models.business import Business
from app.models.business_member import BusinessMember
from app.models.user import User

from app.schemas.business import BusinessResponse
from app.schemas.business_auth import (
    BusinessAuthResponse,
    BusinessLoginRequest,
    BusinessMembershipResponse,
    BusinessMeResponse,
    BusinessRegisterRequest,
)
from app.schemas.user import UserResponse

from app.security import (
    create_access_token,
    hash_password,
    verify_password,
)


router = APIRouter(
    prefix="/business-auth",
    tags=["Business Auth"],
)


def build_membership_response(
    membership: BusinessMember,
    business: Business,
) -> BusinessMembershipResponse:
    return BusinessMembershipResponse(
        id=membership.id,
        role=membership.role,
        status=membership.status,
        business=BusinessResponse.model_validate(
            business
        ),
    )


def get_user_business_memberships(
    user_id,
    db: Session,
) -> list[BusinessMembershipResponse]:
    rows = db.execute(
        select(
            BusinessMember,
            Business,
        )
        .join(
            Business,
            BusinessMember.business_id
            == Business.id,
        )
        .where(
            BusinessMember.user_id
            == user_id,
            BusinessMember.status
            == "active",
        )
        .order_by(
            Business.created_at.asc()
        )
    ).all()

    return [
        build_membership_response(
            membership,
            business,
        )
        for membership, business in rows
    ]


@router.post(
    "/register",
    response_model=BusinessAuthResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_business_account(
    data: BusinessRegisterRequest,
    db: Session = Depends(get_db),
):
    email = (
        str(data.email)
        .strip()
        .lower()
    )

    phone = data.phone.strip()

    business_name = (
        data.business_name.strip()
    )

    if not business_name:
        raise HTTPException(
            status_code=400,
            detail=(
                "Business name "
                "cannot be empty"
            ),
        )

    existing_email = (
        db.execute(
            select(User).where(
                func.lower(
                    User.email
                )
                == email
            )
        )
        .scalar_one_or_none()
    )

    if existing_email is not None:
        raise HTTPException(
            status_code=409,
            detail=(
                "Email already registered. "
                "Sign in with your existing "
                "SAVEAT account."
            ),
        )

    existing_phone = (
        db.execute(
            select(User).where(
                User.phone == phone
            )
        )
        .scalar_one_or_none()
    )

    if existing_phone is not None:
        raise HTTPException(
            status_code=409,
            detail=(
                "Phone already registered"
            ),
        )

    try:
        # -------------------------
        # USER
        # -------------------------

        user = User(
            full_name=(
                data.full_name.strip()
            ),
            phone=phone,
            email=email,
            password_hash=hash_password(
                data.password
            ),
        )

        db.add(user)
        db.flush()

        # -------------------------
        # BUSINESS
        # -------------------------

        business = Business(
            name=business_name,
            description=(
                data.business_description
            ),
            logo_url=(
                data.business_logo_url
            ),
            status="active",
        )

        db.add(business)
        db.flush()

        # -------------------------
        # OWNER
        # -------------------------

        membership = BusinessMember(
            business_id=business.id,
            user_id=user.id,
            role="owner",
            status="active",
        )

        db.add(membership)

        # Всё одной транзакцией.
        db.commit()

        db.refresh(user)
        db.refresh(business)
        db.refresh(membership)

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=409,
            detail=(
                "Account or business "
                "could not be created"
            ),
        )

    except Exception:
        db.rollback()
        raise

    token = create_access_token(
        str(user.id)
    )

    membership_response = (
        build_membership_response(
            membership,
            business,
        )
    )

    return BusinessAuthResponse(
        access_token=token,

        user=UserResponse.model_validate(
            user
        ),

        memberships=[
            membership_response
        ],
    )


@router.post(
    "/login",
    response_model=BusinessAuthResponse,
)
def login_business_account(
    data: BusinessLoginRequest,
    db: Session = Depends(get_db),
):
    email = (
        str(data.email)
        .strip()
        .lower()
    )

    user = (
        db.execute(
            select(User).where(
                func.lower(
                    User.email
                )
                == email
            )
        )
        .scalar_one_or_none()
    )

    if (
        user is None
        or not verify_password(
            data.password,
            user.password_hash,
        )
    ):
        raise HTTPException(
            status_code=401,
            detail=(
                "Invalid email "
                "or password"
            ),
        )

    memberships = (
        get_user_business_memberships(
            user.id,
            db,
        )
    )

    if not memberships:
        raise HTTPException(
            status_code=403,
            detail=(
                "This SAVEAT account "
                "does not have a business"
            ),
        )

    token = create_access_token(
        str(user.id)
    )

    return BusinessAuthResponse(
        access_token=token,

        user=UserResponse.model_validate(
            user
        ),

        memberships=memberships,
    )


@router.get(
    "/me",
    response_model=BusinessMeResponse,
)
def get_business_me(
    current_user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):
    memberships = (
        get_user_business_memberships(
            current_user.id,
            db,
        )
    )

    return BusinessMeResponse(
        user=UserResponse.model_validate(
            current_user
        ),

        memberships=memberships,
    )