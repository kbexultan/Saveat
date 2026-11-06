from datetime import datetime
from uuid import UUID
from typing import Literal
from urllib.parse import urlsplit
import re

from pydantic import BaseModel, ConfigDict, Field, model_validator
from app.config import settings


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


class PushUnsubscribeRequest(BaseModel):
    endpoint: str = Field(min_length=1, max_length=4096)


def valid_web_endpoint(endpoint: str) -> bool:
    try:
        url = urlsplit(endpoint)
        return bool(url.scheme == "https" and url.hostname in settings.web_push_allowed_hosts
                    and url.port in (None, 443) and not url.username and not url.password and not url.fragment)
    except ValueError:
        return False


class PushSubscribeRequest(PushUnsubscribeRequest):
    p256dh: str | None = Field(default=None, max_length=512)
    auth: str | None = Field(default=None, max_length=512)
    platform: Literal["web", "expo"] = "web"

    @model_validator(mode="after")
    def validate_transport(self):
        if self.platform == "expo":
            if not re.fullmatch(r"(?:ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]", self.endpoint):
                raise ValueError("Invalid Expo token")
        elif not valid_web_endpoint(self.endpoint) or not self.p256dh or not self.auth:
            raise ValueError("Invalid web push subscription")
        return self


class PushPublicKeyResponse(BaseModel):
    enabled: bool
    public_key: str | None
