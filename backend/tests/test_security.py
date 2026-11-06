from datetime import datetime, timedelta, timezone
import jwt
import pytest
from sqlalchemy import select
from app.config import settings
from app.models.auth_state import AuthRateBucket
from app.models.business import Business
from app.security import hash_password, verify_password
from tests.seed import TEST_PASSWORD


@pytest.mark.parametrize("claims", [
    {}, {"exp": datetime.now(timezone.utc) + timedelta(hours=1)},
    {"sub": "not-a-uuid", "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
    {"sub": 123, "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
])
def test_malformed_jwt_is_unauthorized(scenario, client, claims):
    token = jwt.encode(claims, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    assert client.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_expiry_and_required_exp(scenario, client):
    for claims in [{"sub": str(scenario.customer_a_id)}, {
        "sub": str(scenario.customer_a_id), "exp": datetime.now(timezone.utc) - timedelta(seconds=1),
    }]:
        token = jwt.encode(claims, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
        assert client.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_login_limit_shared_between_customer_and_business_routes(scenario, db, client):
    body = {"email": "customer.a@saveat-test.example.com", "password": "wrong"}
    for index in range(10):
        path = "/auth/login" if index % 2 else "/business-auth/login"
        assert client.post(path, json=body).status_code == 401
    limited = client.post("/auth/login", json=body)
    assert limited.status_code == 429
    assert int(limited.headers["retry-after"]) > 0
    assert "customer.a" not in str(db.scalars(select(AuthRateBucket.key)).all())


@pytest.mark.parametrize("path", ["/auth/register", "/business-auth/register"])
def test_registration_limit(scenario, client, path):
    body = {"email": "customer.a@saveat-test.example.com", "password": TEST_PASSWORD,
            "full_name": "Existing customer", "phone": "+77011234567", "business_name": "Bakery"}
    for _ in range(5):
        assert client.post(path, json=body).status_code == 409
    assert client.post(path, json=body).status_code == 429


def test_password_hashing():
    encoded = hash_password(TEST_PASSWORD)
    assert encoded.startswith("$argon2id$")
    assert verify_password(TEST_PASSWORD, encoded)
    assert not verify_password("wrong", encoded)
    assert not verify_password(TEST_PASSWORD, None)


def test_wrong_signature_is_rejected(scenario, client):
    token = jwt.encode({"sub": str(scenario.customer_a_id), "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
                       "wrong-test-signing-key-with-enough-length", algorithm="HS256")
    assert client.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_business_creation_is_pending_and_existing_bakery_stays_active(scenario, db, client, auth_headers):
    response = client.post("/businesses", json={"name": "Pending bakery"}, headers=auth_headers(scenario.customer_a_id))
    assert response.status_code == 201, response.text
    assert response.json()["status"] == "pending"
    assert db.get(Business, scenario.business_id).status == "active"
    business_id = response.json()["id"]
    assert client.get(f"/businesses/{business_id}").status_code == 404
    assert client.get(f"/offers/business/{business_id}", headers=auth_headers(scenario.customer_a_id)).status_code == 403
    assert all(row["id"] != business_id for row in client.get("/businesses/public").json())


def test_business_registration_is_pending(scenario, client):
    response = client.post("/business-auth/register", json={
        "full_name": "Pilot owner", "email": "pilot.owner@example.com", "phone": "+77015550123",
        "password": TEST_PASSWORD, "business_name": "Pilot bakery",
    })
    assert response.status_code == 201, response.text
    assert response.json()["memberships"][0]["business"]["status"] == "pending"


def test_cors_and_readiness(client, monkeypatch):
    response = client.options("/auth/login", headers={"Origin": "http://localhost:3001", "Access-Control-Request-Method": "POST"})
    assert response.headers["access-control-allow-origin"] == "http://localhost:3001"
    blocked = client.options("/auth/login", headers={"Origin": "https://unapproved.example.com", "Access-Control-Request-Method": "POST"})
    assert "access-control-allow-origin" not in blocked.headers
    from sqlalchemy.exc import OperationalError
    import app.main as main
    def fail():
        raise OperationalError("secret connection string", {}, Exception("secret"))
    monkeypatch.setattr(main, "test_database_connection", fail)
    response = client.get("/health/database")
    assert response.status_code == 503
    assert "secret" not in response.text
