import uuid
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Response,
    status,
)
from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models.branch import Branch
from app.models.business import Business
from app.models.business_subscription import BusinessSubscription
from app.models.offer import Offer
from app.models.user import User
from app.schemas.business_subscription import (
    SubscribedBusinessResponse,
)


router = APIRouter(
    prefix="/business-subscriptions",
    tags=["Business subscriptions"],
)


@router.get(
    "",
    response_model=list[SubscribedBusinessResponse],
)
def get_subscriptions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Считаем доступные предложения тем же условием, что и витрина,
    # иначе в подписках светились бы просроченные и распроданные.
    active_offers = (
        select(func.count())
        .select_from(Offer)
        .join(Branch, Offer.branch_id == Branch.id)
        .where(
            Branch.business_id == Business.id,
            Offer.status == "active",
            Offer.quantity_remaining > 0,
            Offer.pickup_end > func.now(),
        )
        .correlate(Business)
        .scalar_subquery()
    )

    rows = db.execute(
        select(
            Business,
            BusinessSubscription.created_at,
            active_offers,
        )
        .join(
            BusinessSubscription,
            BusinessSubscription.business_id == Business.id,
        )
        .where(
            BusinessSubscription.user_id == current_user.id,
            Business.status == "active",
        )
        .order_by(BusinessSubscription.created_at.desc())
    ).all()

    return [
        SubscribedBusinessResponse(
            id=business.id,
            name=business.name,
            description=business.description,
            logo_url=business.logo_url,
            active_offers=offers_count,
            subscribed_at=subscribed_at,
        )
        for business, subscribed_at, offers_count in rows
    ]


@router.get(
    "/ids",
    response_model=list[UUID],
)
def get_subscription_ids(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Лёгкий список id — по нему кнопка «Подписаться» на карточках
    понимает своё состояние, не загружая заведения целиком.
    """
    result = db.execute(
        select(BusinessSubscription.business_id).where(
            BusinessSubscription.user_id == current_user.id
        )
    )

    return list(result.scalars().all())


@router.put(
    "/{business_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def subscribe(
    business_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    business = db.execute(
        select(Business).where(
            Business.id == business_id,
            Business.status == "active",
        )
    ).scalar_one_or_none()

    if business is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business is not available",
        )

    # on_conflict_do_nothing: повторное нажатие не должно падать —
    # кнопку легко нажать дважды на медленной сети.
    statement = (
        insert(BusinessSubscription)
        .values(
            id=uuid.uuid4(),
            user_id=current_user.id,
            business_id=business_id,
        )
        .on_conflict_do_nothing(
            index_elements=[
                BusinessSubscription.user_id,
                BusinessSubscription.business_id,
            ],
        )
    )

    try:
        db.execute(statement)
        db.commit()
    except Exception:
        db.rollback()
        raise

    return Response(
        status_code=status.HTTP_204_NO_CONTENT
    )


@router.delete(
    "/{business_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def unsubscribe(
    business_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    try:
        db.execute(
            delete(BusinessSubscription).where(
                BusinessSubscription.user_id == current_user.id,
                BusinessSubscription.business_id == business_id,
            )
        )

        db.commit()
    except Exception:
        db.rollback()
        raise

    return Response(
        status_code=status.HTTP_204_NO_CONTENT
    )
