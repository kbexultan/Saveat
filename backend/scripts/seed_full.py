"""
Аддитивный сид: наполняет данными все таблицы.

В отличие от seed_demo.py ничего не удаляет — только добавляет то,
чего ещё нет, поэтому повторный запуск безопасен и не плодит дубли.

    uv run python -m scripts.seed_full
"""

import random
import uuid
from datetime import datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.branch import Branch
from app.models.business import Business
from app.models.business_member import BusinessMember
from app.models.favorite import Favorite
from app.models.offer import Offer
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.product import Product
from app.models.user import User
from app.security import hash_password


ALMATY = ZoneInfo("Asia/Almaty")

DEMO_PASSWORD = "Demo12345!"

# Детерминированный прогон: повторный запуск даёт ту же раскладку.
rng = random.Random(20260915)


# Берём только те картинки, что уже используются в seed_demo.py и
# заведомо отдаются Unsplash. Выдумывать новые id — значит получить
# битые превью в каталоге.
IMG = {
    "honey": "photo-1578985545062-69928b1d9587",
    "cheesecake": "photo-1565958011703-44f9829ba187",
    "tiramisu": "photo-1571877227200-a0d98ea607e9",
    "croissant": "photo-1555507036-ab1f4038808a",
    "bread": "photo-1509440159596-0249088772ff",
    "cookie": "photo-1499636136210-6f4ee915583e",
    "sandwich": "photo-1528735602780-2552fd46c7af",
    "pizza": "photo-1579751626657-72bc17010498",
    "macaron": "photo-1569864358642-9d1684040f43",
    "cupcake": "photo-1486427944299-d1955d23e34d",
    "mystery": "photo-1551024506-0bccd828d307",
}


def img(key):
    return (
        f"https://images.unsplash.com/{IMG[key]}"
        "?auto=format&fit=crop&w=900&q=80"
    )


# --------------------------------------------------------------
# Заведения, точки и товары
# Товар: (название, описание, категория, картинка, цена, со скидкой)
# Точка: (название, адрес, широта, долгота, открытие, закрытие)
# --------------------------------------------------------------

BUSINESSES = [
    {
        "name": "Нан Патшасы",
        "description": "Пекарня полного цикла, хлеб из печи каждые три часа",
        "branches": [
            ("Нан Патшасы Сатпаева", "Улица Сатпаева 90, Алматы", 43.2380, 76.9020, 8, 21),
            ("Нан Патшасы Райымбека", "Проспект Райымбека 160, Алматы", 43.2690, 76.9520, 7, 20),
        ],
        "products": [
            ("Хлебный бокс", "Ассорти хлеба вечерней выпечки", "bakery", "bread", 2400, 1100),
            ("Сэндвич-сет", "Четыре сэндвича дня", "bakery", "sandwich", 3600, 2000),
            ("Круассаны 6 шт", "Слоёные круассаны утренней выпечки", "bakery", "croissant", 3000, 1700),
        ],
    },
    {
        "name": "Tea & Cake",
        "description": "Чайная с домашними десертами",
        "branches": [
            ("Tea & Cake Достык", "Проспект Достык 132, Алматы", 43.2400, 76.9580, 10, 22),
        ],
        "products": [
            ("Чизкейк целиком", "Классический нью-йоркский чизкейк", "dessert", "cheesecake", 5200, 2900),
            ("Макарон-бокс", "Двенадцать макаронов ассорти", "dessert", "macaron", 4600, 2600),
            ("Капкейки 4 шт", "Капкейки с кремом дня", "dessert", "cupcake", 3400, 1900),
        ],
    },
    {
        "name": "Pizza Republic",
        "description": "Пиццерия на дровах",
        "branches": [
            ("Pizza Republic Абая", "Проспект Абая 150, Алматы", 43.2340, 76.8850, 11, 23),
            ("Pizza Republic Аль-Фараби", "Проспект Аль-Фараби 77, Алматы", 43.2200, 76.9560, 11, 23),
        ],
        "products": [
            ("Пицца-бокс", "Ассорти кусочков вечерней пиццы", "meal", "pizza", 4800, 2400),
            ("Фокачча", "Свежая фокачча с розмарином", "bakery", "bread", 2200, 1200),
            ("Чиабатта с ветчиной", "Сэндвич на чиабатте", "meal", "sandwich", 2900, 1600),
        ],
    },
    {
        "name": "Coffee Lab Almaty",
        "description": "Обжарочная и кофейня третьей волны",
        "branches": [
            ("Coffee Lab Панфилова", "Улица Панфилова 98, Алматы", 43.2560, 76.9450, 8, 22),
        ],
        "products": [
            ("Выпечка дня", "Четыре позиции с витрины", "bakery", "bread", 3200, 1700),
            ("Печенье 500 г", "Домашнее печенье на развес", "dessert", "cookie", 2600, 1400),
            ("Круассан-бокс", "Круассаны с начинками", "bakery", "croissant", 3800, 2100),
        ],
    },
    {
        "name": "Sweet Corner",
        "description": "Кондитерская у Зелёного базара",
        "branches": [
            ("Sweet Corner Жибек Жолы", "Улица Жибек Жолы 55, Алматы", 43.2640, 76.9480, 9, 21),
        ],
        "products": [
            ("Медовик", "Медовый торт по домашнему рецепту", "dessert", "honey", 4200, 2300),
            ("Тирамису", "Тирамису в контейнере 400 г", "dessert", "tiramisu", 3600, 2000),
            ("Сладкий бокс", "Ассорти десертов с витрины", "dessert", "macaron", 5500, 2900),
        ],
    },
    {
        "name": "Городская Пекарня",
        "description": "Хлеб, булки и выпечка на каждый день",
        "branches": [
            ("Городская Пекарня Гагарина", "Проспект Гагарина 236, Алматы", 43.2270, 76.8930, 7, 21),
            ("Городская Пекарня Момышулы", "Улица Момышулы 18, Алматы", 43.2130, 76.8330, 8, 20),
        ],
        "products": [
            ("Батон-сет", "Три батона вечерней выпечки", "bakery", "bread", 1800, 900),
            ("Булочки с корицей", "Шесть булочек с корицей", "bakery", "cookie", 2400, 1300),
            ("Пирожки 8 шт", "Пирожки с картошкой и капустой", "bakery", "sandwich", 2000, 1100),
        ],
    },
    {
        "name": "Mystery Box Almaty",
        "description": "Сюрприз-боксы из непроданного за день",
        "branches": [
            ("Mystery Box Толе би", "Улица Толе би 187, Алматы", 43.2530, 76.9330, 12, 22),
        ],
        "products": [
            ("Mystery Box S", "Небольшой сюрприз-бокс", "mystery", "mystery", 3000, 1500),
            ("Mystery Box M", "Средний сюрприз-бокс", "mystery", "mystery", 5000, 2500),
            ("Mystery Box L", "Большой сюрприз-бокс на компанию", "mystery", "mystery", 8000, 3900),
        ],
    },
    {
        "name": "Дом Выпечки",
        "description": "Семейная пекарня, работает с 2011 года",
        "branches": [
            ("Дом Выпечки Назарбаева", "Проспект Назарбаева 223, Алматы", 43.2480, 76.9540, 8, 20),
        ],
        "products": [
            ("Самса 6 шт", "Самса с говядиной из тандыра", "meal", "sandwich", 2700, 1500),
            ("Слоёный бокс", "Слойки с разными начинками", "bakery", "croissant", 3100, 1700),
            ("Торт дня", "Целый торт с витрины", "dessert", "honey", 6000, 3200),
        ],
    },
]


CUSTOMERS = [
    ("Айгерим Абдрахманова", "aigerim.a@saveat.kz", "+77011234501"),
    ("Данияр Сериков", "daniyar.s@saveat.kz", "+77011234502"),
    ("Асель Жумабаева", "assel.zh@saveat.kz", "+77011234503"),
    ("Тимур Байжанов", "timur.b@saveat.kz", "+77011234504"),
    ("Камила Ахметова", "kamila.a@saveat.kz", "+77011234505"),
    ("Ерлан Токтаров", "erlan.t@saveat.kz", "+77011234506"),
    ("Динара Смагулова", "dinara.s@saveat.kz", "+77011234507"),
    ("Нурлан Ибраев", "nurlan.i@saveat.kz", "+77011234508"),
    ("Жанна Оспанова", "zhanna.o@saveat.kz", "+77011234509"),
    ("Санжар Калиев", "sanzhar.k@saveat.kz", "+77011234510"),
]

STAFF_ROLES = ["owner", "manager", "staff"]


def money(value):
    return Decimal(str(value))


def pickup_window(day_offset, start_hour, end_hour):
    """Окно выдачи относительно сегодняшнего дня по Алматы."""
    base = datetime.now(ALMATY).replace(
        minute=0,
        second=0,
        microsecond=0,
    ) + timedelta(days=day_offset)

    return base.replace(hour=start_hour), base.replace(hour=end_hour)


def pickup_code():
    return f"SVT-{uuid.uuid4().hex[:10].upper()}"


def seed():
    db: Session = SessionLocal()

    created = {
        "businesses": 0,
        "branches": 0,
        "products": 0,
        "offers": 0,
        "users": 0,
        "members": 0,
        "orders": 0,
        "order_items": 0,
        "favorites": 0,
    }

    try:
        # ---- что уже лежит в базе ------------------------------
        existing_businesses = set(
            db.execute(select(Business.name)).scalars().all()
        )

        existing_emails = {
            email.lower()
            for email in db.execute(select(User.email)).scalars().all()
            if email
        }

        existing_phones = {
            phone
            for phone in db.execute(select(User.phone)).scalars().all()
            if phone
        }

        new_objects = []

        # Хешируем пароль один раз: argon2 намеренно медленный, и
        # три десятка отдельных вызовов — это секунды на ровном месте.
        demo_hash = hash_password(DEMO_PASSWORD)

        # ---- покупатели ----------------------------------------
        customers = []

        for full_name, email, phone in CUSTOMERS:
            if email.lower() in existing_emails or phone in existing_phones:
                continue

            user = User(
                id=uuid.uuid4(),
                full_name=full_name,
                email=email,
                phone=phone,
                password_hash=demo_hash,
                created_at=datetime.now(ALMATY) - timedelta(
                    days=rng.randint(10, 120)
                ),
            )

            customers.append(user)
            new_objects.append(user)
            created["users"] += 1

        # Если покупателей создал прошлый прогон — подтянем их,
        # иначе заказы и избранное некому раздать.
        if not customers:
            customers = list(
                db.execute(
                    select(User).where(
                        User.email.in_([c[1] for c in CUSTOMERS])
                    )
                ).scalars().all()
            )

        # ---- заведения -----------------------------------------
        sellable_offers = []
        context_by_offer = {}

        for index, item in enumerate(BUSINESSES):
            if item["name"] in existing_businesses:
                continue

            business = Business(
                id=uuid.uuid4(),
                name=item["name"],
                description=item["description"],
                status="active",
            )

            new_objects.append(business)
            created["businesses"] += 1

            # ---- сотрудники ------------------------------------
            for role_index, role in enumerate(STAFF_ROLES):
                email = f"biz{index + 1}.{role}@saveat.kz"
                phone = f"+7702{index + 1:02d}{role_index}0000"

                if email in existing_emails or phone in existing_phones:
                    continue

                staff_user = User(
                    id=uuid.uuid4(),
                    full_name=f"{item['name']} — {role}",
                    email=email,
                    phone=phone,
                    password_hash=demo_hash,
                )

                new_objects.append(staff_user)
                created["users"] += 1

                new_objects.append(
                    BusinessMember(
                        id=uuid.uuid4(),
                        business_id=business.id,
                        user_id=staff_user.id,
                        role=role,
                        status="active",
                    )
                )
                created["members"] += 1

            # ---- товары ----------------------------------------
            products = []

            for name, description, category, image_key, base, _sale in item["products"]:
                product = Product(
                    id=uuid.uuid4(),
                    business_id=business.id,
                    name=name,
                    description=description,
                    category=category,
                    image_url=img(image_key),
                    base_price=money(base),
                    is_active=True,
                )

                products.append(product)
                new_objects.append(product)
                created["products"] += 1

            # ---- точки и офферы --------------------------------
            for b_i, branch_row in enumerate(item["branches"]):
                b_name, address, lat, lon, open_h, close_h = branch_row

                branch = Branch(
                    id=uuid.uuid4(),
                    business_id=business.id,
                    name=b_name,
                    address=address,
                    latitude=lat,
                    longitude=lon,
                    opening_time=time(hour=open_h),
                    closing_time=time(hour=close_h),
                )

                new_objects.append(branch)
                created["branches"] += 1

                for p_i, product in enumerate(products):
                    base = item["products"][p_i][4]
                    sale = item["products"][p_i][5]

                    # Раскладываем офферы по состояниям, чтобы на фронте
                    # было видно и активные, и распроданные, и снятые,
                    # и просроченные.
                    slot = (b_i * len(products) + p_i) % 6

                    if slot == 4:
                        status, day, total, left = "sold_out", 0, 5, 0
                    elif slot == 5:
                        status, day, total, left = "paused", 1, 4, 4
                    elif slot == 3:
                        # Просроченный: окно выдачи было вчера.
                        status, day, total, left = "active", -1, 6, 2
                    else:
                        status = "active"
                        day = 0 if datetime.now(ALMATY).hour < 17 else 1
                        total = rng.randint(3, 8)
                        left = rng.randint(1, total)

                    start, end = pickup_window(
                        day,
                        rng.choice([17, 18, 19]),
                        rng.choice([21, 22]),
                    )

                    discount = round((1 - sale / base) * 100)

                    offer = Offer(
                        id=uuid.uuid4(),
                        branch_id=branch.id,
                        product_id=product.id,
                        type="product",
                        title=f"{product.name} -{discount}%",
                        description=product.description,
                        original_price=money(base),
                        sale_price=money(sale),
                        quantity_total=total,
                        quantity_remaining=left,
                        pickup_start=start,
                        pickup_end=end,
                        status=status,
                    )

                    new_objects.append(offer)
                    created["offers"] += 1

                    context_by_offer[offer.id] = (business, branch, product)

                    # В заказы и избранное берём только то, что
                    # реально можно было купить.
                    if status == "active" and day >= 0:
                        sellable_offers.append(offer)

        # ---- заказы --------------------------------------------
        if customers and sellable_offers:
            # Заказы раздаём только тем, у кого их ещё нет, чтобы
            # повторный запуск не наращивал историю.
            users_with_orders = set(
                db.execute(
                    select(Order.user_id).where(
                        Order.user_id.in_([u.id for u in customers])
                    )
                ).scalars().all()
            )

            for user in customers:
                if user.id in users_with_orders:
                    continue

                for _ in range(rng.randint(1, 4)):
                    picked = rng.sample(
                        sellable_offers,
                        rng.randint(1, min(3, len(sellable_offers))),
                    )

                    # Заказ хранит снимок ровно одного заведения,
                    # поэтому оставляем позиции только одной точки.
                    head_business, head_branch, _ = context_by_offer[picked[0].id]

                    picked = [
                        offer
                        for offer in picked
                        if context_by_offer[offer.id][1].id == head_branch.id
                    ]

                    status = rng.choices(
                        ["reserved", "picked_up", "cancelled"],
                        weights=[3, 5, 2],
                    )[0]

                    created_at = datetime.now(ALMATY) - timedelta(
                        days=rng.randint(0, 30),
                        hours=rng.randint(0, 20),
                    )

                    order = Order(
                        id=uuid.uuid4(),
                        user_id=user.id,
                        branch_id=head_branch.id,
                        business_name=head_business.name,
                        branch_name=head_branch.name,
                        address=head_branch.address,
                        pickup_start=picked[0].pickup_start,
                        pickup_end=picked[0].pickup_end,
                        total_price=money(0),
                        payment_method=rng.choice(["pay_on_pickup", "card"]),
                        status=status,
                        pickup_code=pickup_code(),
                        created_at=created_at,
                        picked_up_at=(
                            created_at + timedelta(hours=rng.randint(2, 30))
                            if status == "picked_up"
                            else None
                        ),
                    )

                    total_price = Decimal("0")

                    for offer in picked:
                        product = context_by_offer[offer.id][2]
                        quantity = rng.randint(1, 2)
                        line_total = offer.sale_price * quantity
                        total_price += line_total

                        new_objects.append(
                            OrderItem(
                                id=uuid.uuid4(),
                                order_id=order.id,
                                offer_id=offer.id,
                                offer_title=offer.title,
                                product_name=product.name,
                                product_image_url=product.image_url,
                                quantity=quantity,
                                unit_price=offer.sale_price,
                                total_price=line_total,
                            )
                        )
                        created["order_items"] += 1

                    order.total_price = total_price

                    new_objects.append(order)
                    created["orders"] += 1

        # ---- избранное -----------------------------------------
        if customers and sellable_offers:
            existing_favorites = {
                tuple(row)
                for row in db.execute(
                    select(Favorite.user_id, Favorite.offer_id).where(
                        Favorite.user_id.in_([u.id for u in customers])
                    )
                ).all()
            }

            for user in customers:
                picks = rng.sample(
                    sellable_offers,
                    min(rng.randint(2, 5), len(sellable_offers)),
                )

                for offer in picks:
                    if (user.id, offer.id) in existing_favorites:
                        continue

                    new_objects.append(
                        Favorite(
                            id=uuid.uuid4(),
                            user_id=user.id,
                            offer_id=offer.id,
                        )
                    )
                    created["favorites"] += 1

        if not new_objects:
            print("Всё уже засеяно — новых записей нет.")
            return

        # Один commit на весь набор: до Supabase ~300 мс на round-trip,
        # построчные флаши растянули бы сид на минуты.
        db.add_all(new_objects)
        db.commit()

        print("\nSAVEAT: база наполнена\n")

        for key, value in created.items():
            print(f"  {key:12} +{value}")

        print(f"\nПароль всех демо-аккаунтов: {DEMO_PASSWORD}")
        print("Покупатели: aigerim.a@saveat.kz … sanzhar.k@saveat.kz")
        print("Бизнес:     biz1.owner@saveat.kz … biz8.staff@saveat.kz")

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    seed()
