import uuid
from datetime import datetime, timezone
import jwt

from fastapi import (
    APIRouter,
    Depends,
    Response,
    status,
)
from sqlalchemy import delete
from sqlalchemy.dialects.postgresql import insert
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.auth import bearer_scheme, get_current_user, lock_auth_session, token_hash
from app.config import settings
from app.database import get_db
from app.models.push_subscription import PushSubscription
from app.models.user import User
from app.push import web_push_enabled
from app.schemas.notification import (
    PushPublicKeyResponse,
    PushSubscribeRequest,
    PushUnsubscribeRequest,
)


router = APIRouter(
    prefix="/push",
    tags=["Push"],
)


@router.get(
    "/public-key",
    response_model=PushPublicKeyResponse,
)
def get_public_key():
    """
    Фронт спрашивает ключ перед подпиской. Если push не настроен,
    отдаём enabled=false — интерфейс просто не покажет предложение
    подписаться, вместо того чтобы падать на пустом ключе.
    """
    return PushPublicKeyResponse(
        enabled=web_push_enabled(),
        public_key=settings.vapid_public_key,
    )


@router.post(
    "/subscribe",
    status_code=status.HTTP_204_NO_CONTENT,
)
def subscribe(
    data: PushSubscribeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> Response:
    lock_auth_session(db, credentials.credentials)
    payload = jwt.decode(credentials.credentials, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm],
                         options={"require": ["exp", "sub"]})
    values = dict(user_id=current_user.id, platform=data.platform, endpoint=data.endpoint,
                  p256dh=data.p256dh, auth=data.auth, session_hash=token_hash(credentials.credentials),
                  expires_at=datetime.fromtimestamp(payload["exp"], timezone.utc))
    try:
        db.execute(insert(PushSubscription).values(id=uuid.uuid4(), **values).on_conflict_do_update(
            index_elements=[PushSubscription.endpoint], set_=values,
        ))
        db.commit()
    except Exception:
        db.rollback()
        raise

    return Response(
        status_code=status.HTTP_204_NO_CONTENT
    )


@router.post(
    "/unsubscribe",
    status_code=status.HTTP_204_NO_CONTENT,
)
def unsubscribe(
    data: PushUnsubscribeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    try:
        db.execute(
            delete(PushSubscription).where(
                PushSubscription.endpoint == data.endpoint,
                PushSubscription.user_id == current_user.id,
            )
        )

        db.commit()
    except Exception:
        db.rollback()
        raise

    return Response(
        status_code=status.HTTP_204_NO_CONTENT
    )
