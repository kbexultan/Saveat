"""
Deterministic test data for reservation tests (ST1).

One test bakery with one branch and one offer that has exactly one item
left, plus two isolated customer accounts and a bakery owner. Every row
uses a fixed UUID, so the scenario is the same on every run and seeding
twice replaces the previous copy instead of piling up duplicates.

Pickup times are the only relative values: they are placed around the
database clock so the offer is always open when the test runs.

pytest uses seed_reservation_scenario() through fixtures. To load the same
data into the local Docker test database by hand:

    uv run python -m tests.seed

The command goes through the same production-URL guard as pytest and
refuses to run against anything but the local test database.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import Decimal

from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session

from app.models.branch import Branch
from app.models.business import Business
from app.models.business_member import BusinessMember
from app.models.notification import Notification
from app.models.offer import Offer
from app.models.order import Order
from app.models.product import Product
from app.models.user import User


TEST_PASSWORD = "saveat-test-password"

BUSINESS_ID = uuid.UUID("5a7ea700-0000-4000-8000-0000000000b1")
BRANCH_ID = uuid.UUID("5a7ea700-0000-4000-8000-0000000000b2")
PRODUCT_ID = uuid.UUID("5a7ea700-0000-4000-8000-0000000000d1")
LAST_ITEM_OFFER_ID = uuid.UUID("5a7ea700-0000-4000-8000-0000000000f1")

OWNER_ID = uuid.UUID("5a7ea700-0000-4000-8000-0000000000a0")
CUSTOMER_A_ID = uuid.UUID("5a7ea700-0000-4000-8000-0000000000a1")
CUSTOMER_B_ID = uuid.UUID("5a7ea700-0000-4000-8000-0000000000a2")

CUSTOMER_IDS = (CUSTOMER_A_ID, CUSTOMER_B_ID)
USER_IDS = (OWNER_ID, *CUSTOMER_IDS)


@dataclass(frozen=True)
class ReservationScenario:
    business_id: uuid.UUID
    branch_id: uuid.UUID
    offer_id: uuid.UUID
    owner_id: uuid.UUID
    customer_a_id: uuid.UUID
    customer_b_id: uuid.UUID


def reset_reservation_scenario(db: Session) -> None:
    """Deletes every row that a previous seed (or its orders) created."""
    order_ids = select(Order.id).where(
        or_(
            Order.user_id.in_(CUSTOMER_IDS),
            Order.branch_id == BRANCH_ID,
        )
    )

    db.execute(
        delete(Notification).where(
            or_(
                Notification.user_id.in_(USER_IDS),
                Notification.order_id.in_(order_ids),
            )
        )
    )

    # order_items go with their order (ON DELETE CASCADE).
    db.execute(delete(Order).where(Order.id.in_(order_ids)))

    # branches, products and offers go with the business; memberships,
    # favorites and subscriptions go with the users.
    db.execute(delete(Business).where(Business.id == BUSINESS_ID))
    db.execute(delete(User).where(User.id.in_(USER_IDS)))


def seed_reservation_scenario(
    db: Session,
    *,
    password_hash: str,
    now: datetime | None = None,
) -> ReservationScenario:
    """
    Creates the scenario and commits it.

    password_hash is passed in so this module does not import app.security
    (and through it app.config) before the test environment is set up.
    """
    reset_reservation_scenario(db)

    if now is None:
        now = db.execute(select(func.now())).scalar_one()

    db.add_all(
        [
            User(
                id=OWNER_ID,
                full_name="Test Bakery Owner",
                email="owner@saveat-test.example.com",
                phone="+77000000000",
                password_hash=password_hash,
            ),
            User(
                id=CUSTOMER_A_ID,
                full_name="Test Customer A",
                email="customer.a@saveat-test.example.com",
                phone="+77000000001",
                password_hash=password_hash,
            ),
            User(
                id=CUSTOMER_B_ID,
                full_name="Test Customer B",
                email="customer.b@saveat-test.example.com",
                phone="+77000000002",
                password_hash=password_hash,
            ),
            Business(
                id=BUSINESS_ID,
                name="Saveat Test Bakery",
                description="Deterministic bakery for automated tests",
                status="active",
            ),
        ]
    )
    db.flush()

    db.add_all(
        [
            BusinessMember(
                business_id=BUSINESS_ID,
                user_id=OWNER_ID,
                role="owner",
                status="active",
            ),
            Branch(
                id=BRANCH_ID,
                business_id=BUSINESS_ID,
                name="Saveat Test Bakery — Abaya",
                address="Test street 1, Almaty",
                latitude=43.2389,
                longitude=76.8897,
            ),
            Product(
                id=PRODUCT_ID,
                business_id=BUSINESS_ID,
                name="Test croissant",
                category="bakery",
                base_price=Decimal("1000.00"),
            ),
        ]
    )
    db.flush()

    db.add(
        Offer(
            id=LAST_ITEM_OFFER_ID,
            branch_id=BRANCH_ID,
            product_id=PRODUCT_ID,
            type="product",
            title="Last croissant",
            original_price=Decimal("1000.00"),
            sale_price=Decimal("500.00"),
            quantity_total=1,
            quantity_remaining=1,
            pickup_start=now + timedelta(hours=1),
            pickup_end=now + timedelta(hours=4),
            status="active",
        )
    )

    db.commit()

    return ReservationScenario(
        business_id=BUSINESS_ID,
        branch_id=BRANCH_ID,
        offer_id=LAST_ITEM_OFFER_ID,
        owner_id=OWNER_ID,
        customer_a_id=CUSTOMER_A_ID,
        customer_b_id=CUSTOMER_B_ID,
    )


def main() -> None:
    from tests.safety import configure_test_environment

    url = configure_test_environment()

    # Imported only after the guard has pointed DATABASE_URL at the
    # test database.
    from app.database import SessionLocal
    from app.security import hash_password

    with SessionLocal() as db:
        scenario = seed_reservation_scenario(
            db,
            password_hash=hash_password(TEST_PASSWORD),
        )

    host = url.rsplit("@", 1)[-1]
    print(f"Seeded reservation scenario into {host}")
    print(f"  offer (1 item left): {scenario.offer_id}")
    print("  customers: customer.a@saveat-test.example.com, customer.b@saveat-test.example.com")
    print(f"  password: {TEST_PASSWORD}")


if __name__ == "__main__":
    main()
