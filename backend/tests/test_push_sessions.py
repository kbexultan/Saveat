from datetime import datetime, timedelta, timezone
from sqlalchemy import func, select
import pytest
from app.auth import token_hash
from app.database import SessionLocal
from app.models.push_subscription import PushSubscription
from app.models.push_delivery import PushDelivery
from app.models.notification import Notification
from app.notifications import create_notification
import app.push as push

TOKEN = "ExponentPushToken[saveat_test_device]"


def subscribe(client, headers, endpoint=TOKEN):
    return client.post("/push/subscribe", json={"endpoint": endpoint, "platform": "expo"}, headers=headers)


def notify(db, user_id):
    notification = create_notification(db, user_id=user_id, type="order_created",
        title="Private name", body="Private pickup code SVT-SECRET", order_id=None)
    db.commit()
    return notification.id


def test_logout_revokes_token_and_only_its_devices(scenario, db, client, auth_headers):
    first = auth_headers(scenario.customer_a_id)
    second = auth_headers(scenario.customer_a_id)
    assert subscribe(client, first).status_code == 204
    assert subscribe(client, second, "ExpoPushToken[other_device]").status_code == 204
    assert client.post("/auth/logout", headers=first).status_code == 204
    assert client.get("/auth/me", headers=first).status_code == 401
    assert subscribe(client, first).status_code == 401
    assert client.get("/auth/me", headers=second).status_code == 200
    remaining = db.scalars(select(PushSubscription)).all()
    assert len(remaining) == 1
    assert remaining[0].endpoint == "ExpoPushToken[other_device]"


def test_account_switch_drops_old_queued_notifications(scenario, db, client, auth_headers, monkeypatch):
    a, b = auth_headers(scenario.customer_a_id), auth_headers(scenario.customer_b_id)
    assert subscribe(client, a).status_code == 204
    notify(db, scenario.customer_a_id)
    assert subscribe(client, b).status_code == 204
    # A late unsubscribe must not remove B's subscription.
    assert client.post("/push/unsubscribe", json={"endpoint": TOKEN}, headers=a).status_code == 204
    sent = []
    monkeypatch.setattr(push, "_send_expo_push", lambda *args: sent.append(args) or True)
    assert push.process_push_batch() == 1
    assert sent == []
    db.expire_all()
    assert db.scalar(select(PushDelivery)).last_error == "subscription_inactive"
    assert db.scalar(select(PushSubscription)).user_id == scenario.customer_b_id
    assert client.get("/notifications", headers=b).json() == []


def test_outbox_survives_session_close_and_has_no_private_payload(scenario, db, client, auth_headers, monkeypatch):
    assert subscribe(client, auth_headers(scenario.customer_a_id)).status_code == 204
    with SessionLocal() as transaction:
        notify(transaction, scenario.customer_a_id)
    sent = []
    monkeypatch.setattr(push, "_send_expo_push", lambda tokens, payload: sent.append(payload) or True)
    assert push.process_push_batch() == 1
    assert push.process_push_batch() == 0
    assert len(sent) == 1
    assert "SECRET" not in str(sent) and "Private" not in str(sent)
    assert sent[0]["order_id"] is None


def test_rollback_never_sends(scenario, db, client, auth_headers, monkeypatch):
    subscribe(client, auth_headers(scenario.customer_a_id))
    create_notification(db, user_id=scenario.customer_a_id, type="order_created", title="Test", body="Test")
    db.flush()
    db.rollback()
    assert db.scalar(select(func.count()).select_from(PushDelivery)) == 0
    assert push.process_push_batch() == 0


def test_provider_failure_retries_and_records_error(scenario, db, client, auth_headers, monkeypatch):
    subscribe(client, auth_headers(scenario.customer_a_id))
    notify(db, scenario.customer_a_id)
    monkeypatch.setattr(push, "_send_expo_push", lambda *args: None)
    assert push.process_push_batch() == 1
    assert push.process_push_batch() == 0
    db.expire_all()
    delivery = db.scalar(select(PushDelivery))
    assert delivery.attempts == 1 and delivery.last_error == "provider_delivery_failed"
    assert delivery.completed_at is None
    delivery.next_attempt_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    db.commit()
    monkeypatch.setattr(push, "_send_expo_push", lambda *args: True)
    assert push.process_push_batch() == 1
    db.expire_all()
    assert db.scalar(select(PushDelivery)).completed_at is not None


def test_expired_subscription_is_ignored(scenario, db, client, auth_headers, monkeypatch):
    subscribe(client, auth_headers(scenario.customer_a_id))
    notify(db, scenario.customer_a_id)
    db.scalar(select(PushSubscription)).expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    db.commit()
    monkeypatch.setattr(push, "_send_expo_push", lambda *args: pytest.fail("expired session was notified"))
    assert push.process_push_batch() == 1


@pytest.mark.parametrize("endpoint", ["http://127.0.0.1/private", "https://127.0.0.1/", "https://fcm.googleapis.com.evil.example/push", "https://fcm.googleapis.com:8443/push", "https://user:pass@fcm.googleapis.com/push"])
def test_push_rejects_ssrf(scenario, client, auth_headers, endpoint):
    assert client.post("/push/subscribe", json={"endpoint": endpoint, "platform": "web", "p256dh": "key", "auth": "key"}, headers=auth_headers(scenario.customer_a_id)).status_code == 422


def test_provider_expired_token_is_removed(scenario, db, client, auth_headers, monkeypatch):
    subscribe(client, auth_headers(scenario.customer_a_id))
    notify(db, scenario.customer_a_id)
    monkeypatch.setattr(push, "_send_expo_push", lambda *args: False)
    assert push.process_push_batch() == 1
    db.expire_all()
    assert db.scalar(select(func.count()).select_from(PushSubscription)) == 0


def test_worker_starts_with_api_and_stops_cleanly(scenario, db, client, auth_headers, monkeypatch):
    import threading
    from fastapi.testclient import TestClient
    from app.main import app
    from app.config import settings
    subscribe(client, auth_headers(scenario.customer_a_id))
    notify(db, scenario.customer_a_id)
    sent = threading.Event()
    monkeypatch.setattr(push, "_send_expo_push", lambda *args: sent.set() or True)
    monkeypatch.setattr(settings, "push_worker_enabled", True)
    with TestClient(app):
        assert sent.wait(5), "API worker did not drain the durable queue"


def test_concurrent_workers_claim_delivery_once(scenario, db, client, auth_headers, monkeypatch):
    from concurrent.futures import ThreadPoolExecutor
    import threading
    subscribe(client, auth_headers(scenario.customer_a_id))
    notify(db, scenario.customer_a_id)
    sending, release = threading.Event(), threading.Event()
    def send(*args):
        sending.set()
        assert release.wait(5)
        return True
    monkeypatch.setattr(push, "_send_expo_push", send)
    with ThreadPoolExecutor(max_workers=2) as pool:
        first = pool.submit(push.process_push_batch, 1)
        assert sending.wait(5)
        try:
            assert pool.submit(push.process_push_batch, 1).result(timeout=5) == 0
        finally:
            release.set()
        assert first.result(timeout=5) == 1


def test_web_sender_restricts_hosts_and_redirects(monkeypatch):
    import pywebpush
    sent = []
    monkeypatch.setattr(push, "web_push_enabled", lambda: True)
    monkeypatch.setattr(pywebpush, "webpush", lambda **kwargs: sent.append(kwargs))
    subscription = PushSubscription(endpoint="https://fcm.googleapis.com/test", platform="web", p256dh="key", auth="auth")
    assert push._send_web_push(subscription, {"body": "Generic"}) is True
    assert sent[0]["requests_session"].max_redirects == 0
    subscription.endpoint = "https://127.0.0.1/private"
    assert push._send_web_push(subscription, {}) is False
    assert len(sent) == 1


def test_web_gone_subscription_is_permanent(monkeypatch):
    from types import SimpleNamespace
    import pywebpush
    monkeypatch.setattr(push, "web_push_enabled", lambda: True)
    def gone(**kwargs):
        raise pywebpush.WebPushException("Gone", response=SimpleNamespace(status_code=410))
    monkeypatch.setattr(pywebpush, "webpush", gone)
    subscription = PushSubscription(endpoint="https://fcm.googleapis.com/test", platform="web", p256dh="key", auth="auth")
    assert push._send_web_push(subscription, {}) is False


def test_expo_ticket_and_temporary_failure_handling(monkeypatch):
    import httpx
    payload = {"title": "SAVEAT", "body": "Generic", "notification_id": "test"}
    def respond(status, data):
        monkeypatch.setattr(httpx, "post", lambda *args, **kwargs: httpx.Response(status, json=data))
    respond(200, {"data": [{"status": "ok", "id": "ticket-id"}]})
    assert push._send_expo_push([TOKEN], payload) is True
    respond(200, {"data": [{"status": "error", "details": {"error": "DeviceNotRegistered"}}]})
    assert push._send_expo_push([TOKEN], payload) is False
    respond(503, {})
    assert push._send_expo_push([TOKEN], payload) is None
