import uuid
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models.offer import Offer
from app.models.order import Order
from app.models.user import User
from app.schemas.order import OrderCreate, OrderResponse


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
        db.rollback()
        raise

    db.refresh(order)

    return order


@router.get(
    "",
    response_model=list[OrderResponse],
)
def get_orders(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = db.execute(
        select(Order)
        .where(
            Order.user_id == current_user.id
        )
        .order_by(
            Order.created_at.desc()
        )
    )

    return result.scalars().all()


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