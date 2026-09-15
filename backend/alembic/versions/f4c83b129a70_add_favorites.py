"""add favorites

Revision ID: f4c83b129a70
Revises: b8d31c74e901
Create Date: 2026-09-15
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f4c83b129a70"
down_revision: Union[
    str,
    Sequence[str],
    None,
] = "b8d31c74e901"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "favorites",
        sa.Column(
            "id",
            sa.UUID(),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.UUID(),
            nullable=False,
        ),
        sa.Column(
            "offer_id",
            sa.UUID(),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["offer_id"],
            ["offers.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "offer_id",
            name="uq_favorites_user_offer",
        ),
    )

    op.create_index(
        "ix_favorites_offer_id",
        "favorites",
        ["offer_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_favorites_offer_id",
        table_name="favorites",
    )

    op.drop_table("favorites")
