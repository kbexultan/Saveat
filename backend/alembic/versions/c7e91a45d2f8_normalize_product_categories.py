"""normalize product categories

Revision ID: c7e91a45d2f8
Revises: f4c83b129a70
Create Date: 2026-09-15
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from app.categories import CATEGORY_ALIASES


revision: str = "c7e91a45d2f8"
down_revision: Union[
    str,
    Sequence[str],
    None,
] = "f4c83b129a70"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Схлопывает разнописные категории к slug'ам справочника:
    до появления валидации поле было свободным текстом, и в базе
    успели появиться, например, desserts рядом с dessert.

    Значения, которых нет в списке синонимов, намеренно не трогаем —
    обнулять их значило бы потерять то, что ввёл бизнес. Они просто
    не попадут ни под один фильтр, и это видно в каталоге.
    """
    connection = op.get_bind()

    # Сначала обрезаем пробелы и приводим к нижнему регистру:
    # иначе " Dessert " не совпадёт ни с одним ключом.
    connection.execute(
        sa.text(
            """
            UPDATE products
            SET category = lower(btrim(category))
            WHERE category IS NOT NULL
              AND category <> lower(btrim(category))
            """
        )
    )

    connection.execute(
        sa.text(
            """
            UPDATE products
            SET category = NULL
            WHERE category IS NOT NULL
              AND btrim(category) = ''
            """
        )
    )

    for alias, slug in CATEGORY_ALIASES.items():
        connection.execute(
            sa.text(
                """
                UPDATE products
                SET category = :slug
                WHERE category = :alias
                """
            ),
            {"slug": slug, "alias": alias},
        )


def downgrade() -> None:
    """
    Обратной операции нет: после схлопывания уже не отличить строку,
    которая была 'desserts', от той, что изначально была 'dessert'.
    """
    pass
