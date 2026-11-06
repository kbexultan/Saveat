from datetime import datetime, timezone
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import bearer_scheme, get_current_user, lock_auth_session, token_hash
from app.config import settings
from app.models.auth_state import RevokedSession
from app.models.push_subscription import PushSubscription
from app.rate_limit import limit_auth
from app.database import get_db
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    RegisterRequest,
    TokenResponse,
)
from app.schemas.user import UserResponse
from app.security import (
    create_access_token,
    hash_password,
    verify_password,
)


router = APIRouter(
    prefix="/auth",
    tags=["Auth"],
)


def normalize_email(value: str) -> str:
    # Email всегда храним и ищем
    # в нижнем регистре, иначе
    # Bek@mail.ru и bek@mail.ru
    # становятся разными аккаунтами.
    return str(value).strip().lower()


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(
    data: RegisterRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    limit_auth(request, str(data.email))
    email = normalize_email(data.email)
    phone = data.phone.strip()

    existing_user = db.execute(
        select(User).where(
            func.lower(User.email) == email
        )
    ).scalar_one_or_none()

    if existing_user is not None:
        raise HTTPException(
            status_code=409,
            detail="Email already registered",
        )

    existing_phone = db.execute(
        select(User).where(User.phone == phone)
    ).scalar_one_or_none()

    if existing_phone is not None:
        raise HTTPException(
            status_code=409,
            detail="Phone already registered",
        )

    user = User(
        full_name=data.full_name.strip(),
        phone=phone,
        email=email,
        password_hash=hash_password(data.password),
    )

    db.add(user)

    try:
        db.commit()
        db.refresh(user)

    except IntegrityError:
        # Кто-то занял email или телефон
        # между проверкой и commit.
        db.rollback()

        raise HTTPException(
            status_code=409,
            detail="Email already registered",
        )

    except Exception:
        db.rollback()
        raise

    return user


@router.post(
    "/login",
    response_model=TokenResponse,
)
def login(
    data: LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    limit_auth(request, str(data.email))
    email = normalize_email(data.email)

    user = db.execute(
        select(User).where(
            func.lower(User.email) == email
        )
    ).scalar_one_or_none()

    if not verify_password(
        data.password,
        user.password_hash if user is not None else None,
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password",
        )

    token = create_access_token(str(user.id))

    return TokenResponse(
        access_token=token,
    )


@router.get(
    "/me",
    response_model=UserResponse,
)
def me(
    current_user: User = Depends(get_current_user),
):
    return current_user


@router.post("/logout", status_code=204)
def logout(
    current_user: User = Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
):
    digest = token_hash(credentials.credentials)
    lock_auth_session(db, credentials.credentials)
    payload = jwt.decode(credentials.credentials, settings.jwt_secret_key,
                         algorithms=[settings.jwt_algorithm], options={"require": ["exp", "sub"]})
    now = datetime.now(timezone.utc)
    db.execute(delete(RevokedSession).where(RevokedSession.expires_at < now))
    db.execute(insert(RevokedSession).values(token_hash=digest,
        expires_at=datetime.fromtimestamp(payload["exp"], timezone.utc)).on_conflict_do_nothing())
    db.execute(delete(PushSubscription).where(
        PushSubscription.user_id == current_user.id,
        PushSubscription.session_hash == digest,
    ))
    db.commit()
    return Response(status_code=204)
