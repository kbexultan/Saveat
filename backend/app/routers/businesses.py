from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.business import Business
from app.schemas.business import BusinessCreate, BusinessResponse


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
    db: Session = Depends(get_db),
):
    business = Business(
        name=data.name,
        description=data.description,
        logo_url=data.logo_url,
    )

    db.add(business)
    db.commit()
    db.refresh(business)

    return business


@router.get(
    "",
    response_model=list[BusinessResponse],
)
def get_businesses(
    db: Session = Depends(get_db),
):
    result = db.execute(
        select(Business).order_by(Business.created_at.desc())
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
    business = db.get(Business, business_id)

    if business is None:
        raise HTTPException(
            status_code=404,
            detail="Business not found",
        )

    return business