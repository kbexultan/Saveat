import uuid
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models.branch import Branch
from app.models.business import Business
from app.models.offer import Offer
from app.models.order import Order
from app.models.product import Product
from app.models.user import User
from app.schemas.order import (
    OrderCreate,
    OrderDetailsResponse,
    OrderResponse,
)


router = APIRouter(
    prefix="/orders",
    tags=["Orders"],
)


def generate_pickup_code() -> str:
    code = uuid.uuid4().hex[:10].upper()
    return f"SVT-{code}"


@router.post(
    "",
    response_model=OrderResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_order(
    data: OrderCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Атомарно уменьшаем остаток.
    # Если товара уже недостаточно,
    # UPDATE просто не найдёт строку.
    statement = (
        update(Offer)
        .where(
            Offer.id == data.offer_id,
            Offer.status == "active",
            Offer.quantity_remaining >= data.quantity,
            Offer.pickup_end > func.now(),
        )
        .values(
            quantity_remaining=(
                Offer.quantity_remaining - data.quantity
            )
        )
        .returning(
            Offer.sale_price,
            Offer.quantity_remaining,
        )
    )

    offer_result = (
        db.execute(statement)
        .mappings()
        .one_or_none()
    )

    if offer_result is None:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Offer is unavailable, expired, "
                "or does not have enough quantity"
            ),
        )

    unit_price = offer_result["sale_price"]
    remaining = offer_result["quantity_remaining"]

    # Если забрали последнюю штуку,
    # предложение становится sold_out.
    if remaining == 0:
        db.execute(
            update(Offer)
            .where(Offer.id == data.offer_id)
            .values(status="sold_out")
        )

    total_price = unit_price * data.quantity

    order = Order(
        user_id=current_user.id,
        offer_id=data.offer_id,
        quantity=data.quantity,
        unit_price=unit_price,
        total_price=total_price,
        status="reserved",
        pickup_code=generate_pickup_code(),
    )

    db.add(order)

    try:
        db.commit()
    except Exception:
        # Важно:
        # если создание заказа упало,
        # уменьшение остатка тоже откатится.
        db.rollback()
        raise

    db.refresh(order)

    return order


@router.get(
    "",
    response_model=list[OrderDetailsResponse],
)
def get_orders(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    statement = (
        select(
            Order,
            Offer,
            Branch,
            Business,
            Product,
        )
        .select_from(Order)
        .join(
            Offer,
            Order.offer_id == Offer.id,
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
            Order.user_id == current_user.id,
        )
        .order_by(
            Order.created_at.desc(),
        )
    )

    rows = db.execute(statement).all()

    return [
        OrderDetailsResponse(
            id=order.id,
            offer_id=order.offer_id,

            quantity=order.quantity,
            unit_price=order.unit_price,
            total_price=order.total_price,

            status=order.status,
            pickup_code=order.pickup_code,

            created_at=order.created_at,
            picked_up_at=order.picked_up_at,

            offer_title=offer.title,

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

            business_name=business.name,
            branch_name=branch.name,
            address=branch.address,

            pickup_start=offer.pickup_start,
            pickup_end=offer.pickup_end,
        )
        for order, offer, branch, business, product in rows
    ]


@router.get(
    "/{order_id}",
    response_model=OrderResponse,
)
def get_order(
    order_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    order = db.get(Order, order_id)

    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )

    if order.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this order",
        )

    return order

@router.post(
    "/{order_id}/cancel",
    response_model=OrderResponse,
)
def cancel_order(
    order_id: UUID,
    current_user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):
    # Блокируем заказ, чтобы два запроса
    # отмены одновременно не вернули
    # товар два раза.
    order = db.execute(
        select(Order)
        .where(
            Order.id == order_id
        )
        .with_for_update()
    ).scalar_one_or_none()

    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )

    if (
        order.user_id !=
        current_user.id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "You do not have "
                "access to this order"
            ),
        )

    if order.status == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Order is already cancelled"
            ),
        )

    if order.status == "picked_up":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Picked up order "
                "cannot be cancelled"
            ),
        )

    offer = db.execute(
        select(Offer)
        .where(
            Offer.id ==
            order.offer_id
        )
        .with_for_update()
    ).scalar_one_or_none()

    if offer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Offer not found",
        )

    # Возвращаем товар обратно.
    offer.quantity_remaining += (
        order.quantity
    )

    # Защита, чтобы случайно
    # не стало больше quantity_total.
    if (
        offer.quantity_remaining >
        offer.quantity_total
    ):
        offer.quantity_remaining = (
            offer.quantity_total
        )

    # Если товар был sold_out,
    # снова активируем его,
    # только если время ещё не прошло.
    if (
        offer.status == "sold_out"
        and
        offer.pickup_end >
        datetime.now(timezone.utc)
    ):
        offer.status = "active"

    order.status = "cancelled"

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(order)

    return order

@router.post(
    "/{order_id}/pickup",
    response_model=OrderResponse,
)
def confirm_pickup(
    order_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    order = db.get(Order, order_id)

    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )

    if order.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this order",
        )

    if order.status == "picked_up":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Order has already been picked up",
        )

    if order.status not in {
        "reserved",
        "paid",
        "ready",
    }:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Order cannot be picked up",
        )

    order.status = "picked_up"
    order.picked_up_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(order)

    return order