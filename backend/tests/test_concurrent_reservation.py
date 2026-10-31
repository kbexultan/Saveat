"""
Two customers reserving the last item at the same time (ST2, ST3).

The requests go through the real FastAPI app, the real checkout code and
a real PostgreSQL database. Nothing on the concurrency-critical path is
mocked.

To make the race deterministic instead of timing-dependent, the first
request to reach the critical section (stock already checked, inventory
not yet deducted) is held there until PostgreSQL reports the other
request waiting on a row lock. With correct locking that is guaranteed to
happen; without it the second request walks into the critical section as
well, and the oversell becomes visible on every run.
"""

import threading
import time
import uuid
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select, text
from sqlalchemy.sql.selectable import GenerativeSelect

import app.routers.orders as orders_router
from app.database import engine
from app.main import app
from app.models.offer import Offer
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.user import User


LOCK_WAIT_TIMEOUT_SECONDS = 10


class CriticalSectionGate:
    """
    Wraps generate_pickup_code(), which checkout calls after the stock
    check and before the inventory update, i.e. inside the window where a
    missing lock would let two requests oversell.
    """

    def __init__(self, original):
        self.original = original
        self.calls = 0
        self.other_request_blocked_on_lock = False
        self.second_request_entered = threading.Event()
        self._calls_lock = threading.Lock()

    def __call__(self):
        with self._calls_lock:
            self.calls += 1
            is_first = self.calls == 1

        if is_first:
            self._hold_until_contention()
        else:
            self.second_request_entered.set()

        return self.original()

    def _hold_until_contention(self):
        deadline = time.monotonic() + LOCK_WAIT_TIMEOUT_SECONDS

        while time.monotonic() < deadline:
            if self.second_request_entered.is_set():
                return

            if self._another_backend_waits_for_row_lock():
                self.other_request_blocked_on_lock = True
                return

            time.sleep(0.01)

    @staticmethod
    def _another_backend_waits_for_row_lock() -> bool:
        with engine.connect() as connection:
            waiting = connection.execute(
                text(
                    """
                    SELECT count(*)
                    FROM pg_stat_activity
                    WHERE datname = current_database()
                      AND pid <> pg_backend_pid()
                      AND wait_event_type = 'Lock'
                      AND query ILIKE '%FOR UPDATE%'
                    """
                )
            ).scalar_one()

        return waiting > 0


@pytest.fixture
def gate(monkeypatch):
    gate = CriticalSectionGate(orders_router.generate_pickup_code)
    monkeypatch.setattr(orders_router, "generate_pickup_code", gate)
    return gate


def reserve_simultaneously(requests):
    """
    Fires one POST /orders/checkout per (headers, payload) pair, released
    together by a barrier. Each thread uses its own client, and therefore
    its own request and database session.
    """
    barrier = threading.Barrier(len(requests))

    def send(headers, payload):
        client = TestClient(app)
        barrier.wait()
        response = client.post(
            "/orders/checkout",
            json=payload,
            headers=headers,
        )
        return response.status_code, response.json()

    with ThreadPoolExecutor(max_workers=len(requests)) as pool:
        futures = [
            pool.submit(send, headers, payload)
            for headers, payload in requests
        ]

        return [future.result(timeout=30) for future in futures]


def checkout_payload(offer_id, quantity=1):
    return {
        "items": [
            {"offer_id": str(offer_id), "quantity": quantity},
        ],
    }


def inventory_snapshot(db, offer_id):
    db.expire_all()

    offer = db.get(Offer, offer_id)

    orders = db.execute(
        select(func.count(func.distinct(OrderItem.order_id)))
        .where(OrderItem.offer_id == offer_id)
    ).scalar_one()

    reserved = db.execute(
        select(func.coalesce(func.sum(OrderItem.quantity), 0))
        .where(OrderItem.offer_id == offer_id)
    ).scalar_one()

    return offer, orders, reserved


def test_two_customers_race_for_last_item(
    scenario, db, gate, auth_headers
):
    payload = checkout_payload(scenario.offer_id)

    results = reserve_simultaneously(
        [
            (auth_headers(scenario.customer_a_id), payload),
            (auth_headers(scenario.customer_b_id), payload),
        ]
    )

    statuses = sorted(status for status, _ in results)
    assert statuses == [201, 409], results

    # The race really happened: one request waited on the other's row
    # lock while the first was inside the critical section.
    assert gate.other_request_blocked_on_lock
    assert gate.calls == 1

    winner = next(body for status, body in results if status == 201)
    loser = next(body for status, body in results if status == 409)

    assert winner["status"] == "reserved"
    assert winner["items"][0]["quantity"] == 1
    # The loser sees the offer after the winner's commit: sold out.
    assert loser["detail"] == "Last croissant is unavailable"

    offer, orders, reserved = inventory_snapshot(db, scenario.offer_id)

    assert offer.quantity_remaining == 0
    assert offer.status == "sold_out"
    assert orders == 1
    assert reserved == 1
    assert reserved <= offer.quantity_total

    # Only the winner owns an order.
    owners = db.execute(select(Order.user_id)).scalars().all()
    assert owners == [uuid.UUID(winner["user_id"])]


def test_many_customers_race_for_limited_stock(
    scenario, db, auth_headers, test_password_hash
):
    """Ten customers, three items: exactly three reservations succeed."""
    offer = db.get(Offer, scenario.offer_id)
    offer.quantity_total = 3
    offer.quantity_remaining = 3

    customers = [
        User(
            id=uuid.UUID(int=0x5A7EA7000000400080000000000C00 + index),
            full_name=f"Load customer {index}",
            email=f"load.{index}@saveat-test.example.com",
            phone=f"+7701000{index:04d}",
            password_hash=test_password_hash,
        )
        for index in range(10)
    ]
    db.add_all(customers)
    db.commit()

    payload = checkout_payload(scenario.offer_id)
    results = reserve_simultaneously(
        [(auth_headers(customer.id), payload) for customer in customers]
    )

    assert Counter(status for status, _ in results) == {201: 3, 409: 7}, results

    offer, orders, reserved = inventory_snapshot(db, scenario.offer_id)

    assert offer.quantity_remaining == 0
    assert offer.status == "sold_out"
    assert orders == 3
    assert reserved == 3


def test_overlapping_carts_do_not_deadlock(
    scenario, db, auth_headers
):
    """
    Both customers want two offers, listed in opposite orders. Checkout
    locks offers sorted by id, so the requests queue instead of
    deadlocking, and each offer is sold exactly once.
    """
    first = db.get(Offer, scenario.offer_id)
    second = Offer(
        id=uuid.UUID("5a7ea700-0000-4000-8000-0000000000f2"),
        branch_id=first.branch_id,
        product_id=first.product_id,
        type="product",
        title="Last baguette",
        original_price=Decimal("800.00"),
        sale_price=Decimal("400.00"),
        quantity_total=1,
        quantity_remaining=1,
        pickup_start=first.pickup_start,
        pickup_end=first.pickup_end,
        status="active",
    )
    db.add(second)
    db.commit()

    forward = {
        "items": [
            {"offer_id": str(first.id), "quantity": 1},
            {"offer_id": str(second.id), "quantity": 1},
        ],
    }
    backward = {"items": list(reversed(forward["items"]))}

    results = reserve_simultaneously(
        [
            (auth_headers(scenario.customer_a_id), forward),
            (auth_headers(scenario.customer_b_id), backward),
        ]
    )

    statuses = sorted(status for status, _ in results)
    assert statuses == [201, 409], results
    # A deadlock would surface as a 500 from psycopg's DeadlockDetected.
    assert all(status != 500 for status, _ in results)

    for offer_id in (first.id, second.id):
        offer, orders, reserved = inventory_snapshot(db, offer_id)
        assert offer.quantity_remaining == 0
        assert reserved == 1


def test_race_is_detected_when_row_lock_is_missing(
    scenario, db, gate, auth_headers, monkeypatch
):
    """
    Negative control for the test above, not a production scenario.

    SELECT ... FOR UPDATE is switched off for this test only (production
    code is untouched). Both requests then pass the stock check and the
    last item is sold twice. If this test ever starts failing, the race
    harness has stopped exercising the critical section and
    test_two_customers_race_for_last_item proves nothing.
    """
    monkeypatch.setattr(
        GenerativeSelect,
        "with_for_update",
        lambda self, *args, **kwargs: self,
    )

    payload = checkout_payload(scenario.offer_id)

    results = reserve_simultaneously(
        [
            (auth_headers(scenario.customer_a_id), payload),
            (auth_headers(scenario.customer_b_id), payload),
        ]
    )

    assert gate.second_request_entered.is_set()
    assert [status for status, _ in results] == [201, 201]

    offer, orders, reserved = inventory_snapshot(db, scenario.offer_id)

    # Oversold: two orders for one item.
    assert orders == 2
    assert reserved > offer.quantity_total


def test_expired_offer_cannot_be_reserved_concurrently(
    scenario, db, auth_headers
):
    offer = db.get(Offer, scenario.offer_id)
    now = db.execute(select(func.now())).scalar_one()
    offer.pickup_start = now - timedelta(hours=3)
    offer.pickup_end = now - timedelta(minutes=1)
    db.commit()

    payload = checkout_payload(scenario.offer_id)
    results = reserve_simultaneously(
        [
            (auth_headers(scenario.customer_a_id), payload),
            (auth_headers(scenario.customer_b_id), payload),
        ]
    )

    assert [status for status, _ in results] == [409, 409]
    assert all(
        body["detail"] == "Last croissant has expired"
        for _, body in results
    )

    offer, orders, _ = inventory_snapshot(db, scenario.offer_id)
    assert offer.quantity_remaining == 1
    assert orders == 0
