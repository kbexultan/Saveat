from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.branch import Branch
from app.models.offer import Offer
from app.models.product import Product
from app.schemas.offer import OfferCreate, OfferResponse


router = APIRouter(
    prefix="/offers",
    tags=["Offers"],
)


@router.post(
    "",
    response_model=OfferResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_offer(
    data: OfferCreate,
    db: Session = Depends(get_db),
):
    branch = db.get(Branch, data.branch_id)

    if branch is None:
        raise HTTPException(
            status_code=404,
            detail="Branch not found",
        )

    product = None

    if data.product_id is not None:
        product = db.get(Product, data.product_id)

        if product is None:
            raise HTTPException(
                status_code=404,
                detail="Product not found",
            )

        if product.business_id != branch.business_id:
            raise HTTPException(
                status_code=400,
                detail="Product and branch belong to different businesses",
            )

    offer = Offer(
        branch_id=data.branch_id,
        product_id=data.product_id,
        type=data.type,
        title=data.title,
        description=data.description,
        original_price=data.original_price,
        sale_price=data.sale_price,
        quantity_total=data.quantity_total,
        quantity_remaining=data.quantity_total,
        pickup_start=data.pickup_start,
        pickup_end=data.pickup_end,
        status="active",
    )

    db.add(offer)
    db.commit()
    db.refresh(offer)

    return offer


@router.get(
    "",
    response_model=list[OfferResponse],
)
def get_offers(
    db: Session = Depends(get_db),
):
    result = db.execute(
        select(Offer).order_by(
            Offer.created_at.desc()
        )
    )

    return result.scalars().all()


@router.get(
    "/{offer_id}",
    response_model=OfferResponse,
)
def get_offer(
    offer_id: UUID,
    db: Session = Depends(get_db),
):
    offer = db.get(Offer, offer_id)

    if offer is None:
        raise HTTPException(
            status_code=404,
            detail="Offer not found",
        )

    return offer