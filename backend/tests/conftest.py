"""
Shared fixtures for backend tests.

The first statement points the application at the isolated test database
(see tests/safety.py). Nothing from `app` may be imported above it.
"""

from tests.safety import configure_test_environment

TEST_DATABASE_URL = configure_test_environment()

from collections.abc import Callable, Iterator  # noqa: E402
from pathlib import Path  # noqa: E402
from uuid import UUID  # noqa: E402

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402
from sqlalchemy.engine import make_url  # noqa: E402
from sqlalchemy.exc import OperationalError  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.database import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Base  # noqa: E402
from app.security import create_access_token, hash_password  # noqa: E402
from tests.seed import (  # noqa: E402
    TEST_PASSWORD,
    ReservationScenario,
    seed_reservation_scenario,
)


BACKEND_DIR = Path(__file__).resolve().parent.parent

# Second line of defence: the engine created by app.database must be the
# one the guard approved, not whatever backend/.env says.
if engine.url != make_url(TEST_DATABASE_URL):
    raise RuntimeError(
        "app.database.engine is not bound to the test database; "
        "was `app` imported before tests.safety?"
    )


def truncate_all_tables() -> None:
    table_names = ", ".join(
        f'"{table.name}"'
        for table in Base.metadata.sorted_tables
    )

    with engine.begin() as connection:
        connection.execute(
            text(f"TRUNCATE TABLE {table_names} RESTART IDENTITY CASCADE")
        )


@pytest.fixture(scope="session")
def migrated_database() -> None:
    """
    Rebuilds the test schema from scratch with Alembic, once per run.

    Running every migration from an empty schema is also the migration
    check for the isolated database (ST9).
    """
    try:
        with engine.begin() as connection:
            connection.execute(text("DROP SCHEMA public CASCADE"))
            connection.execute(text("CREATE SCHEMA public"))
    except OperationalError as error:
        pytest.fail(
            "Test database is not reachable. Start it with "
            "`docker compose -f docker-compose.test.yml up -d --wait` "
            f"from the repository root.\n{error}",
            pytrace=False,
        )

    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option(
        "script_location",
        str(BACKEND_DIR / "alembic"),
    )

    # alembic/env.py reads app.config.settings, which already holds the
    # test URL because configure_test_environment() ran first.
    command.upgrade(config, "head")


@pytest.fixture
def db(migrated_database: None) -> Iterator[Session]:
    session = SessionLocal()

    try:
        yield session
    finally:
        session.close()
        truncate_all_tables()


@pytest.fixture(scope="session")
def test_password_hash() -> str:
    # Argon2 is deliberately slow; hash once per run.
    return hash_password(TEST_PASSWORD)


@pytest.fixture
def scenario(
    db: Session,
    test_password_hash: str,
) -> ReservationScenario:
    return seed_reservation_scenario(
        db,
        password_hash=test_password_hash,
    )


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def auth_headers() -> Callable[[UUID], dict[str, str]]:
    def build(user_id: UUID) -> dict[str, str]:
        token = create_access_token(str(user_id))

        return {"Authorization": f"Bearer {token}"}

    return build
