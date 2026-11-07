"""
Demo environment: persistent demo offers, linked accounts and the
customer/staff journeys run against it (scripts/demo_env.py).

Everything goes through the real API and a real PostgreSQL database.
"""

import uuid
from datetime import timedelta
from decimal import Decimal

import pytest
from sqlalchemy import func, select

from app.demo_offers import renew_demo_offers
from app.models.branch import Branch
from app.models.business import Business
from app.models.business_member import BusinessMember
from app.models.offer import Offer
from app.models.order import Order
from app.models.product import Product
from app.models.user import User
from scripts import demo_env
from scripts.demo_env import (
    BUSINESSES,
    CUSTOMERS,
    all_users,
    check_demo_environment,
    reset_demo_environment,
    seed_demo_environment,
)
from tests.seed import TEST_PASSWORD


SWEET, CRUST, KORICA = BUSINESSES


@pytest.fixture
def demo(db, test_password_hash):
    seed_demo_environment(db, password_hash=test_password_hash)
    return db


def db_now(db):
    return db.execute(select(func.now())).scalar_one()


def counts(db) -> dict[str, int]:
    return {
        model.__tablename__: db.execute(select(func.count()).select_from(model)).scalar_one()
        for model in (User, Business, Branch, BusinessMember, Product, Offer)
    }


def login(client, email: str) -> dict[str, str]:
    response = client.post("/auth/login", json={"email": email, "password": TEST_PASSWORD})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def first_offer(business, slot="day"):
    offer = next(offer for offer in business.offers if offer.slot == slot)
    return offer, business.offer_id(offer)


def make_offer(db, branch_id, *, is_demo, start, end, quantity=5) -> Offer:
    offer = Offer(
        id=uuid.uuid4(),
        branch_id=branch_id,
        type="custom",
        title="Offer",
        original_price=Decimal("1000"),
        sale_price=Decimal("500"),
        quantity_total=quantity,
        quantity_remaining=quantity,
        pickup_start=start,
        pickup_end=end,
        status="active",
        is_demo=is_demo,
    )
    db.add(offer)
    db.commit()
    return offer


# --------------------------------------------------------------
# Seed
# --------------------------------------------------------------


def test_seed_creates_linked_environment(demo):
    assert check_demo_environment(demo) == []

    total_offers = sum(len(business.offers) for business in BUSINESSES)
    assert counts(demo)["offers"] == total_offers
    assert all(8 <= len(business.offers) <= 15 for business in BUSINESSES)

    for business in BUSINESSES:
        roles = demo.execute(
            select(BusinessMember.role, func.count())
            .where(BusinessMember.business_id == business.id)
            .group_by(BusinessMember.role)
        ).all()
        assert dict(roles) == {"owner": 1, "manager": 1, "staff": 2}


def test_seed_twice_creates_no_duplicates_and_keeps_bookings(demo, test_password_hash):
    before = counts(demo)
    _, offer_id = first_offer(SWEET)
    offer = demo.get(Offer, offer_id)
    offer.quantity_remaining -= 2
    demo.commit()

    report = seed_demo_environment(demo, password_hash=test_password_hash)

    assert report.created == {}
    assert counts(demo) == before
    demo.expire_all()
    assert demo.get(Offer, offer_id).quantity_remaining == offer.quantity_total - 2


def test_seed_refuses_to_take_over_a_foreign_email(db, test_password_hash):
    db.add(User(id=uuid.uuid4(), full_name="Someone", email=CUSTOMERS[0].email,
                password_hash=test_password_hash))
    db.commit()

    with pytest.raises(demo_env.DemoSeedError):
        seed_demo_environment(db, password_hash=test_password_hash)

    assert db.execute(select(func.count()).select_from(Business)).scalar_one() == 0


def test_cli_refuses_a_remote_database(monkeypatch):
    from app import database

    remote = database.engine.url.set(host="aws-0-eu.pooler.supabase.com")
    monkeypatch.setattr(database, "engine", type("E", (), {"url": remote})())

    with pytest.raises(SystemExit) as stopped:
        demo_env._require_local_database(allow_remote=False)

    assert "Refusing" in str(stopped.value)


# --------------------------------------------------------------
# Renewal
# --------------------------------------------------------------


def test_renewal_moves_only_demo_offers_by_whole_days(demo):
    now = db_now(demo)
    branch_id = SWEET.branch_id(0)
    start, end = now - timedelta(days=3, hours=5), now - timedelta(days=3, hours=1)

    demo_offer = make_offer(demo, branch_id, is_demo=True, start=start, end=end)
    real_offer = make_offer(demo, branch_id, is_demo=False, start=start, end=end)
    future_demo = make_offer(demo, branch_id, is_demo=True,
                             start=now + timedelta(hours=1), end=now + timedelta(hours=5))
    demo_offer.quantity_remaining = 1
    demo.commit()

    renew_demo_offers(demo)
    demo.commit()
    demo.expire_all()

    renewed = demo.get(Offer, demo_offer.id)
    assert renewed.pickup_end > now
    assert renewed.pickup_end - now <= timedelta(days=1)
    assert (renewed.pickup_end - end) % timedelta(days=1) == timedelta(0)
    assert renewed.pickup_end - renewed.pickup_start == end - start
    assert renewed.quantity_remaining == 1

    assert demo.get(Offer, real_offer.id).pickup_end == end
    assert demo.get(Offer, future_demo.id).pickup_end == now + timedelta(hours=5)


def test_expired_demo_offer_comes_back_to_storefront(demo, client):
    _, offer_id = first_offer(CRUST)
    offer = demo.get(Offer, offer_id)
    now = db_now(demo)
    offer.pickup_start = now - timedelta(days=10, hours=8)
    offer.pickup_end = now - timedelta(days=10)
    demo.commit()

    visible = {item["id"] for item in client.get("/offers/public").json()}
    assert str(offer_id) not in visible

    renew_demo_offers(demo)
    demo.commit()

    visible = {item["id"] for item in client.get("/offers/public").json()}
    assert str(offer_id) in visible


def test_real_offers_still_expire(demo, client):
    now = db_now(demo)
    real = make_offer(demo, SWEET.branch_id(0), is_demo=False,
                      start=now - timedelta(hours=5), end=now - timedelta(minutes=1))

    renew_demo_offers(demo)
    demo.commit()

    visible = {item["id"] for item in client.get("/offers/public").json()}
    assert str(real.id) not in visible


# --------------------------------------------------------------
# Accounts and access
# --------------------------------------------------------------


def test_every_demo_account_can_log_in(demo, client):
    for user in all_users():
        login(client, user.email)


def test_business_login_returns_own_business(demo, client):
    for business in BUSINESSES:
        for user, role in business.members():
            response = client.post(
                "/business-auth/login",
                json={"email": user.email, "password": TEST_PASSWORD},
            )
            assert response.status_code == 200, response.text
            memberships = response.json()["memberships"]
            assert [(m["business"]["id"], m["role"]) for m in memberships] == [
                (str(business.id), role)
            ]


def test_owner_and_manager_manage_offers_staff_cannot(demo, client):
    _, offer_id = first_offer(SWEET)
    listing = f"/offers/business/{SWEET.id}"

    owner = login(client, SWEET.owner.email)
    offers = client.get(listing, headers=owner).json()
    assert {item["id"] for item in offers} == {
        str(SWEET.offer_id(offer)) for offer in SWEET.offers
    }

    manager = login(client, SWEET.manager.email)
    response = client.patch(f"/offers/{offer_id}", json={"title": "Шоколадный торт (вечер)"},
                            headers=manager)
    assert response.status_code == 200, response.text

    staff = login(client, SWEET.staff[0].email)
    response = client.patch(f"/offers/{offer_id}", json={"title": "x"}, headers=staff)
    assert response.status_code == 403
    assert client.get(f"/business-orders/{SWEET.id}", headers=staff).status_code == 200


def test_other_business_cannot_touch_foreign_data(demo, client):
    _, offer_id = first_offer(SWEET)
    intruder = login(client, CRUST.owner.email)

    assert client.get(f"/offers/business/{SWEET.id}", headers=intruder).status_code == 403
    assert client.get(f"/business-orders/{SWEET.id}", headers=intruder).status_code == 403
    assert client.patch(f"/offers/{offer_id}", json={"title": "x"},
                        headers=intruder).status_code == 403


# --------------------------------------------------------------
# Scenarios A, B, C
# --------------------------------------------------------------


def checkout(client, headers, offer_id, quantity=1):
    return client.post(
        "/orders/checkout",
        json={
            "items": [{"offer_id": str(offer_id), "quantity": quantity}],
            "payment_method": "pay_on_pickup",
            "idempotency_key": uuid.uuid4().hex,
        },
        headers=headers,
    )


def public_quantity(client, offer_id):
    """What a customer sees on the storefront; None once it is gone."""
    for item in client.get("/offers/public").json():
        if item["id"] == str(offer_id):
            return item["quantity_remaining"]
    return None


def test_scenario_a_and_b_reservation_reaches_staff_and_back(demo, client):
    offer, offer_id = first_offer(KORICA)
    customer = login(client, CUSTOMERS[0].email)
    staff = login(client, KORICA.staff[1].email)

    assert public_quantity(client, offer_id) == offer.quantity

    response = checkout(client, customer, offer_id)
    assert response.status_code in (200, 201), response.text
    order = response.json()

    assert public_quantity(client, offer_id) == offer.quantity - 1

    history = client.get("/orders", headers=customer).json()
    assert order["id"] in {item["id"] for item in history}

    business_orders = client.get(f"/business-orders/{KORICA.id}", headers=staff).json()
    assert order["id"] in {item["id"] for item in business_orders}

    confirmed = client.post(
        f"/business-orders/{KORICA.id}/pickup/{order['pickup_code']}/confirm",
        headers=staff,
    )
    assert confirmed.status_code == 200, confirmed.text

    mine = client.get(f"/orders/{order['id']}", headers=customer).json()
    assert mine["status"] == "picked_up"


def test_scenario_c_two_customers_cannot_oversell(demo, client):
    offer, offer_id = first_offer(SWEET, slot="evening")
    first = login(client, CUSTOMERS[0].email)
    second = login(client, CUSTOMERS[1].email)

    assert public_quantity(client, offer_id) == offer.quantity

    assert checkout(client, first, offer_id, quantity=offer.quantity - 1).status_code in (200, 201)
    assert public_quantity(client, offer_id) == 1

    too_many = checkout(client, second, offer_id, quantity=2)
    assert too_many.status_code == 409

    assert checkout(client, second, offer_id, quantity=1).status_code in (200, 201)
    demo.expire_all()
    assert demo.get(Offer, offer_id).quantity_remaining == 0
    assert checkout(client, first, offer_id, quantity=1).status_code == 409


# --------------------------------------------------------------
# Reset
# --------------------------------------------------------------


def test_reset_restores_stock_and_cancels_open_orders(demo, client, test_password_hash):
    offer, offer_id = first_offer(CRUST)
    customer = login(client, CUSTOMERS[2].email)
    order = checkout(client, customer, offer_id, quantity=2).json()

    report = reset_demo_environment(demo, password_hash=test_password_hash)
    demo.expire_all()

    assert report.cancelled_orders == 1
    assert demo.get(Order, uuid.UUID(order["id"])).status == "cancelled"
    assert demo.get(Offer, offer_id).quantity_remaining == offer.quantity
    assert check_demo_environment(demo) == []
