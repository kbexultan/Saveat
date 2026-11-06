import hashlib
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt.exceptions import InvalidTokenError
from sqlalchemy.orm import Session
from sqlalchemy import func, select

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.models.auth_state import RevokedSession


bearer_scheme = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
            options={"require": ["exp", "sub"]},
        )

        user_id = payload.get("sub")

        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
            )

        user_uuid = UUID(user_id)

    except (InvalidTokenError, ValueError, TypeError, AttributeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    if db.get(RevokedSession, token_hash(token)) is not None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = db.get(User, user_uuid)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    return user


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def lock_auth_session(db: Session, token: str) -> None:
    # Serialize logout with late push registration from the same session.
    lock_id = int.from_bytes(hashlib.sha256(f"session:{token_hash(token)}".encode()).digest()[:8], "big", signed=True)
    db.execute(select(func.pg_advisory_xact_lock(lock_id)))
    if db.get(RevokedSession, token_hash(token)) is not None:
        raise HTTPException(401, "Invalid or expired token")
