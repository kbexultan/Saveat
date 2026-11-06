"""Durable outbox, committed with notifications; network never blocks checkout.

Delivery is at least once: a crash after provider acceptance can retry. Payloads
are generic so offline logout and banners already queued by an OS reveal no order
data. The authenticated notifications API retains the complete message.
"""
import json
import logging
import uuid
from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.config import settings
from app.models.push_subscription import PushSubscription
from app.models.push_delivery import PushDelivery
from app.schemas.notification import valid_web_endpoint

logger = logging.getLogger(__name__)
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


def web_push_enabled() -> bool:
    return bool(settings.vapid_public_key and settings.vapid_private_key)


def queue_push(db: Session, *, notification_id: uuid.UUID, user_id: uuid.UUID,
               title: str, body: str, order_id: uuid.UUID | None = None) -> None:
    subscriptions = db.scalars(select(PushSubscription).where(
        PushSubscription.user_id == user_id,
        PushSubscription.session_hash.is_not(None),
        PushSubscription.expires_at > datetime.now(timezone.utc),
    )).all()
    for subscription in subscriptions:
        db.add(PushDelivery(notification_id=notification_id, subscription_id=subscription.id,
                            user_id=user_id, session_hash=subscription.session_hash))


def process_push_batch(limit: int = 5) -> int:
    from app.database import SessionLocal
    processed = 0
    for _ in range(limit):
        with SessionLocal.begin() as db:
            now = datetime.now(timezone.utc)
            delivery = db.scalar(select(PushDelivery).where(
                PushDelivery.completed_at.is_(None), PushDelivery.next_attempt_at <= now,
            ).order_by(PushDelivery.next_attempt_at, PushDelivery.id).with_for_update(skip_locked=True).limit(1))
            if delivery is None:
                break
            subscription = db.scalar(select(PushSubscription).where(
                PushSubscription.id == delivery.subscription_id,
            ).with_for_update())
            if (subscription is None or subscription.user_id != delivery.user_id
                or subscription.session_hash != delivery.session_hash
                or subscription.expires_at is None or subscription.expires_at <= now):
                delivery.completed_at = now
                delivery.last_error = "subscription_inactive"
            else:
                payload = {"title": "SAVEAT", "body": "У вас новое уведомление. Откройте SAVEAT.",
                           "notification_id": str(delivery.notification_id), "order_id": None}
                try:
                    result = (_send_expo_push([subscription.endpoint], payload) if subscription.platform == "expo"
                              else _send_web_push(subscription, payload))
                except Exception:
                    result = None
                delivery.attempts += 1
                if result is not None:
                    delivery.completed_at = now
                    delivery.last_error = None if result else "subscription_expired"
                    if result is False:
                        db.delete(subscription)
                else:
                    delivery.last_error = "provider_delivery_failed"
                    delivery.next_attempt_at = now + timedelta(seconds=min(3600, 30 * 2 ** delivery.attempts))
                    if delivery.attempts >= 8:
                        delivery.completed_at = now
                    logger.warning("Push delivery %s failed (attempt %s)", delivery.id, delivery.attempts)
            processed += 1
    return processed


def _send_web_push(subscription: PushSubscription, payload: dict) -> bool | None:
    if not valid_web_endpoint(subscription.endpoint):
        return False
    if not web_push_enabled():
        return None
    from pywebpush import WebPushException, webpush
    import requests
    try:
        with requests.Session() as session:
            session.max_redirects = 0
            webpush(subscription_info={"endpoint": subscription.endpoint,
                    "keys": {"p256dh": subscription.p256dh, "auth": subscription.auth}},
                    data=json.dumps(payload), vapid_private_key=settings.vapid_private_key,
                    vapid_claims={"sub": settings.vapid_subject}, timeout=10, requests_session=session)
        return True
    except WebPushException as error:
        code = getattr(getattr(error, "response", None), "status_code", None)
        return False if code in {404, 410} else None
    except Exception:
        return None


def _send_expo_push(tokens: list[str], payload: dict) -> bool | None:
    import httpx
    try:
        response = httpx.post(EXPO_PUSH_URL, json=[{
            "to": token, "title": payload["title"], "body": payload["body"],
            "data": {"notification_id": payload["notification_id"]}, "sound": "default",
        } for token in tokens], timeout=10, follow_redirects=False)
        if response.status_code != 200:
            return None
        tickets = response.json().get("data", [])
        if len(tickets) != len(tokens):
            return None
        if all(ticket.get("status") == "ok" for ticket in tickets):
            return True
        if all(ticket.get("details", {}).get("error") == "DeviceNotRegistered" for ticket in tickets):
            return False
    except Exception:
        pass
    return None
