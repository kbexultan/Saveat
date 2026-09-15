"""
Создание уведомлений.

Функции namеренно НЕ делают commit: уведомление должно попасть в ту же
транзакцию, что и событие, которое его породило. Иначе легко получить
уведомление о заказе, который откатился, — или наоборот.

Отсюда же уходит web-push: единая точка, чтобы не забыть отправить
push там, где уведомление создаётся новым кодом.
"""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.business_member import BusinessMember
from app.models.notification import Notification


# Типы уведомлений.
ORDER_CREATED = "order_created"
ORDER_PICKED_UP = "order_picked_up"
ORDER_CANCELLED = "order_cancelled"


def create_notification(
    db: Session,
    *,
    user_id: uuid.UUID,
    type: str,
    title: str,
    body: str,
    order_id: uuid.UUID | None = None,
) -> Notification:
    notification = Notification(
        id=uuid.uuid4(),
        user_id=user_id,
        type=type,
        title=title,
        body=body,
        order_id=order_id,
    )

    db.add(notification)

    # Push уходит после успешного commit'а — см. push.queue_push.
    # Здесь только ставим в очередь текущей сессии.
    from app.push import queue_push

    queue_push(
        db,
        user_id=user_id,
        title=title,
        body=body,
        order_id=order_id,
    )

    return notification


def notify_business_members(
    db: Session,
    *,
    business_id: uuid.UUID,
    type: str,
    title: str,
    body: str,
    order_id: uuid.UUID | None = None,
    exclude_user_id: uuid.UUID | None = None,
) -> list[Notification]:
    """
    Уведомляет всех активных сотрудников заведения.

    Уведомление персональное (привязано к user_id), поэтому на каждого
    сотрудника создаётся своя строка: иначе «прочитано» одним человеком
    гасило бы уведомление для всей смены.
    """
    statement = select(BusinessMember.user_id).where(
        BusinessMember.business_id == business_id,
        BusinessMember.status == "active",
    )

    if exclude_user_id is not None:
        statement = statement.where(
            BusinessMember.user_id != exclude_user_id
        )

    user_ids = db.execute(statement).scalars().all()

    return [
        create_notification(
            db,
            user_id=user_id,
            type=type,
            title=title,
            body=body,
            order_id=order_id,
        )
        for user_id in user_ids
    ]
