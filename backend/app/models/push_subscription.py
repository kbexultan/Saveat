import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import (
    Mapped,
    mapped_column,
    relationship,
)

from app.models.base import Base


class PushSubscription(Base):
    """
    Подписка устройства на push.

    Одна таблица на два транспорта: web-push (браузер) и Expo (мобилка).
    Различаются они только тем, что у web-push есть ключи p256dh/auth,
    а у Expo вместо endpoint'а лежит push-токен.
    """

    __tablename__ = "push_subscriptions"

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

    # "web" или "expo"
    platform: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="web",
    )

    # URL эндпоинта у web-push, push-токен у Expo.
    # Уникален: одно устройство — одна подписка.
    endpoint: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        unique=True,
    )

    p256dh: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    auth: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    user = relationship("User")
