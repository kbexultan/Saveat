import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import (
    Mapped,
    mapped_column,
    relationship,
)

from app.models.base import Base


class BusinessSubscription(Base):
    """
    Подписка покупателя на заведение.

    Отличается от Favorite: избранное — это конкретное предложение,
    которое исчезает, когда его разобрали или истёк срок. Подписка
    держится на заведении и живёт постоянно: человек хочет узнавать
    про новые скидки любимой пекарни, а не про один медовик.
    """

    __tablename__ = "business_subscriptions"

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "business_id",
            name="uq_business_subscriptions_user_business",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    business_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "businesses.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    user = relationship(
        "User",
        back_populates="business_subscriptions",
    )

    business = relationship("Business")
