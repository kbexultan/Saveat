from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.business_access import (
    ORDER_ROLES,
    require_business_access,
)
from app.database import get_db

from app.notifications import (
    ORDER_PICKED_UP,
    create_notification,
)

from app.models.branch import Branch
from app.models.business_member import BusinessMember
from app.models.order import Order
from app.models.order_item import OrderItem

from app.schemas.order import (
    OrderDetailsResponse,
    OrderItemResponse,
)


router = APIRouter(
    prefix="/business-orders",
    tags=["Business Orders"],
)


def has_full_snapshot(order: Order) -> bool:
    """
    Можно ли показать заказ.

    Заказ старого формата (без snapshot заведения) отдать нечем.
    Такие строки пропускаем в списке и объясняем в 409 поштучно,
    иначе одна битая строка роняла бы весь кабинет в 500.
    """
    return not (
        order.branch_id is None
        or order.business_name is None
        or order.branch_name is None
        or order.address is None
        or order.pickup_start is None
        or order.pickup_end is None
    )


def build_business_order_response(
    order: Order,
    db: Session,
    items: list[OrderItem] | None = None,
) -> OrderDetailsResponse:
    # items передают, когда позиции уже загружены пачкой для списка:
    # иначе на каждый заказ уходит отдельный запрос к базе.
    if items is None:
        items = list(
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

    if not has_full_snapshot(order):
        raise HTTPException(
            status_code=409,
            detail=(
                "Order is stored in an "
                "old format and cannot "
                "be shown"
            ),
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


# --------------------------------
# ВСЕ ЗАКАЗЫ БИЗНЕСА
# --------------------------------

@router.get(
    "/{business_id}",
    response_model=list[
        OrderDetailsResponse
    ],
)
def get_business_orders(
    business_id: UUID,

    _membership: BusinessMember = Depends(
        require_business_access(
            *ORDER_ROLES
        )
    ),

    db: Session = Depends(
        get_db
    ),
):
    orders = (
        db.execute(
            select(Order)
            .join(
                Branch,
                Order.branch_id
                == Branch.id,
            )
            .where(
                Branch.business_id
                == business_id
            )
            .order_by(
                Order.created_at.desc()
            )
        )
        .scalars()
        .all()
    )

    items_by_order: dict[UUID, list[OrderItem]] = {}

    if orders:
        rows = (
            db.execute(
                select(OrderItem)
                .where(
                    OrderItem.order_id.in_(
                        [order.id for order in orders]
                    )
                )
                .order_by(OrderItem.id)
            )
            .scalars()
            .all()
        )

        for row in rows:
            items_by_order.setdefault(
                row.order_id,
                [],
            ).append(row)

    return [
        build_business_order_response(
            order,
            db,
            items_by_order.get(order.id, []),
        )
        # Заказы старого формата пропускаем: кабинет должен открыться
        # со всеми остальными, а не упасть целиком из-за одной строки.
        for order in orders
        if has_full_snapshot(order)
    ]


# --------------------------------
# ПОИСК ПО PICKUP CODE
# --------------------------------

@router.get(
    "/{business_id}/pickup/{pickup_code}",
    response_model=(
        OrderDetailsResponse
    ),
)
def get_order_by_pickup_code(
    business_id: UUID,
    pickup_code: str,

    _membership: BusinessMember = Depends(
        require_business_access(
            *ORDER_ROLES
        )
    ),

    db: Session = Depends(
        get_db
    ),
):
    normalized_code = (
        pickup_code
        .strip()
        .upper()
    )

    order = (
        db.execute(
            select(Order)
            .join(
                Branch,
                Order.branch_id
                == Branch.id,
            )
            .where(
                func.upper(
                    Order.pickup_code
                )
                == normalized_code,

                Branch.business_id
                == business_id,
            )
        )
        .scalar_one_or_none()
    )

    if order is None:
        raise HTTPException(
            status_code=404,
            detail=(
                "Order with this "
                "pickup code was not found"
            ),
        )

    return (
        build_business_order_response(
            order,
            db,
        )
    )


# --------------------------------
# ВЫДАТЬ ЗАКАЗ
# --------------------------------

@router.post(
    "/{business_id}/pickup/{pickup_code}/confirm",
    response_model=(
        OrderDetailsResponse
    ),
)
def confirm_business_pickup(
    business_id: UUID,
    pickup_code: str,

    _membership: BusinessMember = Depends(
        require_business_access(
            *ORDER_ROLES
        )
    ),

    db: Session = Depends(
        get_db
    ),
):
    normalized_code = (
        pickup_code
        .strip()
        .upper()
    )

    try:
        order = (
            db.execute(
                select(Order)
                .join(
                    Branch,
                    Order.branch_id
                    == Branch.id,
                )
                .where(
                    func.upper(
                        Order.pickup_code
                    )
                    == normalized_code,

                    Branch.business_id
                    == business_id,
                )
                .with_for_update(
                    of=Order
                )
            )
            .scalar_one_or_none()
        )

        if order is None:
            raise HTTPException(
                status_code=404,
                detail=(
                    "Order with this "
                    "pickup code was not found"
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

        if (
            order.status
            == "cancelled"
        ):
            raise HTTPException(
                status_code=409,
                detail=(
                    "Cancelled order "
                    "cannot be picked up"
                ),
            )

        if order.status not in {
            "reserved",
            "ready",
            "paid",
        }:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Order cannot "
                    "be picked up"
                ),
            )

        db_now = (
            db.execute(
                select(func.now())
            )
            .scalar_one()
        )

        order.status = (
            "picked_up"
        )

        order.picked_up_at = (
            db_now
        )

        create_notification(
            db,
            user_id=order.user_id,
            type=ORDER_PICKED_UP,
            title="Заказ выдан",
            body=(
                f"Заказ {order.pickup_code} "
                f"в «{order.branch_name}» выдан. "
                "Приятного аппетита!"
            ),
            order_id=order.id,
        )

        db.commit()
        db.refresh(order)

        return (
            build_business_order_response(
                order,
                db,
            )
        )

    except HTTPException:
        db.rollback()
        raise

    except Exception:
        db.rollback()
        raise


# --------------------------------
# ОДИН ЗАКАЗ ПО ID
# --------------------------------

@router.get(
    "/{business_id}/{order_id}",
    response_model=(
        OrderDetailsResponse
    ),
)
def get_business_order(
    business_id: UUID,
    order_id: UUID,

    _membership: BusinessMember = Depends(
        require_business_access(
            *ORDER_ROLES
        )
    ),

    db: Session = Depends(
        get_db
    ),
):
    order = (
        db.execute(
            select(Order)
            .join(
                Branch,
                Order.branch_id
                == Branch.id,
            )
            .where(
                Order.id
                == order_id,

                Branch.business_id
                == business_id,
            )
        )
        .scalar_one_or_none()
    )

    if order is None:
        raise HTTPException(
            status_code=404,
            detail="Order not found",
        )

    return (
        build_business_order_response(
            order,
            db,
        )
    )