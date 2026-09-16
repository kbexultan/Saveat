"""add business subscriptions

Revision ID: a91f37c4e6b2
Revises: e5b2a9c73f41
Create Date: 2026-09-16
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "a91f37c4e6b2"
down_revision: Union[
    str,
    Sequence[str],
    None,
] = "e5b2a9c73f41"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "business_subscriptions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "business_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey(
                "businesses.id",
                ondelete="CASCADE",
            ),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint(
            "user_id",
            "business_id",
            name="uq_business_subscriptions_user_business",
        ),
    )

    op.create_index(
        "ix_business_subscriptions_user_id",
        "business_subscriptions",
        ["user_id"],
    )

    # По этому индексу идёт рассылка при публикации предложения:
    # ищем всех подписчиков заведения.
    op.create_index(
        "ix_business_subscriptions_business_id",
        "business_subscriptions",
        ["business_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_business_subscriptions_business_id",
        table_name="business_subscriptions",
    )
    op.drop_index(
        "ix_business_subscriptions_user_id",
        table_name="business_subscriptions",
    )
    op.drop_table("business_subscriptions")
