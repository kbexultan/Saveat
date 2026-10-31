"""Unit tests for the production-database guard (ST9). No database needed."""

import pytest

from tests.safety import (
    DEFAULT_TEST_DATABASE_URL,
    UnsafeTestDatabaseError,
    assert_safe_test_database_url,
)


def test_default_docker_database_is_accepted():
    url = assert_safe_test_database_url(DEFAULT_TEST_DATABASE_URL)

    assert url.host == "127.0.0.1"
    assert url.port == 54329
    assert url.database == "saveat_test"


@pytest.mark.parametrize(
    "url",
    [
        # Shapes of real Supabase connection strings (fake credentials).
        "postgresql+psycopg://postgres.abc:pw@aws-0-eu-central-1.pooler.supabase.com:5432/postgres",
        "postgresql+psycopg://postgres:pw@db.abcdefgh.supabase.co:5432/postgres",
        # Even a "test" database is refused on a hosted server.
        "postgresql+psycopg://user:pw@db.abcdefgh.supabase.co:5432/saveat_test",
        "postgresql+psycopg://user:pw@my-db.amazonaws.com:5432/saveat_test",
        # Remote host without a known provider name.
        "postgresql+psycopg://user:pw@10.0.0.15:5432/saveat_test",
    ],
)
def test_hosted_and_remote_databases_are_rejected(url):
    with pytest.raises(UnsafeTestDatabaseError):
        assert_safe_test_database_url(url)


def test_local_database_without_test_in_name_is_rejected():
    with pytest.raises(UnsafeTestDatabaseError, match="must contain 'test'"):
        assert_safe_test_database_url(
            "postgresql+psycopg://postgres:pw@localhost:5432/postgres"
        )


def test_non_postgres_database_is_rejected():
    with pytest.raises(UnsafeTestDatabaseError, match="PostgreSQL"):
        assert_safe_test_database_url("sqlite:///saveat_test.db")


def test_test_database_equal_to_application_database_is_rejected():
    with pytest.raises(UnsafeTestDatabaseError, match="same as"):
        assert_safe_test_database_url(
            DEFAULT_TEST_DATABASE_URL,
            real_database_urls=(
                "postgresql+psycopg://other:pw@127.0.0.1:54329/saveat_test",
            ),
        )


def test_garbage_url_is_rejected():
    with pytest.raises(UnsafeTestDatabaseError):
        assert_safe_test_database_url("not a url")


def test_pytest_process_is_bound_to_the_test_database():
    from app.config import settings
    from app.database import engine

    assert engine.url.host == "127.0.0.1"
    assert "test" in (engine.url.database or "")
    assert settings.database_url == str(
        engine.url.render_as_string(hide_password=False)
    )
    # Web push is disabled in tests.
    assert not settings.vapid_private_key
