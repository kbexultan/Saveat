import uuid
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models.branch import Branch
from app.models.business import Business
from app.models.favorite import Favorite
from app.models.offer import Offer
from app.models.product import Product
from app.models.user import User
from app.schemas.offer import OfferPublicResponse


router = APIRouter(
    prefix="/favorites",
    tags=["Favorites"],
)


@router.get(
    "",
    response_model=list[OfferPublicResponse],
)
def get_favorites(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    statement = (
        select(
            Offer,
            Branch,
            Business,
            Product,
        )
        .select_from(Favorite)
        .join(
            Offer,
            Favorite.offer_id == Offer.id,
        )
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
            Favorite.user_id == current_user.id,
            Offer.status == "active",
            Offer.quantity_remaining > 0,
            Offer.pickup_end > func.now(),
            Business.status == "active",
        )
        .order_by(Favorite.created_at.desc())
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


@router.get(
    "/ids",
    response_model=list[UUID],
)
def get_favorite_ids(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = db.execute(
        select(Favorite.offer_id)
        .where(Favorite.user_id == current_user.id)
        .order_by(Favorite.created_at.desc())
    )

    return list(result.scalars().all())


@router.put(
    "/{offer_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def add_favorite(
    offer_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    available_offer_id = db.execute(
        select(Offer.id)
        .join(
            Branch,
            Offer.branch_id == Branch.id,
        )
        .join(
            Business,
            Branch.business_id == Business.id,
        )
        .where(
            Offer.id == offer_id,
            Offer.status == "active",
            Offer.quantity_remaining > 0,
            Offer.pickup_end > func.now(),
            Business.status == "active",
        )
    ).scalar_one_or_none()

    if available_offer_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Offer is not available",
        )

    statement = (
        insert(Favorite)
        .values(
            id=uuid.uuid4(),
            user_id=current_user.id,
            offer_id=offer_id,
        )
        .on_conflict_do_nothing(
            index_elements=[
                Favorite.user_id,
                Favorite.offer_id,
            ],
        )
    )

    try:
        db.execute(statement)
        db.commit()
    except Exception:
        db.rollback()
        raise

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete(
    "/{offer_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_favorite(
    offer_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    try:
        db.execute(
            delete(Favorite).where(
                Favorite.user_id == current_user.id,
                Favorite.offer_id == offer_id,
            )
        )
        db.commit()
    except Exception:
        db.rollback()
        raise

    return Response(status_code=status.HTTP_204_NO_CONTENT)
