from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class NotificationResponse(BaseModel):
    id: UUID
    type: str
    title: str
    body: str
    order_id: UUID | None
    is_read: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UnreadCountResponse(BaseModel):
    unread: int


class PushSubscribeRequest(BaseModel):
    endpoint: str
    p256dh: str | None = None
    auth: str | None = None
    platform: str = "web"


class PushPublicKeyResponse(BaseModel):
    enabled: bool
    public_key: str | None
