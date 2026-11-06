"""Shared PostgreSQL fixed-window limits; no dependence on proxy-supplied headers."""
import hashlib
import hmac
import time
from datetime import datetime, timezone

from fastapi import HTTPException, Request
from sqlalchemy import delete
from sqlalchemy.dialects.postgresql import insert

from app.config import settings
from app.database import SessionLocal
from app.models.auth_state import AuthRateBucket


def limit_auth(request: Request, email: str) -> None:
    registration = request.url.path.endswith("/register")
    action = "register" if registration else "login"
    window = 3600 if registration else 600
    now = time.time()
    period = int(now // window)
    expires = datetime.fromtimestamp((period + 1) * window, timezone.utc)
    ip = request.client.host if request.client else "unknown"
    scopes = [("ip", ip, 10 if registration else 60), ("account", email.strip().lower(), 5 if registration else 10)]
    exceeded = False
    # Commit attempts even when authentication fails or the request is rejected.
    with SessionLocal.begin() as db:
        db.execute(delete(AuthRateBucket).where(AuthRateBucket.expires_at < datetime.now(timezone.utc)))
        for scope, identity, limit in scopes:
            key = hmac.new(settings.jwt_secret_key.encode(), f"{action}:{period}:{scope}:{identity}".encode(), hashlib.sha256).hexdigest()
            stmt = insert(AuthRateBucket).values(key=key, hits=1, expires_at=expires)
            hits = db.scalar(stmt.on_conflict_do_update(
                index_elements=[AuthRateBucket.key], set_={"hits": AuthRateBucket.hits + 1},
            ).returning(AuthRateBucket.hits))
            exceeded |= hits > limit
    if exceeded:
        raise HTTPException(429, "Too many attempts. Try again later.", headers={"Retry-After": str(max(1, int(expires.timestamp() - now)))})
