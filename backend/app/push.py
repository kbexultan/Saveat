"""
Отправка push-уведомлений: web-push в браузер и Expo в мобилку.

Два принципа:

1. Push уходит только ПОСЛЕ успешного commit'а. Уведомление о заказе,
   транзакция которого откатилась, — худший вид вранья, а отменить уже
   доставленный push нельзя.

2. Ошибка отправки никогда не роняет запрос. Push — дополнительный
   канал; если FCM недоступен, заказ всё равно должен создаться, а
   уведомление остаться в списке под колокольчиком.

Без настроенных VAPID-ключей web-push просто выключается (см.
web_push_enabled), остальное продолжает работать.
"""

import json
import logging
import threading
import uuid

from sqlalchemy import event, select
from sqlalchemy.orm import Session

from app.config import settings
from app.models.push_subscription import PushSubscription


logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

# Ключ, под которым на сессии копятся push'и до commit'а.
_PENDING_ATTR = "_saveat_pending_pushes"


def web_push_enabled() -> bool:
    return bool(
        settings.vapid_public_key
        and settings.vapid_private_key
    )


def queue_push(
    db: Session,
    *,
    user_id: uuid.UUID,
    title: str,
    body: str,
    order_id: uuid.UUID | None = None,
) -> None:
    """Складывает push в очередь сессии; отправка — после commit'а."""
    pending = getattr(db, _PENDING_ATTR, None)

    if pending is None:
        pending = []
        setattr(db, _PENDING_ATTR, pending)

        # once=True: вешаем слушатель на сессию один раз, иначе при
        # нескольких уведомлениях в одном запросе он навесится столько
        # же раз и очередь уйдёт дублями.
        event.listen(
            db,
            "after_commit",
            _flush_pending,
            once=True,
        )

    pending.append(
        {
            "user_id": user_id,
            "title": title,
            "body": body,
            "order_id": str(order_id) if order_id else None,
        }
    )


def _flush_pending(session: Session) -> None:
    pending = getattr(session, _PENDING_ATTR, None)

    if not pending:
        return

    messages = list(pending)
    setattr(session, _PENDING_ATTR, None)

    # Сеть в отдельном потоке: иначе пользователь ждёт, пока мы
    # достучимся до FCM, ради уведомления, которое ему уже показано
    # в интерфейсе.
    thread = threading.Thread(
        target=_send_all,
        args=(messages,),
        daemon=True,
    )

    thread.start()


def _send_all(messages: list[dict]) -> None:
    from app.database import SessionLocal

    db = SessionLocal()

    try:
        for message in messages:
            try:
                _send_to_user(db, message)
            except Exception:
                logger.exception(
                    "Failed to send push to user %s",
                    message.get("user_id"),
                )
    finally:
        db.close()


def _send_to_user(db: Session, message: dict) -> None:
    subscriptions = (
        db.execute(
            select(PushSubscription).where(
                PushSubscription.user_id == message["user_id"]
            )
        )
        .scalars()
        .all()
    )

    if not subscriptions:
        return

    payload = {
        "title": message["title"],
        "body": message["body"],
        "order_id": message["order_id"],
    }

    expo_tokens = []
    stale_ids = []

    for subscription in subscriptions:
        if subscription.platform == "expo":
            expo_tokens.append(subscription.endpoint)
            continue

        if not web_push_enabled():
            continue

        if _send_web_push(subscription, payload) is False:
            stale_ids.append(subscription.id)

    if expo_tokens:
        _send_expo_push(expo_tokens, payload)

    # Подписки, которые браузер отозвал, чистим: иначе они копятся
    # и каждый push тратит время на заведомо мёртвые эндпоинты.
    if stale_ids:
        for subscription in subscriptions:
            if subscription.id in stale_ids:
                db.delete(subscription)

        db.commit()


def _send_web_push(
    subscription: PushSubscription,
    payload: dict,
) -> bool | None:
    """True — доставлено, False — подписка мертва, None — прочая ошибка."""
    try:
        from pywebpush import WebPushException, webpush
    except ImportError:
        logger.warning(
            "pywebpush is not installed, web push skipped"
        )
        return None

    try:
        webpush(
            subscription_info={
                "endpoint": subscription.endpoint,
                "keys": {
                    "p256dh": subscription.p256dh,
                    "auth": subscription.auth,
                },
            },
            data=json.dumps(payload),
            vapid_private_key=settings.vapid_private_key,
            vapid_claims={
                "sub": settings.vapid_subject,
            },
            timeout=10,
        )

        return True

    except WebPushException as error:
        status_code = getattr(
            getattr(error, "response", None),
            "status_code",
            None,
        )

        # 404/410 — браузер отозвал подписку, она больше не оживёт.
        if status_code in {404, 410}:
            return False

        logger.warning("Web push failed: %s", error)
        return None


def _send_expo_push(tokens: list[str], payload: dict) -> None:
    try:
        import httpx
    except ImportError:
        logger.warning(
            "httpx is not installed, expo push skipped"
        )
        return

    body = [
        {
            "to": token,
            "title": payload["title"],
            "body": payload["body"],
            "data": {"order_id": payload["order_id"]},
            "sound": "default",
        }
        for token in tokens
    ]

    try:
        response = httpx.post(
            EXPO_PUSH_URL,
            json=body,
            timeout=10,
            headers={
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
        )

        if response.status_code >= 400:
            logger.warning(
                "Expo push failed: %s %s",
                response.status_code,
                response.text[:200],
            )

    except Exception:
        logger.exception("Expo push request failed")
