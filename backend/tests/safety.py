"""
Guards that keep automated tests away from real databases (ST9).

app.config reads backend/.env, which points at the production Supabase
project. Environment variables take precedence over .env in
pydantic-settings, so configure_test_environment() validates the test
URL and exports it as DATABASE_URL before anything imports `app`.

The test URL comes only from SAVEAT_TEST_DATABASE_URL (never from
DATABASE_URL) and must look like the local Docker database: a loopback
host and a database name containing "test". Anything that looks like a
hosted database is rejected before a connection is opened.
"""

import os
from pathlib import Path

from sqlalchemy.engine import URL, make_url
from sqlalchemy.exc import ArgumentError


TEST_DATABASE_ENV = "SAVEAT_TEST_DATABASE_URL"

# Matches docker-compose.test.yml.
DEFAULT_TEST_DATABASE_URL = (
    "postgresql+psycopg://saveat_test:saveat_test"
    "@127.0.0.1:54329/saveat_test"
)

LOCAL_HOSTS = {
    "localhost",
    "127.0.0.1",
    "::1",
}

# Substrings of hosted Postgres providers. A loopback check alone would
# already reject them; this list exists to give a clearer error message.
PRODUCTION_HOST_MARKERS = (
    "supabase",
    "pooler",
    "amazonaws",
    "aws-",
    "neon.tech",
    "render.com",
    "railway",
)

BACKEND_ENV_FILE = Path(__file__).resolve().parent.parent / ".env"

# Test-only secrets. They never leave the test process.
TEST_ENVIRONMENT = {
    "JWT_SECRET_KEY": "saveat-test-only-jwt-secret-not-for-production",
    "JWT_ALGORITHM": "HS256",
    # Empty VAPID keys switch web push off, so tests can never notify
    # real subscribers even if backend/.env holds production keys.
    "VAPID_PUBLIC_KEY": "",
    "VAPID_PRIVATE_KEY": "",
}


class UnsafeTestDatabaseError(RuntimeError):
    pass


def read_env_file_database_url(
    env_file: Path = BACKEND_ENV_FILE,
) -> str | None:
    """DATABASE_URL from backend/.env, i.e. the developer's real database."""
    if not env_file.exists():
        return None

    for line in env_file.read_text(encoding="utf-8").splitlines():
        key, separator, value = line.partition("=")

        if separator and key.strip() == "DATABASE_URL":
            return value.strip().strip('"').strip("'")

    return None


def same_database(left: URL, right: URL) -> bool:
    return (
        (left.host or "").lower() == (right.host or "").lower()
        and (left.port or 5432) == (right.port or 5432)
        and left.database == right.database
    )


def assert_safe_test_database_url(
    raw_url: str,
    *,
    real_database_urls: tuple[str | None, ...] = (),
) -> URL:
    try:
        url = make_url(raw_url)
    except ArgumentError as error:
        raise UnsafeTestDatabaseError(
            f"{TEST_DATABASE_ENV} is not a valid database URL"
        ) from error

    if not url.drivername.startswith("postgresql"):
        raise UnsafeTestDatabaseError(
            "Tests need PostgreSQL (row locks are part of what is tested); "
            f"got driver {url.drivername!r}"
        )

    host = (url.host or "").lower()

    for marker in PRODUCTION_HOST_MARKERS:
        if marker in host:
            raise UnsafeTestDatabaseError(
                f"Refusing to run tests against a hosted database ({host}). "
                "Start the local one with "
                "`docker compose -f docker-compose.test.yml up -d --wait`."
            )

    if host not in LOCAL_HOSTS:
        raise UnsafeTestDatabaseError(
            f"Test database host must be local ({', '.join(sorted(LOCAL_HOSTS))}), "
            f"got {host or '<empty>'!r}"
        )

    if not url.database or "test" not in url.database.lower():
        raise UnsafeTestDatabaseError(
            "Test database name must contain 'test', "
            f"got {url.database!r}"
        )

    for real_database_url in real_database_urls:
        if not real_database_url:
            continue

        try:
            real_url = make_url(real_database_url)
        except ArgumentError:
            continue

        if same_database(url, real_url):
            raise UnsafeTestDatabaseError(
                "Test database is the same as the application DATABASE_URL; "
                "tests wipe their database and must use a separate one"
            )

    return url


def configure_test_environment() -> str:
    """
    Validates the test database URL and exports the test settings.

    Must run before the first `import app...` that touches app.config,
    otherwise the engine is already bound to backend/.env.
    """
    raw_url = os.environ.get(
        TEST_DATABASE_ENV,
        DEFAULT_TEST_DATABASE_URL,
    )

    assert_safe_test_database_url(
        raw_url,
        real_database_urls=(
            read_env_file_database_url(),
            # Already pointing at the test database (e.g. exported for
            # alembic) is fine; anything else in the shell is not.
            shell_database_url
            if (shell_database_url := os.environ.get("DATABASE_URL")) != raw_url
            else None,
        ),
    )

    os.environ["DATABASE_URL"] = raw_url
    os.environ.update(TEST_ENVIRONMENT)

    return raw_url
