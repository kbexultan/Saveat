"""
Единый справочник категорий товаров.

В БД products.category — свободная строка, поэтому список допустимых
значений живёт здесь и проверяется на входе в API. Фронт берёт этот же
список через GET /categories, чтобы подписи не разъезжались с данными:
раньше на главной были захардкожены «Десерты / Выпечка / Mystery Box»,
и категория meal вообще не имела кнопки.
"""


# Порядок важен: в таком виде категории выводятся на главной.
PRODUCT_CATEGORIES: list[tuple[str, str]] = [
    ("bakery", "Выпечка"),
    ("dessert", "Десерты"),
    ("meal", "Готовая еда"),
    ("drink", "Напитки"),
    ("grocery", "Продукты"),
    ("mystery", "Mystery Box"),
]

CATEGORY_LABELS: dict[str, str] = dict(PRODUCT_CATEGORIES)

CATEGORY_SLUGS: frozenset[str] = frozenset(CATEGORY_LABELS)


# Что успело попасть в базу до появления справочника и что руками
# может ввести бизнес. Используется и миграцией, и валидацией.
CATEGORY_ALIASES: dict[str, str] = {
    "desserts": "dessert",
    "deserts": "dessert",
    "десерт": "dessert",
    "десерты": "dessert",
    "bakeries": "bakery",
    "выпечка": "bakery",
    "хлеб": "bakery",
    "meals": "meal",
    "food": "meal",
    "готовая еда": "meal",
    "еда": "meal",
    # Значения из старого <select> в форме товара: он предлагал
    # собственный набор, не совпадавший со справочником.
    "cakes": "dessert",
    "торты": "dessert",
    "sandwiches": "meal",
    "сэндвичи": "meal",
    "ready_meals": "meal",
    "drinks": "drink",
    "напитки": "drink",
    "groceries": "grocery",
    "продукты": "grocery",
    "mystery box": "mystery",
    "mystery_box": "mystery",
    "сюрприз": "mystery",
}


def normalize_category(value: str | None) -> str | None:
    """
    Приводит категорию к slug из справочника.

    Пустая строка и None — это «категория не указана», поле
    необязательное. Неизвестное значение поднимает ValueError:
    молча подставлять None нельзя, иначе бизнес будет думать,
    что категорию сохранили.
    """
    if value is None:
        return None

    cleaned = value.strip().lower()

    if not cleaned:
        return None

    cleaned = CATEGORY_ALIASES.get(cleaned, cleaned)

    if cleaned not in CATEGORY_SLUGS:
        allowed = ", ".join(slug for slug, _ in PRODUCT_CATEGORIES)

        raise ValueError(
            f"Unknown category '{value}'. Allowed values: {allowed}"
        )

    return cleaned
