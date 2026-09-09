"""add order items

Revision ID: a4c21f91b2d0
Revises: 553c1699eaf2
Create Date: 2026-09-09
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a4c21f91b2d0"

down_revision: Union[
    str,
    Sequence[str],
    None,
] = "553c1699eaf2"

branch_labels = None
depends_on = None


def upgrade() -> None:
    # --------------------------------
    # Новые данные parent Order
    # --------------------------------

    op.add_column(
        "orders",
        sa.Column(
            "branch_id",
            sa.UUID(),
            nullable=True,
        ),
    )

    op.add_column(
        "orders",
        sa.Column(
            "business_name",
            sa.String(length=150),
            nullable=True,
        ),
    )

    op.add_column(
        "orders",
        sa.Column(
            "branch_name",
            sa.String(length=150),
            nullable=True,
        ),
    )

    op.add_column(
        "orders",
        sa.Column(
            "address",
            sa.String(length=300),
            nullable=True,
        ),
    )

    op.add_column(
        "orders",
        sa.Column(
            "pickup_start",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )

    op.add_column(
        "orders",
        sa.Column(
            "pickup_end",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )

    op.add_column(
        "orders",
        sa.Column(
            "payment_method",
            sa.String(length=30),
            nullable=False,
            server_default="pay_on_pickup",
        ),
    )

    op.create_foreign_key(
        "fk_orders_branch_id",
        "orders",
        "branches",
        ["branch_id"],
        ["id"],
    )

    op.create_index(
        "ix_orders_branch_id",
        "orders",
        ["branch_id"],
        unique=False,
    )

    # --------------------------------
    # Новый OrderItem
    # --------------------------------

    op.create_table(
        "order_items",

        sa.Column(
            "id",
            sa.UUID(),
            nullable=False,
        ),

        sa.Column(
            "order_id",
            sa.UUID(),
            nullable=False,
        ),

        sa.Column(
            "offer_id",
            sa.UUID(),
            nullable=True,
        ),

        sa.Column(
            "offer_title",
            sa.String(length=150),
            nullable=False,
        ),

        sa.Column(
            "product_name",
            sa.String(length=150),
            nullable=True,
        ),

        sa.Column(
            "product_image_url",
            sa.String(length=500),
            nullable=True,
        ),

        sa.Column(
            "quantity",
            sa.Integer(),
            nullable=False,
        ),

        sa.Column(
            "unit_price",
            sa.Numeric(
                precision=12,
                scale=2,
            ),
            nullable=False,
        ),

        sa.Column(
            "total_price",
            sa.Numeric(
                precision=12,
                scale=2,
            ),
            nullable=False,
        ),

        sa.ForeignKeyConstraint(
            ["order_id"],
            ["orders.id"],
            ondelete="CASCADE",
        ),

        sa.ForeignKeyConstraint(
            ["offer_id"],
            ["offers.id"],
            ondelete="SET NULL",
        ),

        sa.PrimaryKeyConstraint(
            "id",
        ),

        sa.UniqueConstraint(
            "order_id",
            "offer_id",
            name="uq_order_items_order_offer",
        ),
    )

    op.create_index(
        "ix_order_items_order_id",
        "order_items",
        ["order_id"],
        unique=False,
    )

    op.create_index(
        "ix_order_items_offer_id",
        "order_items",
        ["offer_id"],
        unique=False,
    )

    # --------------------------------
    # Переносим старые Order данные
    # --------------------------------

    op.execute(
        """
        UPDATE orders AS o
        SET
            branch_id = of.branch_id,
            business_name = b.name,
            branch_name = br.name,
            address = br.address,
            pickup_start = of.pickup_start,
            pickup_end = of.pickup_end
        FROM offers AS of
        JOIN branches AS br
            ON br.id = of.branch_id
        JOIN businesses AS b
            ON b.id = br.business_id
        WHERE o.offer_id = of.id
        """
    )

    # --------------------------------
    # Каждый старый Order превращаем
    # в Order + один OrderItem
    # --------------------------------

    op.execute(
        """
        INSERT INTO order_items (
            id,
            order_id,
            offer_id,
            offer_title,
            product_name,
            product_image_url,
            quantity,
            unit_price,
            total_price
        )
        SELECT
            o.id,
            o.id,
            o.offer_id,
            of.title,
            p.name,
            p.image_url,
            o.quantity,
            o.unit_price,
            o.total_price
        FROM orders AS o
        JOIN offers AS of
            ON of.id = o.offer_id
        LEFT JOIN products AS p
            ON p.id = of.product_id
        """
    )

    # --------------------------------
    # Legacy поля делаем nullable.
    #
    # Это позволит на следующем шаге
    # создать один Order с несколькими
    # OrderItem.
    # --------------------------------

    op.alter_column(
        "orders",
        "offer_id",
        existing_type=sa.UUID(),
        nullable=True,
    )

    op.alter_column(
        "orders",
        "quantity",
        existing_type=sa.Integer(),
        nullable=True,
    )

    op.alter_column(
        "orders",
        "unit_price",
        existing_type=sa.Numeric(
            precision=12,
            scale=2,
        ),
        nullable=True,
    )


def downgrade() -> None:
    connection = op.get_bind()

    # Если уже появились новые
    # multi-item заказы, безопасный
    # downgrade невозможен.
    has_new_orders = connection.execute(
        sa.text(
            """
            SELECT EXISTS (
                SELECT 1
                FROM orders
                WHERE
                    offer_id IS NULL
                    OR quantity IS NULL
                    OR unit_price IS NULL
            )
            """
        )
    ).scalar()

    if has_new_orders:
        raise RuntimeError(
            "Cannot downgrade because "
            "multi-item orders already exist."
        )

    op.alter_column(
        "orders",
        "unit_price",
        existing_type=sa.Numeric(
            precision=12,
            scale=2,
        ),
        nullable=False,
    )

    op.alter_column(
        "orders",
        "quantity",
        existing_type=sa.Integer(),
        nullable=False,
    )

    op.alter_column(
        "orders",
        "offer_id",
        existing_type=sa.UUID(),
        nullable=False,
    )

    op.drop_index(
        "ix_order_items_offer_id",
        table_name="order_items",
    )

    op.drop_index(
        "ix_order_items_order_id",
        table_name="order_items",
    )

    op.drop_table(
        "order_items",
    )

    op.drop_index(
        "ix_orders_branch_id",
        table_name="orders",
    )

    op.drop_constraint(
        "fk_orders_branch_id",
        "orders",
        type_="foreignkey",
    )

    op.drop_column(
        "orders",
        "payment_method",
    )

    op.drop_column(
        "orders",
        "pickup_end",
    )

    op.drop_column(
        "orders",
        "pickup_start",
    )

    op.drop_column(
        "orders",
        "address",
    )

    op.drop_column(
        "orders",
        "branch_name",
    )

    op.drop_column(
        "orders",
        "business_name",
    )

    op.drop_column(
        "orders",
        "branch_id",
    )