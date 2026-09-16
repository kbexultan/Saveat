from datetime import datetime
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from sqlalchemy import (
    func,
    select,
)
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.business_access import (
    BUSINESS_ROLES,
    MANAGE_BUSINESS_ROLES,
    get_business_membership_or_403,
    require_business_access,
)
from app.database import get_db

from app.notifications import (
    NEW_OFFER,
    notify_business_subscribers,
)

from app.models.branch import Branch
from app.models.business import Business
from app.models.business_member import (
    BusinessMember,
)
from app.models.offer import Offer
from app.models.product import Product
from app.models.user import User

from app.schemas.offer import (
    OfferCreate,
    OfferPublicResponse,
    OfferResponse,
    OfferUpdate,
)


router = APIRouter(
    prefix="/offers",
    tags=["Offers"],
)


# --------------------------------
# СРОК ПРЕДЛОЖЕНИЯ
# --------------------------------
#
# Предложение с закрытым окном выдачи покупателю уже не показать:
# /offers/public отсекает его по pickup_end. В кабинете оно при этом
# оставалось «активным» — заведение видело активные позиции, ни одну
# из которых нельзя купить.
#
# Статус в базе — это намерение заведения (продаём / сняли с витрины),
# а срок считаем на чтении. Фоновой задачи в проекте нет, и заводить
# её ради этого не стоит: между запусками база всё равно врала бы, а
# витрина и так фильтрует по pickup_end — считаем тем же правилом.

EXPIRED_STATUS = "expired"


def effective_offer_status(
    offer: Offer,
    now: datetime,
) -> str:
    # sold_out не перекрываем: «всё разобрали» и «не успели продать» —
    # разный итог, и заведению важно их различать.
    if offer.status == "sold_out":
        return offer.status

    if offer.pickup_end <= now:
        return EXPIRED_STATUS

    return offer.status


def build_offer_response(
    offer: Offer,
    now: datetime,
) -> OfferResponse:
    return (
        OfferResponse
        .model_validate(offer)
        .model_copy(
            update={
                "status": (
                    effective_offer_status(
                        offer,
                        now,
                    )
                ),
            },
        )
    )


def database_now(db: Session) -> datetime:
    return (
        db.execute(
            select(func.now())
        )
        .scalar_one()
    )


# --------------------------------
# CREATE OFFER
# --------------------------------

@router.post(
    "",
    response_model=OfferResponse,
    status_code=(
        status.HTTP_201_CREATED
    ),
)
def create_offer(
    data: OfferCreate,

    current_user: User = Depends(
        get_current_user
    ),

    db: Session = Depends(
        get_db
    ),
):
    branch = db.get(
        Branch,
        data.branch_id,
    )

    if branch is None:
        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
            ),
            detail="Branch not found",
        )

    # Главное:
    # проверяем, имеет ли User
    # право управлять бизнесом,
    # которому принадлежит branch.
    get_business_membership_or_403(
        db=db,
        user_id=current_user.id,
        business_id=(
            branch.business_id
        ),
        allowed_roles=(
            MANAGE_BUSINESS_ROLES
        ),
    )

    product = None

    if (
        data.product_id
        is not None
    ):
        product = db.get(
            Product,
            data.product_id,
        )

        if product is None:
            raise HTTPException(
                status_code=(
                    status.HTTP_404_NOT_FOUND
                ),
                detail=(
                    "Product not found"
                ),
            )

        if (
            product.business_id
            != branch.business_id
        ):
            raise HTTPException(
                status_code=(
                    status.HTTP_400_BAD_REQUEST
                ),
                detail=(
                    "Product and branch "
                    "belong to different "
                    "businesses"
                ),
            )

    # Окно выдачи уже закрылось — такое предложение на витрину не
    # попадёт (/offers/public фильтрует по pickup_end), а уведомление
    # подписчикам уйдёт. Опечатку в дате ловим здесь, а не рассылкой
    # про несуществующую скидку.
    db_now = database_now(db)

    if data.pickup_end <= db_now:
        raise HTTPException(
            status_code=(
                status.HTTP_400_BAD_REQUEST
            ),
            detail=(
                "pickup_end is already "
                "in the past"
            ),
        )

    offer = Offer(
        branch_id=(
            data.branch_id
        ),

        product_id=(
            data.product_id
        ),

        type=data.type,

        title=(
            data.title.strip()
        ),

        description=(
            data.description
        ),

        original_price=(
            data.original_price
        ),

        sale_price=(
            data.sale_price
        ),

        quantity_total=(
            data.quantity_total
        ),

        quantity_remaining=(
            data.quantity_total
        ),

        pickup_start=(
            data.pickup_start
        ),

        pickup_end=(
            data.pickup_end
        ),

        status="active",
    )

    db.add(offer)

    try:
        business = db.get(
            Business,
            branch.business_id,
        )

        if business is not None:
            discount = 0

            if data.original_price > 0:
                discount = round(
                    (
                        1
                        - float(
                            data.sale_price
                            / data.original_price
                        )
                    )
                    * 100
                )

            notify_business_subscribers(
                db,
                business_id=business.id,
                type=NEW_OFFER,
                title=f"Новое в «{business.name}»",
                body=(
                    f"{data.title} — "
                    f"{data.sale_price:.0f} ₸ "
                    f"вместо {data.original_price:.0f} ₸"
                    + (f" (-{discount}%)" if discount > 0 else "")
                    + f". Забрать в «{branch.name}»."
                ),
            )

        db.commit()
        db.refresh(offer)

    except Exception:
        db.rollback()
        raise

    return build_offer_response(
        offer,
        db_now,
    )


# --------------------------------
# PUBLIC OFFERS
# --------------------------------

@router.get(
    "/public",
    response_model=list[
        OfferPublicResponse
    ],
)
def get_public_offers(
    business_id: UUID | None = None,

    db: Session = Depends(
        get_db
    ),
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
            Offer.branch_id
            == Branch.id,
        )
        .join(
            Business,
            Branch.business_id
            == Business.id,
        )
        .outerjoin(
            Product,
            Offer.product_id
            == Product.id,
        )
        .where(
            Offer.status
            == "active",

            Offer.quantity_remaining
            > 0,

            Offer.pickup_end
            > func.now(),

            Business.status
            == "active",
        )
        .order_by(
            Offer.created_at.desc()
        )
    )

    if business_id is not None:
        # Витрина одного заведения на его странице.
        statement = statement.where(
            Business.id
            == business_id
        )

    rows = db.execute(
        statement
    ).all()

    return [
        OfferPublicResponse(
            id=offer.id,

            title=offer.title,

            description=(
                offer.description
            ),

            original_price=(
                offer.original_price
            ),

            sale_price=(
                offer.sale_price
            ),

            quantity_remaining=(
                offer.quantity_remaining
            ),

            pickup_start=(
                offer.pickup_start
            ),

            pickup_end=(
                offer.pickup_end
            ),

            type=offer.type,
            status=offer.status,

            product_id=(
                offer.product_id
            ),

            product_name=(
                product.name
                if product
                is not None
                else None
            ),

            product_image_url=(
                product.image_url
                if product
                is not None
                else None
            ),

            category=(
                product.category
                if product
                is not None
                else None
            ),

            branch_id=(
                branch.id
            ),

            branch_name=(
                branch.name
            ),

            address=(
                branch.address
            ),

            latitude=(
                branch.latitude
            ),

            longitude=(
                branch.longitude
            ),

            business_id=(
                business.id
            ),

            business_name=(
                business.name
            ),
        )
        for (
            offer,
            branch,
            business,
            product,
        ) in rows
    ]


# --------------------------------
# PRIVATE BUSINESS OFFERS
# --------------------------------

@router.get(
    "/business/{business_id}",
    response_model=list[
        OfferResponse
    ],
)
def get_business_offers(
    business_id: UUID,

    _membership: BusinessMember = Depends(
        require_business_access(
            *BUSINESS_ROLES
        )
    ),

    db: Session = Depends(
        get_db
    ),
):
    result = db.execute(
        select(Offer)
        .join(
            Branch,
            Offer.branch_id
            == Branch.id,
        )
        .where(
            Branch.business_id
            == business_id
        )
        .order_by(
            Offer.created_at.desc()
        )
    )

    # Время берём один раз на весь список, иначе соседние строки
    # могут разойтись по разные стороны одной и той же секунды.
    db_now = database_now(db)

    return [
        build_offer_response(
            offer,
            db_now,
        )
        for offer in result.scalars().all()
    ]


# --------------------------------
# GET ALL — удалён
# --------------------------------
#
# Здесь был GET /offers без авторизации, отдававший все предложения
# всех заведений: снятые с продажи, распроданные и с quantity_total,
# то есть чужую внутреннюю кухню кому угодно. Его никто не вызывал —
# витрине хватает /offers/public, кабинету /offers/business/{id}.


# --------------------------------
# GET ONE
# --------------------------------
#
# Должен оставаться ПОСЛЕ
# /public и /business/{business_id}.

@router.get(
    "/{offer_id}",
    response_model=OfferResponse,
)
def get_offer(
    offer_id: UUID,

    current_user: User = Depends(
        get_current_user
    ),

    db: Session = Depends(
        get_db
    ),
):
    offer = db.get(
        Offer,
        offer_id,
    )

    if offer is None:
        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
            ),
            detail="Offer not found",
        )

    branch = db.get(
        Branch,
        offer.branch_id,
    )

    if branch is None:
        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
            ),
            detail="Offer not found",
        )

    # OfferResponse — внутренний вид: quantity_total, статус паузы или
    # распроданности, точное время создания. Покупателю с витрины
    # хватает /offers/public; этот эндпоинт дёргает только кабинет
    # заведения, поэтому доступ проверяем так же, как в остальном
    # кабинете — по членству в бизнесе, а не по факту авторизации.
    get_business_membership_or_403(
        db=db,
        user_id=current_user.id,
        business_id=branch.business_id,
        allowed_roles=BUSINESS_ROLES,
    )

    return build_offer_response(
        offer,
        database_now(db),
    )

# --------------------------------
# ОБНОВЛЕНИЕ OFFER
# --------------------------------
#
# Здесь же включение/отключение
# предложения (status).
#
# branch_id / product_id / type
# менять нельзя: они определяют,
# какому бизнесу принадлежит offer.

@router.patch(
    "/{offer_id}",
    response_model=OfferResponse,
)
def update_offer(
    offer_id: UUID,
    data: OfferUpdate,

    current_user: User = Depends(
        get_current_user
    ),

    db: Session = Depends(
        get_db
    ),
):
    try:
        # Блокируем offer: параллельный
        # checkout не должен менять
        # остаток, пока мы пересчитываем
        # quantity_total.
        offer = (
            db.execute(
                select(Offer)
                .where(
                    Offer.id
                    == offer_id
                )
                .with_for_update()
            )
            .scalar_one_or_none()
        )

        if offer is None:
            raise HTTPException(
                status_code=404,
                detail="Offer not found",
            )

        branch = db.get(
            Branch,
            offer.branch_id,
        )

        if branch is None:
            raise HTTPException(
                status_code=404,
                detail="Branch not found",
            )

        get_business_membership_or_403(
            db=db,
            user_id=current_user.id,
            business_id=(
                branch.business_id
            ),
            allowed_roles=(
                MANAGE_BUSINESS_ROLES
            ),
        )

        changes = data.model_dump(
            exclude_unset=True,
        )

        db_now = database_now(db)

        if not changes:
            db.rollback()

            return build_offer_response(
                offer,
                db_now,
            )

        new_status = changes.pop(
            "status",
            None,
        )

        # --------------------------------
        # ЦЕНЫ
        # --------------------------------

        original_price = changes.get(
            "original_price",
            offer.original_price,
        )

        sale_price = changes.get(
            "sale_price",
            offer.sale_price,
        )

        if sale_price > original_price:
            raise HTTPException(
                status_code=400,
                detail=(
                    "sale_price cannot be "
                    "greater than "
                    "original_price"
                ),
            )

        # --------------------------------
        # ВРЕМЯ ПОЛУЧЕНИЯ
        # --------------------------------

        pickup_start = changes.get(
            "pickup_start",
            offer.pickup_start,
        )

        pickup_end = changes.get(
            "pickup_end",
            offer.pickup_end,
        )

        if pickup_end <= pickup_start:
            raise HTTPException(
                status_code=400,
                detail=(
                    "pickup_end must be "
                    "later than pickup_start"
                ),
            )

        # --------------------------------
        # КОЛИЧЕСТВО
        # --------------------------------
        #
        # Забронированное покупателями
        # количество уменьшать нельзя.

        reserved = (
            offer.quantity_total
            - offer.quantity_remaining
        )

        quantity_total = changes.get(
            "quantity_total",
            offer.quantity_total,
        )

        if quantity_total < reserved:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Quantity cannot be "
                    "lower than already "
                    f"ordered amount: "
                    f"{reserved}"
                ),
            )

        quantity_remaining = (
            quantity_total - reserved
        )

        for field, value in changes.items():
            setattr(
                offer,
                field,
                value,
            )

        offer.quantity_remaining = (
            quantity_remaining
        )

        # --------------------------------
        # СТАТУС
        # --------------------------------

        # Сравниваем с новым окном выдачи, а не с сохранённым: продлить
        # срок и включить предложение можно одним запросом.
        is_expired = pickup_end <= db_now

        if new_status == "paused":
            offer.status = "paused"

        elif new_status == "active":
            if is_expired:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "Extend pickup_end "
                        "before activating "
                        "this offer"
                    ),
                )

            if quantity_remaining <= 0:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "Increase quantity "
                        "before activating "
                        "this offer"
                    ),
                )

            offer.status = "active"

        else:
            # Статус не присылали:
            # приводим в соответствие
            # с остатком.
            if (
                quantity_remaining <= 0
                and offer.status
                == "active"
            ):
                offer.status = "sold_out"

            elif (
                quantity_remaining > 0
                and offer.status
                == "sold_out"
                and not is_expired
            ):
                # Просроченному предложению «распродано» оставляем:
                # это его итог, а вернуть его в продажу изменением
                # количества всё равно нельзя.
                offer.status = "active"

        db.commit()
        db.refresh(offer)

        return build_offer_response(
            offer,
            db_now,
        )

    except HTTPException:
        db.rollback()
        raise

    except Exception:
        db.rollback()
        raise
