from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
import threading
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from app.main import app
from app.models.business import Business
from app.models.business_member import BusinessMember
from app.models.order import Order
from app.models.offer import Offer
from app.models.notification import Notification
from app.approve_business import approve_business
from tests.seed import TEST_PASSWORD


def reserve(scenario, client, auth_headers):
    response = client.post("/orders/checkout", headers=auth_headers(scenario.customer_a_id),
        json={"items": [{"offer_id": str(scenario.offer_id), "quantity": 1}]})
    assert response.status_code == 201
    return response.json()


def url(scenario, order):
    return f"/business-orders/{scenario.business_id}/pickup/{order['pickup_code']}/confirm"


def test_complete_customer_to_bakery_journey(scenario, db, client, auth_headers):
    order = reserve(scenario, client, auth_headers)
    assert order["pickup_code"].startswith("SVT-")
    assert order["address"] and order["pickup_start"] and order["pickup_end"]
    db.expire_all()
    assert db.get(Offer, scenario.offer_id).quantity_remaining == 0
    lookup = client.get(url(scenario, order).removesuffix("/confirm"), headers=auth_headers(scenario.owner_id))
    assert lookup.status_code == 200
    confirmed = client.post(url(scenario, order), headers=auth_headers(scenario.owner_id))
    assert confirmed.status_code == 200
    assert confirmed.json()["picked_up_at"]
    customer = client.get(f"/orders/{order['id']}", headers=auth_headers(scenario.customer_a_id))
    assert customer.json()["status"] == "picked_up"
    assert client.post(url(scenario, order), headers=auth_headers(scenario.owner_id)).status_code == 409


def test_newly_registered_customer_completes_pickup(scenario, client, auth_headers):
    registered = client.post("/auth/register", json={
        "full_name": "New pilot customer", "email": "new.customer@example.com",
        "phone": "+77015550991", "password": TEST_PASSWORD,
    })
    assert registered.status_code == 201, registered.text
    login = client.post("/auth/login", json={"email": "new.customer@example.com", "password": TEST_PASSWORD})
    assert login.status_code == 200
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    offers = client.get("/offers/public").json()
    assert any(offer["id"] == str(scenario.offer_id) for offer in offers)
    response = client.post("/orders/checkout", headers=headers, json={
        "items": [{"offer_id": str(scenario.offer_id), "quantity": 1}], "idempotency_key": "new-customer-journey",
    })
    assert response.status_code == 201
    order = response.json()
    assert order["pickup_code"] and order["address"] and order["pickup_start"]
    assert client.post(url(scenario, order), headers=auth_headers(scenario.owner_id)).status_code == 200
    history = client.get("/orders", headers=headers).json()
    assert [(row["id"], row["status"]) for row in history] == [(order["id"], "picked_up")]


def test_invalid_cancelled_and_unauthorized_pickups(scenario, client, auth_headers):
    order = reserve(scenario, client, auth_headers)
    assert client.post(url(scenario, order), headers=auth_headers(scenario.customer_b_id)).status_code == 403
    assert client.post(url(scenario, {"pickup_code": "SVT-INVALID"}), headers=auth_headers(scenario.owner_id)).status_code == 404
    assert client.post(f"/orders/{order['id']}/cancel", headers=auth_headers(scenario.customer_a_id)).status_code == 200
    assert client.post(url(scenario, order), headers=auth_headers(scenario.owner_id)).status_code == 409


def test_wrong_business_and_inactive_employee(scenario, db, client, auth_headers):
    order = reserve(scenario, client, auth_headers)
    other = Business(name="Other bakery", status="active")
    db.add(other)
    db.flush()
    member = BusinessMember(business_id=other.id, user_id=scenario.customer_b_id, role="staff", status="active")
    db.add(member)
    db.commit()
    wrong_url = url(scenario, order).replace(str(scenario.business_id), str(other.id))
    assert client.post(wrong_url, headers=auth_headers(scenario.customer_b_id)).status_code == 404
    member.status = "inactive"
    db.commit()
    assert client.post(wrong_url, headers=auth_headers(scenario.customer_b_id)).status_code == 403


def test_simultaneous_pickups_change_status_once(scenario, db, client, auth_headers):
    order = reserve(scenario, client, auth_headers)
    barrier = threading.Barrier(2)
    headers = auth_headers(scenario.owner_id)
    def confirm():
        with TestClient(app) as worker:
            barrier.wait()
            return worker.post(url(scenario, order), headers=headers).status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(confirm) for _ in range(2)]
        assert sorted(f.result(timeout=20) for f in futures) == [200, 409]
    notifications = db.scalars(select(Notification).where(Notification.type == "order_picked_up")).all()
    assert len(notifications) == 1


def test_expired_pickup_window_keeps_existing_business_rule(scenario, db, client, auth_headers):
    order = reserve(scenario, client, auth_headers)
    stored = db.get(Order, uuid.UUID(order["id"]))
    stored.pickup_start = datetime.now(timezone.utc) - timedelta(hours=2)
    stored.pickup_end = datetime.now(timezone.utc) - timedelta(hours=1)
    db.commit()
    assert client.post(url(scenario, order), headers=auth_headers(scenario.owner_id)).status_code == 200


def test_approval_checks_id_and_name(scenario, db):
    business = Business(name="Verified manually", status="pending")
    db.add(business)
    db.commit()
    with pytest.raises(ValueError):
        approve_business(db, business.id, "Wrong business")
    db.rollback()
    approve_business(db, business.id, business.name)
    db.commit()
    assert business.status == "active"
    with pytest.raises(ValueError):
        approve_business(db, business.id, business.name)


def test_pending_bakery_cannot_publish_or_expose_offers(scenario, db, client, auth_headers):
    business = db.get(Business, scenario.business_id)
    business.status = "pending"
    db.commit()
    offer = db.get(Offer, scenario.offer_id)
    response = client.post("/offers", headers=auth_headers(scenario.owner_id), json={
        "branch_id": str(scenario.branch_id), "product_id": str(offer.product_id),
        "title": "Pending offer", "original_price": "1000", "sale_price": "500",
        "quantity_total": 1, "pickup_start": offer.pickup_start.isoformat(), "pickup_end": offer.pickup_end.isoformat(),
    })
    assert response.status_code == 403, response.text
    assert client.get("/offers/public").json() == []
