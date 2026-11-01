"""
Acceptance criteria from IT_PM_A6_A7_Saveat_Report.docx, Section 3.

ST4 / US5 — Concurrent reservation safety (owner: Aktolkyn, est. 1.5 h)
  US5-AC1  If an offer has exactly one item and two customers attempt to
           book it simultaneously, only one booking must be created. The
           second customer must receive an unavailable-product error.
  US5-AC2  The remaining quantity must never become negative and must
           match both the application and database.

ST8 / US3 — Booking confirmation and order history (owner: Aktolkyn,
est. 1.5 h)
  US3-AC1  After booking, the confirmation must contain the order code,
           pickup time and bakery address.
  US3-AC2  After booking, the quantity must decrease and the order must
           appear in the customer's order list with the status "booked"
           (backend `reserved`, shown on the web as "Забронирован").

Web-side parts (Russian error text, status label) are covered by
frontend/lib/checkoutErrors.test.ts and frontend/lib/orders.test.ts.
Results are recorded in backend/tests/ACCEPTANCE_CHECK_LOG.md.
"""

from datetime import datetime
from decimal import Decimal

from sqlalchemy import func, select, text

from app.models.offer import Offer
from app.models.order import Order
from tests.test_concurrent_reservation import (  # noqa: F401  (fixture)
    checkout_payload,
    gate,
    inventory_snapshot,
    reserve_simultaneously,
)


def owner_view_of_offer(client, auth_headers, scenario):
    """Remaining quantity as the bakery cabinet shows it."""
    response = client.get(
        f"/offers/{scenario.offer_id}",
        headers=auth_headers(scenario.owner_id),
    )
    assert response.status_code == 200, response.json()
    return response.json()


def storefront_offer(client, offer_id):
    """The offer as customers see it on the storefront, or None."""
    response = client.get("/offers/public")
    assert response.status_code == 200
    return next(
        (offer for offer in response.json() if offer["id"] == str(offer_id)),
        None,
    )


def lowest_quantity_in_database(db):
    return db.execute(
        text("SELECT min(quantity_remaining) FROM offers")
    ).scalar_one()


# --------------------------------
# ST4 / US5
# --------------------------------


def test_us5_ac1_one_booking_for_last_item(
    scenario, db, gate, auth_headers
):
    payload = checkout_payload(scenario.offer_id)

    results = reserve_simultaneously(
        [
            (auth_headers(scenario.customer_a_id), payload),
            (auth_headers(scenario.customer_b_id), payload),
        ]
    )

    # The requests really overlapped: one waited on the other's row lock.
    assert gate.other_request_blocked_on_lock

    statuses = sorted(status for status, _ in results)
    assert statuses == [201, 409]

    # Unavailable-product error for the second customer. The web app
    # turns this exact text into the Russian sold-out message
    # (frontend/lib/checkoutErrors.test.ts).
    loser = next(body for status, body in results if status == 409)
    assert loser == {"detail": "Last croissant is unavailable"}

    _, orders, reserved = inventory_snapshot(db, scenario.offer_id)
    assert orders == 1
    assert reserved == 1
    assert db.execute(select(func.count()).select_from(Order)).scalar_one() == 1


def test_us5_ac2_quantity_zero_and_consistent_after_race(
    scenario, db, gate, client, auth_headers
):
    payload = checkout_payload(scenario.offer_id)

    reserve_simultaneously(
        [
            (auth_headers(scenario.customer_a_id), payload),
            (auth_headers(scenario.customer_b_id), payload),
        ]
    )

    offer, _, _ = inventory_snapshot(db, scenario.offer_id)

    # Database: exactly zero, never negative.
    assert offer.quantity_remaining == 0
    assert lowest_quantity_in_database(db) >= 0

    # Application: the bakery cabinet shows the same number ...
    cabinet = owner_view_of_offer(client, auth_headers, scenario)
    assert cabinet["quantity_remaining"] == offer.quantity_remaining == 0
    assert cabinet["status"] == "sold_out"

    # ... and the storefront no longer offers the sold-out item.
    assert storefront_offer(client, scenario.offer_id) is None


def test_us5_ac2_quantity_consistent_after_partial_booking(
    scenario, db, client, auth_headers
):
    offer = db.get(Offer, scenario.offer_id)
    offer.quantity_total = 5
    offer.quantity_remaining = 5
    db.commit()

    response = client.post(
        "/orders/checkout",
        json=checkout_payload(scenario.offer_id, quantity=2),
        headers=auth_headers(scenario.customer_a_id),
    )
    assert response.status_code == 201

    offer, _, _ = inventory_snapshot(db, scenario.offer_id)
    assert offer.quantity_remaining == 3

    assert storefront_offer(client, scenario.offer_id)["quantity_remaining"] == 3
    assert (
        owner_view_of_offer(client, auth_headers, scenario)["quantity_remaining"]
        == 3
    )


def test_us5_ac2_quantity_cannot_go_negative_on_over_request(
    scenario, db, client, auth_headers
):
    response = client.post(
        "/orders/checkout",
        json=checkout_payload(scenario.offer_id, quantity=2),
        headers=auth_headers(scenario.customer_a_id),
    )

    assert response.status_code == 409
    offer, orders, _ = inventory_snapshot(db, scenario.offer_id)
    assert offer.quantity_remaining == 1
    assert orders == 0


# --------------------------------
# ST8 / US3
# --------------------------------


def test_us3_ac1_confirmation_has_code_pickup_time_and_address(
    scenario, db, client, auth_headers
):
    headers = auth_headers(scenario.customer_a_id)

    created = client.post(
        "/orders/checkout",
        json=checkout_payload(scenario.offer_id),
        headers=headers,
    )
    assert created.status_code == 201

    # The confirmation page loads GET /orders/{id}.
    confirmation = client.get(
        f"/orders/{created.json()['id']}",
        headers=headers,
    ).json()

    offer = db.get(Offer, scenario.offer_id)

    assert confirmation["pickup_code"].startswith("SVT-")
    assert len(confirmation["pickup_code"]) == len("SVT-") + 10
    assert (
        datetime.fromisoformat(confirmation["pickup_start"])
        == offer.pickup_start
    )
    assert (
        datetime.fromisoformat(confirmation["pickup_end"])
        == offer.pickup_end
    )
    assert confirmation["address"] == "Test street 1, Almaty"
    assert confirmation["business_name"] == "Saveat Test Bakery"


def test_us3_ac2_quantity_decreases_and_order_listed_as_reserved(
    scenario, db, client, auth_headers
):
    offer = db.get(Offer, scenario.offer_id)
    offer.quantity_total = 5
    offer.quantity_remaining = 5
    db.commit()

    headers = auth_headers(scenario.customer_a_id)

    created = client.post(
        "/orders/checkout",
        json=checkout_payload(scenario.offer_id, quantity=2),
        headers=headers,
    ).json()

    offer, _, _ = inventory_snapshot(db, scenario.offer_id)
    assert offer.quantity_remaining == 5 - 2

    history = client.get("/orders", headers=headers).json()

    assert [order["id"] for order in history] == [created["id"]]
    assert history[0]["status"] == "reserved"
    assert history[0]["items"][0]["quantity"] == 2
    assert Decimal(history[0]["total_price"]) == Decimal("1000.00")

    # It is the booking customer's history only.
    other = client.get(
        "/orders",
        headers=auth_headers(scenario.customer_b_id),
    ).json()
    assert other == []
