from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.branch import Branch
from app.models.business import Business
from app.models.offer import Offer
from app.models.product import Product
from app.schemas.offer import (
    OfferCreate,
    OfferPublicResponse,
    OfferResponse,
)


router = APIRouter(
    prefix="/offers",
    tags=["Offers"],
)


# CREATE OFFER
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
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Branch not found",
        )

    product = None

    if data.product_id is not None:
        product = db.get(Product, data.product_id)

        if product is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Product not found",
            )

        if product.business_id != branch.business_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Product and branch belong "
                    "to different businesses"
                ),
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


# PUBLIC OFFERS FOR FRONTEND / MAP
@router.get(
    "/public",
    response_model=list[OfferPublicResponse],
)
def get_public_offers(
    db: Session = Depends(get_db),
):
    statement = (
        select(
            Offer,
            Branch,
            Business,
            Product,
        )
        .select_from(Offer)
        .join(
            Branch,
            Offer.branch_id == Branch.id,
        )
        .join(
            Business,
            Branch.business_id == Business.id,
        )
        .outerjoin(
            Product,
            Offer.product_id == Product.id,
        )
        .where(
            Offer.status == "active",
            Offer.quantity_remaining > 0,
            Offer.pickup_end > func.now(),
            Business.status == "active",
        )
        .order_by(
            Offer.created_at.desc(),
        )
    )

    rows = db.execute(statement).all()

    return [
        OfferPublicResponse(
            id=offer.id,
            title=offer.title,
            description=offer.description,
            original_price=offer.original_price,
            sale_price=offer.sale_price,
            quantity_remaining=offer.quantity_remaining,
            pickup_start=offer.pickup_start,
            pickup_end=offer.pickup_end,
            type=offer.type,
            status=offer.status,

            product_id=offer.product_id,
            product_name=(
                product.name
                if product is not None
                else None
            ),
            product_image_url=(
                product.image_url
                if product is not None
                else None
            ),
            category=(
                product.category
                if product is not None
                else None
            ),

            branch_id=branch.id,
            branch_name=branch.name,
            address=branch.address,
            latitude=branch.latitude,
            longitude=branch.longitude,

            business_id=business.id,
            business_name=business.name,
        )
        for offer, branch, business, product in rows
    ]


# GET ALL OFFERS
@router.get(
    "",
    response_model=list[OfferResponse],
)
def get_offers(
    db: Session = Depends(get_db),
):
    result = db.execute(
        select(Offer).order_by(
            Offer.created_at.desc(),
        )
    )

    return result.scalars().all()


# GET ONE OFFER
# ВАЖНО: этот route должен быть после /public
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
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Offer not found",
        )

    return offer