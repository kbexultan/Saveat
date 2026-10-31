"""
Order confirmation and order history API (ST5, ST7).

Covers the data the confirmation page and the history page render, and
that a customer can never read or cancel another customer's order.
"""

import uuid
from decimal import Decimal

from sqlalchemy import select

from app.models.offer import Offer
from app.models.order import Order


CONFIRMATION_FIELDS = {
    "id",
    "pickup_code",
    "business_name",
    "branch_name",
    "address",
    "pickup_start",
    "pickup_end",
    "items",
    "status",
    "total_price",
    "created_at",
}


def reserve(client, headers, offer_id, quantity=1):
    response = client.post(
        "/orders/checkout",
        json={
            "items": [{"offer_id": str(offer_id), "quantity": quantity}],
        },
        headers=headers,
    )
    assert response.status_code == 201, response.json()
    return response.json()


def test_owner_sees_full_confirmation(scenario, client, auth_headers):
    headers = auth_headers(scenario.customer_a_id)
    created = reserve(client, headers, scenario.offer_id)

    response = client.get(f"/orders/{created['id']}", headers=headers)

    assert response.status_code == 200
    order = response.json()

    assert CONFIRMATION_FIELDS <= order.keys()
    assert order == created
    assert order["status"] == "reserved"
    assert order["items"][0]["offer_title"] == "Last croissant"
    assert order["items"][0]["quantity"] == 1


def test_other_customer_cannot_read_order(scenario, client, auth_headers):
    created = reserve(
        client,
        auth_headers(scenario.customer_a_id),
        scenario.offer_id,
    )

    response = client.get(
        f"/orders/{created['id']}",
        headers=auth_headers(scenario.customer_b_id),
    )

    assert response.status_code == 403
    # Nothing from the order leaks into the error.
    assert response.json() == {
        "detail": "You do not have access to this order"
    }


def test_other_customer_cannot_cancel_order(
    scenario, db, client, auth_headers
):
    created = reserve(
        client,
        auth_headers(scenario.customer_a_id),
        scenario.offer_id,
    )

    response = client.post(
        f"/orders/{created['id']}/cancel",
        headers=auth_headers(scenario.customer_b_id),
    )

    assert response.status_code == 403

    db.expire_all()
    assert db.get(Order, uuid.UUID(created["id"])).status == "reserved"
    assert db.get(Offer, scenario.offer_id).quantity_remaining == 0


def test_missing_order_returns_404(scenario, client, auth_headers):
    response = client.get(
        f"/orders/{uuid.uuid4()}",
        headers=auth_headers(scenario.customer_a_id),
    )

    assert response.status_code == 404


def test_malformed_order_id_returns_422(scenario, client, auth_headers):
    response = client.get(
        "/orders/not-a-uuid",
        headers=auth_headers(scenario.customer_a_id),
    )

    assert response.status_code == 422


def test_order_details_require_authentication(scenario, client):
    response = client.get(f"/orders/{uuid.uuid4()}")

    assert response.status_code == 401


def test_history_is_empty_for_new_customer(scenario, client, auth_headers):
    response = client.get(
        "/orders",
        headers=auth_headers(scenario.customer_b_id),
    )

    assert response.status_code == 200
    assert response.json() == []


def test_history_lists_only_own_orders_newest_first(
    scenario, db, client, auth_headers
):
    offer = db.get(Offer, scenario.offer_id)
    offer.quantity_total = 5
    offer.quantity_remaining = 5
    db.commit()

    headers_a = auth_headers(scenario.customer_a_id)
    headers_b = auth_headers(scenario.customer_b_id)

    first = reserve(client, headers_a, scenario.offer_id, 1)
    other = reserve(client, headers_b, scenario.offer_id, 1)
    second = reserve(client, headers_a, scenario.offer_id, 2)

    response = client.get("/orders", headers=headers_a)

    assert response.status_code == 200
    history = response.json()

    assert [order["id"] for order in history] == [second["id"], first["id"]]
    assert other["id"] not in {order["id"] for order in history}

    newest = history[0]
    assert newest["status"] == "reserved"
    assert newest["pickup_code"] == second["pickup_code"]
    assert Decimal(newest["total_price"]) == Decimal("1000.00")
    assert newest["items"][0]["quantity"] == 2
    assert newest["address"] == "Test street 1, Almaty"


def test_history_shows_cancelled_status(scenario, client, auth_headers):
    headers = auth_headers(scenario.customer_a_id)
    created = reserve(client, headers, scenario.offer_id)
    client.post(f"/orders/{created['id']}/cancel", headers=headers)

    history = client.get("/orders", headers=headers).json()

    assert [order["status"] for order in history] == ["cancelled"]


def test_legacy_order_is_skipped_in_history_and_409_in_details(
    scenario, db, client, auth_headers
):
    """
    Orders from before the order_items migration have no branch snapshot.
    The history skips them instead of failing; details return 409.
    """
    legacy = Order(
        user_id=scenario.customer_a_id,
        offer_id=scenario.offer_id,
        quantity=1,
        unit_price=Decimal("500.00"),
        total_price=Decimal("500.00"),
        status="reserved",
        pickup_code="SVT-LEGACY0001",
    )
    db.add(legacy)
    db.commit()

    headers = auth_headers(scenario.customer_a_id)

    assert client.get("/orders", headers=headers).json() == []

    response = client.get(f"/orders/{legacy.id}", headers=headers)
    assert response.status_code == 409

    remaining = db.execute(select(Order)).scalars().all()
    assert len(remaining) == 1
