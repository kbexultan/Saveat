"""Checkout identity and stock bounds; preserve all historical orders."""
from alembic import op
import sqlalchemy as sa

revision = "6ab12d901e34"
down_revision = "a91f37c4e6b2"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("orders", sa.Column("idempotency_key", sa.String(128), nullable=True))
    op.add_column("orders", sa.Column("request_fingerprint", sa.String(64), nullable=True))
    op.create_unique_constraint("uq_orders_user_idempotency", "orders", ["user_id", "idempotency_key"])
    # NOT VALID protects new writes without scanning/rewriting historical rows.
    # Existing invalid stock, if any, must be reviewed before VALIDATE CONSTRAINT.
    op.execute("ALTER TABLE offers ADD CONSTRAINT ck_offers_stock_bounds "
               "CHECK (quantity_remaining >= 0 AND quantity_remaining <= quantity_total) NOT VALID")


def downgrade():
    op.drop_constraint("ck_offers_stock_bounds", "offers", type_="check")
    op.drop_constraint("uq_orders_user_idempotency", "orders", type_="unique")
    op.drop_column("orders", "request_fingerprint")
    op.drop_column("orders", "idempotency_key")
