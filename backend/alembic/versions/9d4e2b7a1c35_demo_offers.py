"""Mark seeded demo offers so their pickup window can roll forward.

Additive only: a NOT NULL boolean with a server default, so existing rows
become ordinary (is_demo = false) offers without a table rewrite, and a
partial index that only covers the handful of demo rows the renewal job
scans.
"""
from alembic import op
import sqlalchemy as sa

revision = "9d4e2b7a1c35"
down_revision = "83fd02a14b7c"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "offers",
        sa.Column("is_demo", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index(
        "ix_offers_demo_pickup_end",
        "offers",
        ["pickup_end"],
        postgresql_where=sa.text("is_demo"),
    )


def downgrade():
    op.drop_index("ix_offers_demo_pickup_end", table_name="offers")
    op.drop_column("offers", "is_demo")
