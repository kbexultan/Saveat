"""add business members

Revision ID: b8d31c74e901
Revises: a4c21f91b2d0
Create Date: 2026-09-09
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b8d31c74e901"

down_revision: Union[
    str,
    Sequence[str],
    None,
] = "a4c21f91b2d0"

branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "business_members",

        sa.Column(
            "id",
            sa.UUID(),
            nullable=False,
        ),

        sa.Column(
            "business_id",
            sa.UUID(),
            nullable=False,
        ),

        sa.Column(
            "user_id",
            sa.UUID(),
            nullable=False,
        ),

        sa.Column(
            "role",
            sa.String(length=30),
            nullable=False,
        ),

        sa.Column(
            "status",
            sa.String(length=30),
            nullable=False,
        ),

        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),

        sa.ForeignKeyConstraint(
            ["business_id"],
            ["businesses.id"],
            ondelete="CASCADE",
        ),

        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),

        sa.PrimaryKeyConstraint(
            "id",
        ),

        sa.UniqueConstraint(
            "business_id",
            "user_id",
            name=(
                "uq_business_members_business_user"
            ),
        ),
    )

    op.create_index(
        "ix_business_members_business_id",
        "business_members",
        ["business_id"],
        unique=False,
    )

    op.create_index(
        "ix_business_members_user_id",
        "business_members",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_business_members_user_id",
        table_name="business_members",
    )

    op.drop_index(
        "ix_business_members_business_id",
        table_name="business_members",
    )

    op.drop_table(
        "business_members",
    )