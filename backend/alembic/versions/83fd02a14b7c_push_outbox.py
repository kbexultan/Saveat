"""Durable per-device push outbox, committed with the notification."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "83fd02a14b7c"
down_revision = "72c98b6a10de"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("push_deliveries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("notification_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("notifications.id", ondelete="CASCADE"), nullable=False),
        sa.Column("subscription_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("session_hash", sa.String(64), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("next_attempt_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.String(100), nullable=True),
        sa.UniqueConstraint("notification_id", "subscription_id", name="uq_push_delivery_notification_subscription"))
    op.create_index("ix_push_deliveries_next_attempt_at", "push_deliveries", ["next_attempt_at"])


def downgrade():
    op.drop_table("push_deliveries")
