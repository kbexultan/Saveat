"""Real PostgreSQL regressions: retries, isolation, contention and rollback."""
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
import pytest

from app.main import app
from app.models.offer import Offer
from app.models.order import Order
from app.models.notification import Notification
from tests.test_concurrent_reservation import reserve_simultaneously


def payload(scenario, key="checkout-test", quantity=1):
    return {"idempotency_key": key, "items": [{"offer_id": str(scenario.offer_id), "quantity": quantity}]}


def test_retry_returns_original_after_sold_out(scenario, db, client, auth_headers):
    headers = auth_headers(scenario.customer_a_id)
    first = client.post("/orders/checkout", json=payload(scenario), headers=headers)
    retry = client.post("/orders/checkout", json=payload(scenario), headers=headers)
    assert first.status_code == retry.status_code == 201
    assert first.json() == retry.json()
    db.expire_all()
    assert db.get(Offer, scenario.offer_id).quantity_remaining == 0
    assert db.scalar(select(func.count()).select_from(Order)) == 1
    assert db.scalar(select(func.count()).select_from(Notification)) == 1


def test_concurrent_retries_create_one_order(scenario, db, auth_headers):
    results = reserve_simultaneously([(auth_headers(scenario.customer_a_id), payload(scenario)) for _ in range(8)])
    assert [status for status, _ in results] == [201] * 8
    assert len({body["id"] for _, body in results}) == 1
    assert db.scalar(select(func.count()).select_from(Order)) == 1


def test_key_reuse_rejects_different_contents(scenario, client, auth_headers):
    headers = auth_headers(scenario.customer_a_id)
    assert client.post("/orders/checkout", json=payload(scenario), headers=headers).status_code == 201
    conflict = client.post("/orders/checkout", json=payload(scenario, quantity=2), headers=headers)
    assert conflict.status_code == 409
    assert "Idempotency key" in conflict.json()["detail"]


def test_key_is_scoped_to_user(scenario, client, auth_headers):
    first = client.post("/orders/checkout", json=payload(scenario), headers=auth_headers(scenario.customer_a_id))
    other = client.post("/orders/checkout", json=payload(scenario), headers=auth_headers(scenario.customer_b_id))
    assert first.status_code == 201
    assert other.status_code == 409
    assert "Idempotency" not in other.json()["detail"]


def test_failed_transaction_does_not_consume_key(scenario, db, client, auth_headers, monkeypatch):
    import app.routers.orders as orders
    original = orders.notify_business_members
    def fail(*args, **kwargs):
        raise RuntimeError("storage unavailable")
    monkeypatch.setattr(orders, "notify_business_members", fail)
    headers = auth_headers(scenario.customer_a_id)
    failed = TestClient(app, raise_server_exceptions=False).post("/orders/checkout", json=payload(scenario), headers=headers)
    assert failed.status_code == 500
    assert db.scalar(select(func.count()).select_from(Order)) == 0
    db.expire_all()
    assert db.get(Offer, scenario.offer_id).quantity_remaining == 1
    monkeypatch.setattr(orders, "notify_business_members", original)
    assert client.post("/orders/checkout", json=payload(scenario), headers=headers).status_code == 201


def test_database_rejects_negative_stock(scenario, db):
    db.get(Offer, scenario.offer_id).quantity_remaining = -1
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_insufficient_stock_does_not_consume_key(scenario, client, auth_headers):
    headers = auth_headers(scenario.customer_a_id)
    assert client.post("/orders/checkout", json=payload(scenario, quantity=2), headers=headers).status_code == 409
    assert client.post("/orders/checkout", json=payload(scenario), headers=headers).status_code == 201
