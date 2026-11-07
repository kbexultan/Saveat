import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, Integer, Numeric, String, Text, false, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Offer(Base):
    __tablename__ = "offers"
    __table_args__ = (
        CheckConstraint("quantity_remaining >= 0 AND quantity_remaining <= quantity_total", name="ck_offers_stock_bounds"),
        Index("ix_offers_demo_pickup_end", "pickup_end", postgresql_where=text("is_demo")),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    branch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("branches.id", ondelete="CASCADE"),
        nullable=False,
    )

    product_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="SET NULL"),
        nullable=True,
    )

    type: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="product",
    )

    title: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    original_price: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )

    sale_price: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )

    quantity_total: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    quantity_remaining: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    pickup_start: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    pickup_end: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="active",
    )

    # Seeded demo offer: app/demo_offers.py rolls its pickup window
    # forward by whole days instead of letting it expire. Real offers
    # (false) expire exactly as before.
    is_demo: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default=false(),
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    branch = relationship(
        "Branch",
        back_populates="offers",
    )

    product = relationship(
        "Product",
        back_populates="offers",
    )

    orders = relationship(
        "Order",
        back_populates="offer",
    )

    order_items = relationship(
        "OrderItem",
        back_populates="offer",
    )

    favorites = relationship(
        "Favorite",
        back_populates="offer",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
