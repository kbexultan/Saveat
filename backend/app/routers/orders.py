import uuid
from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db

from app.models.branch import Branch
from app.models.business import Business
from app.models.offer import Offer
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.product import Product
from app.models.user import User

from app.schemas.order import (
    CheckoutItem,
    CheckoutRequest,
    OrderCreate,
    OrderDetailsResponse,
    OrderItemResponse,
    OrderResponse,
)


router = APIRouter(
    prefix="/orders",
    tags=["Orders"],
)


def generate_pickup_code() -> str:
    code = (
        uuid.uuid4()
        .hex[:10]
        .upper()
    )

    return f"SVT-{code}"


def build_order_response(
    order: Order,
    db: Session,
) -> OrderDetailsResponse:
    items = (
        db.execute(
            select(OrderItem)
            .where(
                OrderItem.order_id
                == order.id
            )
            .order_by(
                OrderItem.id
            )
        )
        .scalars()
        .all()
    )

    if order.branch_id is None:
        raise RuntimeError(
            "Order has no branch_id"
        )

    if order.business_name is None:
        raise RuntimeError(
            "Order has no business_name"
        )

    if order.branch_name is None:
        raise RuntimeError(
            "Order has no branch_name"
        )

    if order.address is None:
        raise RuntimeError(
            "Order has no address"
        )

    if order.pickup_start is None:
        raise RuntimeError(
            "Order has no pickup_start"
        )

    if order.pickup_end is None:
        raise RuntimeError(
            "Order has no pickup_end"
        )

    return OrderDetailsResponse(
        id=order.id,
        user_id=order.user_id,
        branch_id=order.branch_id,

        business_name=(
            order.business_name
        ),

        branch_name=(
            order.branch_name
        ),

        address=order.address,

        pickup_start=(
            order.pickup_start
        ),

        pickup_end=(
            order.pickup_end
        ),

        total_price=(
            order.total_price
        ),

        payment_method=(
            order.payment_method
        ),

        status=order.status,

        pickup_code=(
            order.pickup_code
        ),

        created_at=(
            order.created_at
        ),

        picked_up_at=(
            order.picked_up_at
        ),

        items=[
            OrderItemResponse.model_validate(
                item
            )
            for item in items
        ],
    )


def create_checkout_order(
    data: CheckoutRequest,
    current_user: User,
    db: Session,
) -> OrderDetailsResponse:
    # Если один offer случайно
    # пришёл два раза —
    # объединяем количество.
    quantities: dict[
        UUID,
        int,
    ] = {}

    for item in data.items:
        quantities[item.offer_id] = (
            quantities.get(
                item.offer_id,
                0,
            )
            + item.quantity
        )

    for quantity in quantities.values():
        if quantity > 20:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Maximum quantity "
                    "per offer is 20"
                ),
            )

    offer_ids = sorted(
        quantities.keys(),
        key=str,
    )

    try:
        # Блокируем все товары корзины.
        # Пока checkout идёт,
        # другой запрос не сможет
        # одновременно забрать
        # тот же остаток.
        offers = (
            db.execute(
                select(Offer)
                .where(
                    Offer.id.in_(
                        offer_ids
                    )
                )
                .order_by(
                    Offer.id
                )
                .with_for_update()
            )
            .scalars()
            .all()
        )

        if len(offers) != len(
            offer_ids
        ):
            raise HTTPException(
                status_code=404,
                detail=(
                    "One or more offers "
                    "were not found"
                ),
            )

        # Одна корзина =
        # один филиал.
        branch_ids = {
            offer.branch_id
            for offer in offers
        }

        if len(branch_ids) != 1:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Cart must contain "
                    "offers from one branch"
                ),
            )

        db_now = (
            db.execute(
                select(func.now())
            )
            .scalar_one()
        )

        # Проверяем остатки
        # до создания заказа.
        for offer in offers:
            quantity = quantities[
                offer.id
            ]

            if offer.status != "active":
                raise HTTPException(
                    status_code=409,
                    detail=(
                        f"{offer.title} "
                        "is unavailable"
                    ),
                )

            if (
                offer.pickup_end
                <= db_now
            ):
                raise HTTPException(
                    status_code=409,
                    detail=(
                        f"{offer.title} "
                        "has expired"
                    ),
                )

            if (
                offer.quantity_remaining
                < quantity
            ):
                raise HTTPException(
                    status_code=409,
                    detail=(
                        f"Not enough "
                        f"{offer.title}. "
                        f"Available: "
                        f"{offer.quantity_remaining}"
                    ),
                )

        # Находим общий промежуток
        # получения всех товаров.
        pickup_start = max(
            offer.pickup_start
            for offer in offers
        )

        pickup_end = min(
            offer.pickup_end
            for offer in offers
        )

        if (
            pickup_start
            >= pickup_end
        ):
            raise HTTPException(
                status_code=409,
                detail=(
                    "Selected offers do "
                    "not have a common "
                    "pickup time"
                ),
            )

        branch_id = next(
            iter(branch_ids)
        )

        branch = db.get(
            Branch,
            branch_id,
        )

        if branch is None:
            raise HTTPException(
                status_code=404,
                detail="Branch not found",
            )

        business = db.get(
            Business,
            branch.business_id,
        )

        if business is None:
            raise HTTPException(
                status_code=404,
                detail="Business not found",
            )

        # --------------------------------
        # ОДИН ORDER НА ВСЮ КОРЗИНУ
        # --------------------------------

        order = Order(
            user_id=current_user.id,

            branch_id=branch.id,

            business_name=(
                business.name
            ),

            branch_name=(
                branch.name
            ),

            address=(
                branch.address
            ),

            pickup_start=(
                pickup_start
            ),

            pickup_end=(
                pickup_end
            ),

            total_price=Decimal(
                "0.00"
            ),

            payment_method=(
                data.payment_method
            ),

            status="reserved",

            pickup_code=(
                generate_pickup_code()
            ),

            # Старые поля больше
            # не используются.
            offer_id=None,
            quantity=None,
            unit_price=None,
        )

        db.add(order)

        # Получаем UUID заказа
        # до commit.
        db.flush()

        grand_total = Decimal(
            "0.00"
        )

        # --------------------------------
        # ORDER ITEMS
        # --------------------------------

        for offer in offers:
            quantity = quantities[
                offer.id
            ]

            unit_price = (
                offer.sale_price
            )

            item_total = (
                unit_price
                * quantity
            )

            product = None

            if (
                offer.product_id
                is not None
            ):
                product = db.get(
                    Product,
                    offer.product_id,
                )

            order_item = OrderItem(
                order_id=order.id,

                offer_id=offer.id,

                offer_title=(
                    offer.title
                ),

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

                quantity=quantity,

                unit_price=(
                    unit_price
                ),

                total_price=(
                    item_total
                ),
            )

            db.add(order_item)

            grand_total += (
                item_total
            )

            # Реальный остаток.
            offer.quantity_remaining -= (
                quantity
            )

            if (
                offer.quantity_remaining
                == 0
            ):
                offer.status = (
                    "sold_out"
                )

        order.total_price = (
            grand_total
        )

        db.commit()
        db.refresh(order)

        return build_order_response(
            order,
            db,
        )

    except HTTPException:
        db.rollback()
        raise

    except Exception:
        db.rollback()
        raise


# --------------------------------
# Старый POST /orders
# --------------------------------
#
# Оставляем для совместимости.
# Просто превращаем один товар
# в checkout из одного элемента.

@router.post(
    "",
    response_model=OrderResponse,
    status_code=(
        status.HTTP_201_CREATED
    ),
)
def create_order(
    data: OrderCreate,
    current_user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(
        get_db
    ),
):
    checkout_data = CheckoutRequest(
        items=[
            CheckoutItem(
                offer_id=(
                    data.offer_id
                ),
                quantity=(
                    data.quantity
                ),
            )
        ],
        payment_method=(
            "pay_on_pickup"
        ),
    )

    return create_checkout_order(
        checkout_data,
        current_user,
        db,
    )


# --------------------------------
# CHECKOUT КОРЗИНЫ
# --------------------------------

@router.post(
    "/checkout",
    response_model=OrderResponse,
    status_code=(
        status.HTTP_201_CREATED
    ),
)
def checkout(
    data: CheckoutRequest,
    current_user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(
        get_db
    ),
):
    return create_checkout_order(
        data,
        current_user,
        db,
    )


# --------------------------------
# МОИ ЗАКАЗЫ
# --------------------------------

@router.get(
    "",
    response_model=list[
        OrderDetailsResponse
    ],
)
def get_orders(
    current_user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(
        get_db
    ),
):
    orders = (
        db.execute(
            select(Order)
            .where(
                Order.user_id
                == current_user.id
            )
            .order_by(
                Order.created_at.desc()
            )
        )
        .scalars()
        .all()
    )

    return [
        build_order_response(
            order,
            db,
        )
        for order in orders
    ]


# --------------------------------
# ОДИН ЗАКАЗ
# --------------------------------

@router.get(
    "/{order_id}",
    response_model=(
        OrderDetailsResponse
    ),
)
def get_order(
    order_id: UUID,
    current_user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(
        get_db
    ),
):
    order = db.get(
        Order,
        order_id,
    )

    if order is None:
        raise HTTPException(
            status_code=404,
            detail="Order not found",
        )

    if (
        order.user_id
        != current_user.id
    ):
        raise HTTPException(
            status_code=403,
            detail=(
                "You do not have "
                "access to this order"
            ),
        )

    return build_order_response(
        order,
        db,
    )


# --------------------------------
# ОТМЕНА
# --------------------------------

@router.post(
    "/{order_id}/cancel",
    response_model=(
        OrderDetailsResponse
    ),
)
def cancel_order(
    order_id: UUID,
    current_user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(
        get_db
    ),
):
    try:
        # Блокируем Order,
        # чтобы отмена не прошла
        # дважды одновременно.
        order = (
            db.execute(
                select(Order)
                .where(
                    Order.id
                    == order_id
                )
                .with_for_update()
            )
            .scalar_one_or_none()
        )

        if order is None:
            raise HTTPException(
                status_code=404,
                detail="Order not found",
            )

        if (
            order.user_id
            != current_user.id
        ):
            raise HTTPException(
                status_code=403,
                detail=(
                    "You do not have "
                    "access to this order"
                ),
            )

        if (
            order.status
            == "cancelled"
        ):
            raise HTTPException(
                status_code=409,
                detail=(
                    "Order is already "
                    "cancelled"
                ),
            )

        if (
            order.status
            == "picked_up"
        ):
            raise HTTPException(
                status_code=409,
                detail=(
                    "Picked up order "
                    "cannot be cancelled"
                ),
            )

        if (
            order.status
            != "reserved"
        ):
            raise HTTPException(
                status_code=409,
                detail=(
                    "Order cannot "
                    "be cancelled"
                ),
            )

        items = (
            db.execute(
                select(OrderItem)
                .where(
                    OrderItem.order_id
                    == order.id
                )
            )
            .scalars()
            .all()
        )

        offer_ids = sorted(
            [
                item.offer_id
                for item in items
                if item.offer_id
                is not None
            ],
            key=str,
        )

        # Блокируем offers
        # в одинаковом порядке.
        offers = []

        if offer_ids:
            offers = (
                db.execute(
                    select(Offer)
                    .where(
                        Offer.id.in_(
                            offer_ids
                        )
                    )
                    .order_by(
                        Offer.id
                    )
                    .with_for_update()
                )
                .scalars()
                .all()
            )

        offers_by_id = {
            offer.id: offer
            for offer in offers
        }

        db_now = (
            db.execute(
                select(func.now())
            )
            .scalar_one()
        )

        # Возвращаем ВСЕ товары
        # заказа обратно.
        for item in items:
            if (
                item.offer_id
                is None
            ):
                continue

            offer = (
                offers_by_id.get(
                    item.offer_id
                )
            )

            if offer is None:
                continue

            offer.quantity_remaining = min(
                offer.quantity_total,
                (
                    offer.quantity_remaining
                    + item.quantity
                ),
            )

            if (
                offer.status
                == "sold_out"
                and
                offer.pickup_end
                > db_now
            ):
                offer.status = (
                    "active"
                )

        order.status = (
            "cancelled"
        )

        db.commit()
        db.refresh(order)

        return build_order_response(
            order,
            db,
        )

    except HTTPException:
        db.rollback()
        raise

    except Exception:
        db.rollback()
        raise


# --------------------------------
# ПОЛУЧЕНИЕ
# --------------------------------
#
# Пока временно клиентский endpoint.
# Позже его перенесём в кабинет
# бизнеса и будем подтверждать
# по pickup_code.

@router.post(
    "/{order_id}/pickup",
    response_model=(
        OrderDetailsResponse
    ),
)
def confirm_pickup(
    order_id: UUID,
    current_user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(
        get_db
    ),
):
    order = db.get(
        Order,
        order_id,
    )

    if order is None:
        raise HTTPException(
            status_code=404,
            detail="Order not found",
        )

    if (
        order.user_id
        != current_user.id
    ):
        raise HTTPException(
            status_code=403,
            detail=(
                "You do not have "
                "access to this order"
            ),
        )

    if (
        order.status
        == "picked_up"
    ):
        raise HTTPException(
            status_code=409,
            detail=(
                "Order has already "
                "been picked up"
            ),
        )

    if order.status not in {
        "reserved",
        "paid",
        "ready",
    }:
        raise HTTPException(
            status_code=409,
            detail=(
                "Order cannot "
                "be picked up"
            ),
        )

    order.status = (
        "picked_up"
    )

    order.picked_up_at = (
        datetime.now(
            timezone.utc
        )
    )

    db.commit()
    db.refresh(order)

    return build_order_response(
        order,
        db,
    )