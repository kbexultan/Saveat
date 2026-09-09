from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db

from app.models.business import Business
from app.models.business_member import BusinessMember
from app.models.user import User

from app.schemas.business import (
    BusinessCreate,
    BusinessResponse,
)


router = APIRouter(
    prefix="/businesses",
    tags=["Businesses"],
)


@router.post(
    "",
    response_model=BusinessResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_business(
    data: BusinessCreate,

    current_user: User = Depends(
        get_current_user
    ),

    db: Session = Depends(get_db),
):
    try:
        business = Business(
            name=data.name.strip(),
            description=data.description,
            logo_url=data.logo_url,
            status="active",
        )

        db.add(business)
        db.flush()

        membership = BusinessMember(
            business_id=business.id,
            user_id=current_user.id,
            role="owner",
            status="active",
        )

        db.add(membership)

        db.commit()

        db.refresh(business)

        return business

    except Exception:
        db.rollback()
        raise


@router.get(
    "",
    response_model=list[
        BusinessResponse
    ],
)
def get_businesses(
    db: Session = Depends(get_db),
):
    result = db.execute(
        select(Business)
        .where(
            Business.status
            == "active"
        )
        .order_by(
            Business.created_at.desc()
        )
    )

    return result.scalars().all()


@router.get(
    "/{business_id}",
    response_model=BusinessResponse,
)
def get_business(
    business_id: UUID,
    db: Session = Depends(get_db),
):
    business = db.get(
        Business,
        business_id,
    )

    if business is None:
        raise HTTPException(
            status_code=404,
            detail=(
                "Business not found"
            ),
        )

    return business