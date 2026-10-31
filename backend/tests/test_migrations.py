"""Alembic migrations against the isolated database (ST9)."""

from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from alembic.script import ScriptDirectory
from alembic.config import Config
from sqlalchemy import text

from app.database import engine
from app.models import Base
from tests.conftest import BACKEND_DIR


def test_database_is_at_alembic_head(migrated_database):
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    head = ScriptDirectory.from_config(config).get_current_head()

    with engine.connect() as connection:
        current = connection.execute(
            text("SELECT version_num FROM alembic_version")
        ).scalar_one()

    assert current == head


def test_migrations_match_models(migrated_database):
    with engine.connect() as connection:
        diff = compare_metadata(
            MigrationContext.configure(connection),
            Base.metadata,
        )

    assert diff == []


def test_seed_is_idempotent(scenario, db, test_password_hash):
    from tests.seed import seed_reservation_scenario

    seed_reservation_scenario(db, password_hash=test_password_hash)
    seed_reservation_scenario(db, password_hash=test_password_hash)

    counts = db.execute(
        text(
            """
            SELECT
                (SELECT count(*) FROM users),
                (SELECT count(*) FROM businesses),
                (SELECT count(*) FROM branches),
                (SELECT count(*) FROM offers),
                (SELECT quantity_remaining FROM offers)
            """
        )
    ).one()

    assert tuple(counts) == (3, 1, 1, 1, 1)


def test_seeded_customers_can_log_in(scenario, client):
    from tests.seed import TEST_PASSWORD

    for email in (
        "customer.a@saveat-test.example.com",
        "customer.b@saveat-test.example.com",
    ):
        response = client.post(
            "/auth/login",
            json={"email": email, "password": TEST_PASSWORD},
        )

        assert response.status_code == 200, response.json()
        assert response.json()["access_token"]
