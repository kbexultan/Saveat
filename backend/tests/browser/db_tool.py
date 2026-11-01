"""
Test-database helper for run_acceptance.mjs. Run from backend/:

    uv run python tests/browser/db_tool.py seed [quantity]
    uv run python tests/browser/db_tool.py state

Goes through tests.safety, so it only works on the local test database.
"""

import json
import os
import sys

sys.path.insert(0, os.getcwd())

from tests.safety import configure_test_environment  # noqa: E402

configure_test_environment()

from sqlalchemy import text  # noqa: E402

from app.database import SessionLocal, engine  # noqa: E402
from app.security import hash_password  # noqa: E402
from tests.seed import (  # noqa: E402
    LAST_ITEM_OFFER_ID,
    TEST_PASSWORD,
    seed_reservation_scenario,
)


def main():
    command = sys.argv[1]

    if command == "seed":
        quantity = int(sys.argv[2]) if len(sys.argv) > 2 else 1
        with SessionLocal() as db:
            seed_reservation_scenario(db, password_hash=hash_password(TEST_PASSWORD))
            db.execute(
                text(
                    "UPDATE offers SET quantity_total = :q, quantity_remaining = :q "
                    "WHERE id = :id"
                ),
                {"q": quantity, "id": LAST_ITEM_OFFER_ID},
            )
            db.commit()

    with engine.connect() as connection:
        row = connection.execute(
            text(
                "SELECT quantity_remaining, status, "
                "(SELECT count(*) FROM orders), "
                "(SELECT min(quantity_remaining) FROM offers) "
                "FROM offers WHERE id = :id"
            ),
            {"id": LAST_ITEM_OFFER_ID},
        ).one()

    print(
        json.dumps(
            {
                "quantity_remaining": row[0],
                "status": row[1],
                "orders": row[2],
                "min_quantity": row[3],
            }
        )
    )


main()
