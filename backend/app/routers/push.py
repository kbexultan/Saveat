import uuid

from fastapi import (
    APIRouter,
    Depends,
    Response,
    status,
)
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import settings
from app.database import get_db
from app.models.push_subscription import PushSubscription
from app.models.user import User
from app.push import web_push_enabled
from app.schemas.notification import (
    PushPublicKeyResponse,
    PushSubscribeRequest,
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
) -> Response:
    existing = db.execute(
        select(PushSubscription).where(
            PushSubscription.endpoint == data.endpoint
        )
    ).scalar_one_or_none()

    try:
        if existing is not None:
            # Тем же устройством мог пользоваться другой аккаунт:
            # перепривязываем подписку, а не заводим вторую.
            existing.user_id = current_user.id
            existing.platform = data.platform
            existing.p256dh = data.p256dh
            existing.auth = data.auth
        else:
            db.add(
                PushSubscription(
                    id=uuid.uuid4(),
                    user_id=current_user.id,
                    platform=data.platform,
                    endpoint=data.endpoint,
                    p256dh=data.p256dh,
                    auth=data.auth,
                )
            )

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
    data: PushSubscribeRequest,
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
