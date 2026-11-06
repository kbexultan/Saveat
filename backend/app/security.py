from datetime import datetime, timedelta, timezone

import jwt
import uuid
from pwdlib import PasswordHash

from app.config import settings


password_hash = PasswordHash.recommended()
_dummy_password_hash = password_hash.hash(uuid.uuid4().hex)


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(
    plain_password: str,
    hashed_password: str | None,
) -> bool:
    if hashed_password is None:
        # Keep missing accounts on the same expensive Argon2 path.
        password_hash.verify(plain_password, _dummy_password_hash)
        return False
    return password_hash.verify(
        plain_password,
        hashed_password,
    )


def create_access_token(user_id: str) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=settings.access_token_expire_minutes
    )

    payload = {
        "sub": user_id,
        "exp": expires_at,
        "jti": uuid.uuid4().hex,
    }

    return jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )
