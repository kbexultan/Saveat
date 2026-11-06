"""Persist auth throttles, revoked sessions and push session ownership."""
from alembic import op
import sqlalchemy as sa

revision = "72c98b6a10de"
down_revision = "6ab12d901e34"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("auth_rate_buckets", sa.Column("key", sa.String(64), primary_key=True),
                    sa.Column("hits", sa.Integer(), nullable=False),
                    sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_auth_rate_buckets_expires_at", "auth_rate_buckets", ["expires_at"])
    op.create_table("revoked_sessions", sa.Column("token_hash", sa.String(64), primary_key=True),
                    sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_revoked_sessions_expires_at", "revoked_sessions", ["expires_at"])
    op.add_column("push_subscriptions", sa.Column("session_hash", sa.String(64), nullable=True))
    op.add_column("push_subscriptions", sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True))


def downgrade():
    op.drop_column("push_subscriptions", "expires_at")
    op.drop_column("push_subscriptions", "session_hash")
    op.drop_table("revoked_sessions")
    op.drop_table("auth_rate_buckets")
