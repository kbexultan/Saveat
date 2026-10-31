"""
Checkout behaviour and transaction rollback (ST3, ST4).

No written acceptance criteria for US5 exist in the repository, so these
tests pin the behaviour the checkout endpoint implements today. The 409
messages are asserted verbatim because the web and mobile clients
translate them into Russian (see frontend/lib/checkoutErrors.ts).
"""

import uuid
from datetime import datetime, timedelta
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

import app.routers.orders as orders_router
from app.main import app
from app.models.notification import Notification
from app.models.offer import Offer
from app.models.order import Order
from app.models.order_item import OrderItem


def checkout(client, headers, *items):
    return client.post(
        "/orders/checkout",
        json={
            "items": [
                {"offer_id": str(offer_id), "quantity": quantity}
                for offer_id, quantity in items
            ],
        },
        headers=headers,
    )


def count(db, model):
    return db.execute(select(func.count()).select_from(model)).scalar_one()


def reload_offer(db, offer_id):
    db.expire_all()
    return db.get(Offer, offer_id)


@pytest.fixture
def second_offer(db, scenario):
    """A second offer in the same branch with plenty of stock."""
    first = db.get(Offer, scenario.offer_id)
    offer = Offer(
        id=uuid.UUID("5a7ea700-0000-4000-8000-0000000000f3"),
        branch_id=first.branch_id,
        product_id=None,
        type="product",
        title="Day-old bread",
        original_price=Decimal("600.00"),
        sale_price=Decimal("250.00"),
        quantity_total=5,
        quantity_remaining=5,
        pickup_start=first.pickup_start,
        pickup_end=first.pickup_end,
        status="active",
    )
    db.add(offer)
    db.commit()
    return offer.id


def test_successful_checkout_creates_reserved_order(
    scenario, db, client, auth_headers
):
    response = checkout(
        client,
        auth_headers(scenario.customer_a_id),
        (scenario.offer_id, 1),
    )

    assert response.status_code == 201
    order = response.json()

    assert order["status"] == "reserved"
    assert order["user_id"] == str(scenario.customer_a_id)
    assert order["pickup_code"].startswith("SVT-")
    assert order["business_name"] == "Saveat Test Bakery"
    assert order["branch_name"] == "Saveat Test Bakery — Abaya"
    assert order["address"] == "Test street 1, Almaty"
    assert order["payment_method"] == "pay_on_pickup"
    assert Decimal(order["total_price"]) == Decimal("500.00")
    assert order["items"] == [
        {
            "id": order["items"][0]["id"],
            "offer_id": str(scenario.offer_id),
            "offer_title": "Last croissant",
            "product_name": "Test croissant",
            "product_image_url": None,
            "quantity": 1,
            "unit_price": "500.00",
            "total_price": "500.00",
        }
    ]

    offer = reload_offer(db, scenario.offer_id)
    assert offer.quantity_remaining == 0
    assert offer.status == "sold_out"
    # Pickup window is copied from the offer.
    assert datetime.fromisoformat(order["pickup_start"]) == offer.pickup_start
    assert datetime.fromisoformat(order["pickup_end"]) == offer.pickup_end

    # The bakery owner was notified in the same transaction.
    notification = db.execute(select(Notification)).scalar_one()
    assert notification.user_id == scenario.owner_id
    assert str(notification.order_id) == order["id"]


def test_partial_quantity_keeps_offer_active(
    scenario, second_offer, db, client, auth_headers
):
    response = checkout(
        client,
        auth_headers(scenario.customer_a_id),
        (second_offer, 2),
    )

    assert response.status_code == 201
    assert Decimal(response.json()["total_price"]) == Decimal("500.00")

    offer = reload_offer(db, second_offer)
    assert offer.quantity_remaining == 3
    assert offer.status == "active"


def test_sold_out_offer_returns_409(scenario, db, client, auth_headers):
    first = checkout(
        client,
        auth_headers(scenario.customer_a_id),
        (scenario.offer_id, 1),
    )
    assert first.status_code == 201

    second = checkout(
        client,
        auth_headers(scenario.customer_b_id),
        (scenario.offer_id, 1),
    )

    assert second.status_code == 409
    assert second.json() == {"detail": "Last croissant is unavailable"}
    assert count(db, Order) == 1


def test_insufficient_stock_returns_409_and_changes_nothing(
    scenario, second_offer, db, client, auth_headers
):
    response = checkout(
        client,
        auth_headers(scenario.customer_a_id),
        (second_offer, 6),
    )

    assert response.status_code == 409
    assert response.json() == {
        "detail": "Not enough Day-old bread. Available: 5"
    }

    offer = reload_offer(db, second_offer)
    assert offer.quantity_remaining == 5
    assert count(db, Order) == 0


def test_expired_offer_returns_409(scenario, db, client, auth_headers):
    offer = db.get(Offer, scenario.offer_id)
    now = db.execute(select(func.now())).scalar_one()
    offer.pickup_end = now - timedelta(seconds=1)
    offer.pickup_start = now - timedelta(hours=2)
    db.commit()

    response = checkout(
        client,
        auth_headers(scenario.customer_a_id),
        (scenario.offer_id, 1),
    )

    assert response.status_code == 409
    assert response.json() == {"detail": "Last croissant has expired"}
    assert reload_offer(db, scenario.offer_id).quantity_remaining == 1


def test_paused_offer_returns_409(scenario, db, client, auth_headers):
    db.get(Offer, scenario.offer_id).status = "paused"
    db.commit()

    response = checkout(
        client,
        auth_headers(scenario.customer_a_id),
        (scenario.offer_id, 1),
    )

    assert response.status_code == 409
    assert response.json() == {"detail": "Last croissant is unavailable"}


def test_unknown_offer_returns_404(scenario, client, auth_headers):
    response = checkout(
        client,
        auth_headers(scenario.customer_a_id),
        (uuid.uuid4(), 1),
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "One or more offers were not found"}


def test_quantity_above_limit_is_rejected(scenario, client, auth_headers):
    response = checkout(
        client,
        auth_headers(scenario.customer_a_id),
        (scenario.offer_id, 21),
    )

    assert response.status_code == 422


def test_checkout_requires_authentication(scenario, db, client):
    response = client.post(
        "/orders/checkout",
        json={
            "items": [{"offer_id": str(scenario.offer_id), "quantity": 1}],
        },
    )

    assert response.status_code == 401
    assert reload_offer(db, scenario.offer_id).quantity_remaining == 1


def test_failing_item_rolls_back_whole_cart(
    scenario, second_offer, db, client, auth_headers
):
    """
    The cart holds an available item and an over-requested one. Nothing
    is reserved: no order, and the available item keeps its stock.
    """
    response = checkout(
        client,
        auth_headers(scenario.customer_a_id),
        (second_offer, 2),
        (scenario.offer_id, 2),
    )

    assert response.status_code == 409
    assert reload_offer(db, second_offer).quantity_remaining == 5
    assert reload_offer(db, scenario.offer_id).quantity_remaining == 1
    assert count(db, Order) == 0
    assert count(db, OrderItem) == 0


def test_error_after_inventory_deduction_rolls_back(
    scenario, db, auth_headers, monkeypatch
):
    """
    The failure happens after the order, its items and the stock
    decrement were flushed. The transaction must undo all of it.
    """

    def broken_notify(*args, **kwargs):
        raise RuntimeError("notification storage is down")

    monkeypatch.setattr(
        orders_router,
        "notify_business_members",
        broken_notify,
    )

    client = TestClient(app, raise_server_exceptions=False)
    response = checkout(
        client,
        auth_headers(scenario.customer_a_id),
        (scenario.offer_id, 1),
    )

    assert response.status_code == 500

    offer = reload_offer(db, scenario.offer_id)
    assert offer.quantity_remaining == 1
    assert offer.status == "active"
    assert count(db, Order) == 0
    assert count(db, OrderItem) == 0
    assert count(db, Notification) == 0

    # The row lock was released and nothing is left half-done: once the
    # failure is gone, the next customer can buy the item.
    monkeypatch.undo()
    retry = checkout(
        TestClient(app),
        auth_headers(scenario.customer_b_id),
        (scenario.offer_id, 1),
    )
    assert retry.status_code == 201


def test_cancel_returns_stock_and_reactivates_offer(
    scenario, db, client, auth_headers
):
    headers = auth_headers(scenario.customer_a_id)
    order = checkout(client, headers, (scenario.offer_id, 1)).json()

    response = client.post(f"/orders/{order['id']}/cancel", headers=headers)

    assert response.status_code == 200
    assert response.json()["status"] == "cancelled"

    offer = reload_offer(db, scenario.offer_id)
    assert offer.quantity_remaining == 1
    assert offer.status == "active"

    # The freed item can be reserved by the other customer.
    again = checkout(
        client,
        auth_headers(scenario.customer_b_id),
        (scenario.offer_id, 1),
    )
    assert again.status_code == 201


def test_cancelling_twice_returns_409(scenario, client, auth_headers):
    headers = auth_headers(scenario.customer_a_id)
    order = checkout(client, headers, (scenario.offer_id, 1)).json()

    client.post(f"/orders/{order['id']}/cancel", headers=headers)
    response = client.post(f"/orders/{order['id']}/cancel", headers=headers)

    assert response.status_code == 409
    assert response.json() == {"detail": "Order is already cancelled"}
