from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    status,
)
from sqlalchemy import desc, func, or_, select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db

from app.models.branch import Branch
from app.models.business import Business
from app.models.business_member import BusinessMember
from app.models.offer import Offer
from app.models.user import User

from app.schemas.business import (
    BusinessCatalogResponse,
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


# Объявлен до /{business_id}: иначе FastAPI примет "public"
# за UUID заведения и ответит 422.
@router.get(
    "/public",
    response_model=list[
        BusinessCatalogResponse
    ],
)
def get_public_businesses(
    search: str | None = Query(
        default=None,
        max_length=100,
        description=(
            "Поиск по названию "
            "и описанию"
        ),
    ),

    db: Session = Depends(get_db),
):
    """
    Каталог заведений для покупателя.

    Счётчик предложений считаем тем же условием, что и витрина
    (/offers/public), иначе в каталоге обещали бы предложения,
    которых на витрине уже нет.
    """
    active_offers = (
        select(func.count())
        .select_from(Offer)
        .join(
            Branch,
            Offer.branch_id
            == Branch.id,
        )
        .where(
            Branch.business_id
            == Business.id,

            Offer.status
            == "active",

            Offer.quantity_remaining
            > 0,

            Offer.pickup_end
            > func.now(),
        )
        .correlate(Business)
        .scalar_subquery()
    )

    branches = (
        select(func.count())
        .select_from(Branch)
        .where(
            Branch.business_id
            == Business.id
        )
        .correlate(Business)
        .scalar_subquery()
    )

    statement = select(
        Business,
        active_offers.label(
            "active_offers"
        ),
        branches.label("branches"),
    ).where(
        Business.status == "active"
    )

    term = (
        search.strip()
        if search
        else ""
    )

    if term:
        # ILIKE, а не полнотекстовый поиск: заведений немного,
        # а ищут люди по куску названия — «нан», «кофе».
        pattern = f"%{term}%"

        statement = statement.where(
            or_(
                Business.name.ilike(
                    pattern
                ),
                Business.description.ilike(
                    pattern
                ),
            )
        )

    # Сначала те, у кого есть что забрать прямо сейчас.
    statement = statement.order_by(
        desc("active_offers"),
        Business.name.asc(),
    )

    rows = db.execute(
        statement
    ).all()

    return [
        BusinessCatalogResponse(
            id=business.id,
            name=business.name,
            description=(
                business.description
            ),
            logo_url=(
                business.logo_url
            ),
            active_offers=(
                offers_count
            ),
            branches=(
                branches_count
            ),
        )
        for (
            business,
            offers_count,
            branches_count,
        ) in rows
    ]


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