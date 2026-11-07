from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator


class Settings(BaseSettings):
    database_url: str

    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    push_worker_enabled: bool = True
    # Rolls the pickup window of seeded demo offers (offers.is_demo) forward
    # so the demo storefront never empties. Real offers are never touched.
    # Off by default; the demo environment turns it on (DEMO_ENVIRONMENT.md).
    demo_offers_auto_renew: bool = False
    # Password for the demo accounts created by scripts.demo_env. Lives only
    # in the local, git-ignored backend/.env, never in the repository.
    demo_account_password: str | None = None
    # Existing businesses keep their status. Only new registrations need approval.
    business_registration_requires_approval: bool = True
    cors_origins: list[str] = [
        "http://localhost:3001", "http://127.0.0.1:3001",
        "http://localhost:3000", "http://127.0.0.1:3000",
        "http://localhost:8081", "http://127.0.0.1:8081",
    ]
    web_push_allowed_hosts: list[str] = [
        "fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com",
    ]

    @field_validator("cors_origins")
    @classmethod
    def validate_origins(cls, origins):
        from urllib.parse import urlsplit
        for origin in origins:
            url = urlsplit(origin)
            if (url.scheme not in {"http", "https"} or not url.hostname or "*" in origin
                or url.username or url.password or url.path not in {"", "/"} or url.query or url.fragment):
                raise ValueError("CORS_ORIGINS must contain explicit HTTP(S) origins")
        return [origin.rstrip("/") for origin in origins]

    # Web Push. Без ключей push просто выключен — приложение работает,
    # уведомления остаются в списке под колокольчиком.
    vapid_public_key: str | None = None
    vapid_private_key: str | None = None
    vapid_subject: str = "mailto:support@saveat.kz"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
    )


settings = Settings()
