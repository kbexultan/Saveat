from datetime import datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.branch import Branch
from app.models.business import Business
from app.models.offer import Offer
from app.models.product import Product


ALMATY = ZoneInfo("Asia/Almaty")


DEMO_DATA = [
    {
        "business": {
            "name": "Sweet Lab",
            "description": "Кондитерская и свежие десерты",
        },
        "branch": {
            "name": "Sweet Lab Abaya",
            "address": "Проспект Абая 50, Алматы",
            "latitude": 43.2389,
            "longitude": 76.8897,
        },
        "products": [
            {
                "name": "Медовик",
                "description": "Классический медовый торт",
                "category": "dessert",
                "image_url": (
                    "https://images.unsplash.com/"
                    "photo-1578985545062-69928b1d9587"
                    "?auto=format&fit=crop&w=900&q=80"
                ),
                "original_price": 2500,
                "sale_price": 1500,
                "quantity": 4,
                "pickup_start": 19,
                "pickup_end": 21,
            },
            {
                "name": "Чизкейк",
                "description": "Нежный сливочный чизкейк",
                "category": "dessert",
                "image_url": (
                    "https://images.unsplash.com/"
                    "photo-1565958011703-44f9829ba187"
                    "?auto=format&fit=crop&w=900&q=80"
                ),
                "original_price": 3200,
                "sale_price": 1900,
                "quantity": 3,
                "pickup_start": 19,
                "pickup_end": 21,
            },
            {
                "name": "Тирамису",
                "description": "Итальянский десерт с кофе",
                "category": "dessert",
                "image_url": (
                    "https://images.unsplash.com/"
                    "photo-1571877227200-a0d98ea607e9"
                    "?auto=format&fit=crop&w=900&q=80"
                ),
                "original_price": 3000,
                "sale_price": 1800,
                "quantity": 5,
                "pickup_start": 20,
                "pickup_end": 22,
            },
        ],
    },
    {
        "business": {
            "name": "Coffee Point",
            "description": "Кофейня и свежая выпечка",
        },
        "branch": {
            "name": "Coffee Point Center",
            "address": "Улица Панфилова 101, Алматы",
            "latitude": 43.2565,
            "longitude": 76.9457,
        },
        "products": [
            {
                "name": "Croissant Box",
                "description": "Набор свежих круассанов",
                "category": "bakery",
                "image_url": (
                    "https://images.unsplash.com/"
                    "photo-1555507036-ab1f4038808a"
                    "?auto=format&fit=crop&w=900&q=80"
                ),
                "original_price": 3200,
                "sale_price": 1900,
                "quantity": 3,
                "pickup_start": 18,
                "pickup_end": 21,
            },
            {
                "name": "Cinnamon Roll",
                "description": "Булочки с корицей",
                "category": "bakery",
                "image_url": (
                    "https://images.unsplash.com/"
                    "photo-1509440159596-0249088772ff"
                    "?auto=format&fit=crop&w=900&q=80"
                ),
                "original_price": 2200,
                "sale_price": 1300,
                "quantity": 6,
                "pickup_start": 19,
                "pickup_end": 21,
            },
            {
                "name": "Cookie Box",
                "description": "Набор домашнего печенья",
                "category": "dessert",
                "image_url": (
                    "https://images.unsplash.com/"
                    "photo-1499636136210-6f4ee915583e"
                    "?auto=format&fit=crop&w=900&q=80"
                ),
                "original_price": 2800,
                "sale_price": 1600,
                "quantity": 4,
                "pickup_start": 19,
                "pickup_end": 22,
            },
        ],
    },
    {
        "business": {
            "name": "Bakery House",
            "description": "Свежий хлеб и выпечка каждый день",
        },
        "branch": {
            "name": "Bakery House Dostyk",
            "address": "Проспект Достык 89, Алматы",
            "latitude": 43.2417,
            "longitude": 76.9594,
        },
        "products": [
            {
                "name": "Bread Box",
                "description": "Набор свежего хлеба",
                "category": "bakery",
                "image_url": (
                    "https://images.unsplash.com/"
                    "photo-1509440159596-0249088772ff"
                    "?auto=format&fit=crop&w=900&q=80"
                ),
                "original_price": 2400,
                "sale_price": 1200,
                "quantity": 5,
                "pickup_start": 18,
                "pickup_end": 20,
            },
            {
                "name": "Sandwich Set",
                "description": "Набор свежих сэндвичей",
                "category": "bakery",
                "image_url": (
                    "https://images.unsplash.com/"
                    "photo-1528735602780-2552fd46c7af"
                    "?auto=format&fit=crop&w=900&q=80"
                ),
                "original_price": 3500,
                "sale_price": 2100,
                "quantity": 4,
                "pickup_start": 18,
                "pickup_end": 21,
            },
            {
                "name": "Pizza Box",
                "description": "Набор оставшихся свежих кусочков пиццы",
                "category": "bakery",
                "image_url": (
                    "https://images.unsplash.com/"
                    "photo-1579751626657-72bc17010498"
                    "?auto=format&fit=crop&w=900&q=80"
                ),
                "original_price": 4500,
                "sale_price": 2600,
                "quantity": 3,
                "pickup_start": 20,
                "pickup_end": 22,
            },
        ],
    },
    {
        "business": {
            "name": "Dessert Room",
            "description": "Десерты, капкейки и сладкие боксы",
        },
        "branch": {
            "name": "Dessert Room Mega",
            "address": "Улица Розыбакиева 247А, Алматы",
            "latitude": 43.2028,
            "longitude": 76.8925,
        },
        "products": [
            {
                "name": "Macaron Box",
                "description": "Ассорти макаронов",
                "category": "dessert",
                "image_url": (
                    "https://images.unsplash.com/"
                    "photo-1569864358642-9d1684040f43"
                    "?auto=format&fit=crop&w=900&q=80"
                ),
                "original_price": 4200,
                "sale_price": 2500,
                "quantity": 4,
                "pickup_start": 19,
                "pickup_end": 21,
            },
            {
                "name": "Cupcake Box",
                "description": "Ассорти свежих капкейков",
                "category": "dessert",
                "image_url": (
                    "https://images.unsplash.com/"
                    "photo-1486427944299-d1955d23e34d"
                    "?auto=format&fit=crop&w=900&q=80"
                ),
                "original_price": 3800,
                "sale_price": 2200,
                "quantity": 5,
                "pickup_start": 19,
                "pickup_end": 22,
            },
            {
                "name": "Mystery Sweet Box",
                "description": "Сюрприз-бокс из десертов дня",
                "category": "mystery",
                "image_url": (
                    "https://images.unsplash.com/"
                    "photo-1551024506-0bccd828d307"
                    "?auto=format&fit=crop&w=900&q=80"
                ),
                "original_price": 5000,
                "sale_price": 2800,
                "quantity": 3,
                "pickup_start": 20,
                "pickup_end": 22,
            },
        ],
    },
]


def pickup_window(
    start_hour: int,
    end_hour: int,
):
    now = datetime.now(ALMATY)

    start = now.replace(
        hour=start_hour,
        minute=0,
        second=0,
        microsecond=0,
    )

    if start <= now:
        start += timedelta(days=1)

    end = start.replace(
        hour=end_hour,
        minute=0,
        second=0,
        microsecond=0,
    )

    return start, end


def remove_old_demo_data(db: Session):
    demo_names = [
        item["business"]["name"]
        for item in DEMO_DATA
    ]

    businesses = db.execute(
        select(Business).where(
            Business.name.in_(demo_names)
        )
    ).scalars().all()

    for business in businesses:
        db.delete(business)

    db.commit()


def seed():
    db = SessionLocal()

    try:
        print("Removing old demo data...")

        remove_old_demo_data(db)

        offer_count = 0

        for item in DEMO_DATA:
            business_data = item["business"]
            branch_data = item["branch"]

            business = Business(
                name=business_data["name"],
                description=business_data["description"],
                status="active",
            )

            db.add(business)
            db.flush()

            branch = Branch(
                business_id=business.id,
                name=branch_data["name"],
                address=branch_data["address"],
                latitude=branch_data["latitude"],
                longitude=branch_data["longitude"],
            )

            db.add(branch)
            db.flush()

            for product_data in item["products"]:
                original_price = Decimal(
                    str(product_data["original_price"])
                )

                sale_price = Decimal(
                    str(product_data["sale_price"])
                )

                product = Product(
                    business_id=business.id,
                    name=product_data["name"],
                    description=product_data["description"],
                    category=product_data["category"],
                    image_url=product_data["image_url"],
                    base_price=original_price,
                    is_active=True,
                )

                db.add(product)
                db.flush()

                pickup_start, pickup_end = pickup_window(
                    product_data["pickup_start"],
                    product_data["pickup_end"],
                )

                quantity = product_data["quantity"]

                discount = round(
                    (
                        1
                        - float(
                            sale_price / original_price
                        )
                    )
                    * 100
                )

                offer = Offer(
                    branch_id=branch.id,
                    product_id=product.id,
                    type="product",
                    title=(
                        f"{product.name} -{discount}%"
                    ),
                    description=product.description,
                    original_price=original_price,
                    sale_price=sale_price,
                    quantity_total=quantity,
                    quantity_remaining=quantity,
                    pickup_start=pickup_start,
                    pickup_end=pickup_end,
                    status="active",
                )

                db.add(offer)

                offer_count += 1

        db.commit()

        print("")
        print("SAVEAT demo data created!")
        print(f"Businesses: {len(DEMO_DATA)}")
        print(f"Offers: {offer_count}")

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    seed()