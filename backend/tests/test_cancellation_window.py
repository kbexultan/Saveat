"""US8: cancellation ends at pickup_start, including lock contention."""
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
import time
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select, text

import app.routers.orders as orders_router
from app.database import engine
from app.main import app
from app.models.notification import Notification
from app.models.offer import Offer
from app.models.order import Order
from app.models.push_delivery import PushDelivery
from tests.test_pickup_flow import reserve, url


def snapshot(db, scenario, order):
    db.expire_all()
    stored = db.get(Order, UUID(order["id"]))
    offer = db.get(Offer, scenario.offer_id)
    cancelled = db.scalar(select(func.count()).select_from(Notification).where(
        Notification.type == "order_cancelled", Notification.order_id == stored.id))
    return stored.status, offer.quantity_remaining, offer.status, cancelled


@pytest.mark.parametrize("offset,expected", [(-1, 200), (0, 409), (1, 409)])
def test_cancellation_boundary(scenario, db, client, auth_headers, monkeypatch, offset, expected):
    # Subscribe bakery staff so rejection must also leave the outbox unchanged.
    assert client.post("/push/subscribe", headers=auth_headers(scenario.owner_id),
        json={"endpoint": "ExpoPushToken[cancel_test]", "platform": "expo"}).status_code == 204
    order = reserve(scenario, client, auth_headers)
    stored = db.get(Order, UUID(order["id"]))
    at = stored.pickup_start + timedelta(microseconds=offset)
    monkeypatch.setattr(orders_router, "cancellation_time", lambda session: at)
    deliveries = db.scalar(select(func.count()).select_from(PushDelivery))
    response = client.post(f"/orders/{order['id']}/cancel", headers=auth_headers(scenario.customer_a_id))
    assert response.status_code == expected
    if expected == 200:
        assert snapshot(db, scenario, order) == ("cancelled", 1, "active", 1)
        assert db.scalar(select(func.count()).select_from(PushDelivery)) == deliveries + 1
    else:
        assert response.json() == {"detail": "Order cannot be cancelled once pickup has started"}
        assert snapshot(db, scenario, order) == ("reserved", 0, "sold_out", 0)
        assert db.scalar(select(func.count()).select_from(PushDelivery)) == deliveries


def test_double_cancel_restores_stock_and_notifies_once(scenario, db, client, auth_headers):
    order = reserve(scenario, client, auth_headers)
    path = f"/orders/{order['id']}/cancel"
    headers = auth_headers(scenario.customer_a_id)
    assert client.post(path, headers=headers).status_code == 200
    assert client.post(path, headers=headers).status_code == 409
    assert snapshot(db, scenario, order) == ("cancelled", 1, "active", 1)


def test_collected_order_never_returns_stock(scenario, db, client, auth_headers):
    order = reserve(scenario, client, auth_headers)
    assert client.post(url(scenario, order), headers=auth_headers(scenario.owner_id)).status_code == 200
    response = client.post(f"/orders/{order['id']}/cancel", headers=auth_headers(scenario.customer_a_id))
    assert response.status_code == 409
    assert snapshot(db, scenario, order) == ("picked_up", 0, "sold_out", 0)


def post(path, headers):
    with TestClient(app) as worker:
        return worker.post(path, headers=headers)


def wait_for_order_locks(count):
    deadline = time.monotonic() + 10
    while time.monotonic() < deadline:
        with engine.connect() as connection:
            waiting = connection.scalar(text("""
                SELECT count(*) FROM pg_stat_activity
                WHERE datname = current_database() AND wait_event_type = 'Lock'
                  AND query ILIKE '%orders%' AND query ILIKE '%FOR UPDATE%'
            """))
        if waiting >= count:
            return
        time.sleep(0.01)
    pytest.fail(f"Expected {count} requests actually waiting for the order lock")


@pytest.mark.parametrize("pickup_started", [False, True])
def test_concurrent_cancel_and_pickup(scenario, db, client, auth_headers, pickup_started):
    order = reserve(scenario, client, auth_headers)
    stored = db.get(Order, UUID(order["id"]))
    if pickup_started:
        stored.pickup_start = db.scalar(select(func.clock_timestamp())) - timedelta(seconds=1)
        db.commit()
    db.execute(select(Order).where(Order.id == stored.id).with_for_update()).scalar_one()
    with ThreadPoolExecutor(max_workers=2) as pool:
        try:
            cancel = pool.submit(post, f"/orders/{order['id']}/cancel", auth_headers(scenario.customer_a_id))
            pickup = pool.submit(post, url(scenario, order), auth_headers(scenario.owner_id))
            wait_for_order_locks(2)
        finally:
            db.commit()
        responses = [cancel.result(timeout=15), pickup.result(timeout=15)]
    assert sorted(r.status_code for r in responses) == [200, 409]
    state = snapshot(db, scenario, order)
    if responses[0].status_code == 200:
        assert not pickup_started
        assert state == ("cancelled", 1, "active", 1)
    else:
        assert state == ("picked_up", 0, "sold_out", 0)


def test_lock_wait_cannot_use_stale_transaction_time(scenario, db, client, auth_headers):
    order = reserve(scenario, client, auth_headers)
    stored = db.execute(select(Order).where(Order.id == UUID(order["id"])).with_for_update()).scalar_one()
    with ThreadPoolExecutor(max_workers=1) as pool:
        try:
            request = pool.submit(post, f"/orders/{order['id']}/cancel", auth_headers(scenario.customer_a_id))
            wait_for_order_locks(1)
            # Move the boundary after the request's transaction began, while
            # it is provably blocked. No timing sleep or application lock mock.
            stored.pickup_start = db.scalar(select(func.clock_timestamp()))
        finally:
            db.commit()
        response = request.result(timeout=15)
    assert response.status_code == 409
    assert snapshot(db, scenario, order) == ("reserved", 0, "sold_out", 0)
