"""
Persistent demo environment: three bakeries with staff and offers that
never drop off the storefront.

    uv run python -m scripts.demo_env seed     # create what is missing
    uv run python -m scripts.demo_env check    # verify links, stock, images
    uv run python -m scripts.demo_env renew    # roll demo pickup windows now
    uv run python -m scripts.demo_env reset    # restore the initial state

How it stays stable:

- Every row has a fixed UUID derived from a readable key (uuid5), so
  `seed` only inserts rows that are missing. Running it again creates no
  duplicates and never overwrites stock, statuses or orders made while
  testing.
- Demo offers carry offers.is_demo = true. app.demo_offers moves their
  pickup window forward by whole days (the API does it every 5 minutes
  when DEMO_OFFERS_AUTO_RENEW=true), so nobody has to re-run anything.
- `reset` is the only command that changes existing demo rows. It is run
  by hand, touches nothing but the fixed demo IDs, and cancels (does not
  delete) open orders at demo branches before restoring stock.

Accounts log in through the regular /auth and /business-auth endpoints.
Their password comes from DEMO_ACCOUNT_PASSWORD in the git-ignored
backend/.env and is never stored in the repository.

The commands refuse to write to a non-local database unless
--allow-remote-database is passed; see DEMO_ENVIRONMENT.md.
"""

import argparse
import sys
import uuid
from dataclasses import dataclass, field
from datetime import datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.demo_offers import renew_demo_offers
from app.models.branch import Branch
from app.models.business import Business
from app.models.business_member import BusinessMember
from app.models.offer import Offer
from app.models.order import Order
from app.models.product import Product
from app.models.user import User


ALMATY = ZoneInfo("Asia/Almaty")

# All demo IDs are uuid5(DEMO_NAMESPACE, key). Changing the namespace would
# orphan every existing demo row, so it is fixed forever.
DEMO_NAMESPACE = uuid.UUID("5a7ea7de-3d00-4c00-8000-000000000000")

EMAIL_DOMAIN = "demo.saveat.kz"

# Orders in these states still hold stock; reset cancels them.
OPEN_ORDER_STATUSES = ("reserved", "ready", "paid")


def demo_id(key: str) -> uuid.UUID:
    return uuid.uuid5(DEMO_NAMESPACE, key)


def image(photo_id: str) -> str:
    # Each photo id below was checked to return 200 and to show the item.
    return (
        f"https://images.unsplash.com/photo-{photo_id}"
        "?auto=format&fit=crop&w=900&q=80"
    )


# --------------------------------------------------------------
# Pickup windows (local Almaty time)
# --------------------------------------------------------------
#
# "day" offers are open from the morning, so a fresh booking can be
# handed out right away. "evening" offers open at 18:00: until then the
# customer can still cancel (cancellation closes at pickup start).

SLOTS = {
    "day": (time(9, 0), time(22, 0)),
    "evening": (time(18, 0), time(22, 0)),
}

RENEW_LEAD = timedelta(minutes=10)


def initial_window(slot: str, now: datetime) -> tuple[datetime, datetime]:
    """Today's window for the slot, or the next day's if today's is over."""
    start_time, end_time = SLOTS[slot]
    day = now.astimezone(ALMATY).date()

    while True:
        start = datetime.combine(day, start_time, ALMATY)
        end = datetime.combine(day, end_time, ALMATY)

        if end > now + RENEW_LEAD:
            return start, end

        day += timedelta(days=1)


# --------------------------------------------------------------
# Data
# --------------------------------------------------------------


@dataclass(frozen=True)
class DemoUser:
    key: str
    full_name: str
    phone: str

    @property
    def email(self) -> str:
        return f"{self.key}@{EMAIL_DOMAIN}"

    @property
    def id(self) -> uuid.UUID:
        return demo_id(f"user:{self.key}")


@dataclass(frozen=True)
class DemoOffer:
    key: str
    name: str
    description: str
    category: str
    photo: str
    original_price: int
    sale_price: int
    quantity: int
    slot: str
    branch: int = 0


@dataclass(frozen=True)
class DemoBranch:
    name: str
    address: str
    latitude: float
    longitude: float
    opening: time
    closing: time


@dataclass(frozen=True)
class DemoBusiness:
    key: str
    name: str
    description: str
    logo_photo: str
    branches: list[DemoBranch]
    # role -> users; roles follow app.business_access.BUSINESS_ROLES
    owner: DemoUser
    manager: DemoUser
    staff: list[DemoUser]
    offers: list[DemoOffer]

    @property
    def id(self) -> uuid.UUID:
        return demo_id(f"business:{self.key}")

    def branch_id(self, index: int) -> uuid.UUID:
        return demo_id(f"branch:{self.key}:{index}")

    def product_id(self, offer: DemoOffer) -> uuid.UUID:
        return demo_id(f"product:{self.key}:{offer.key}")

    def offer_id(self, offer: DemoOffer) -> uuid.UUID:
        return demo_id(f"offer:{self.key}:{offer.key}")

    def members(self) -> list[tuple[DemoUser, str]]:
        return [
            (self.owner, "owner"),
            (self.manager, "manager"),
            *((user, "staff") for user in self.staff),
        ]


CUSTOMERS = [
    DemoUser("customer1", "Алия Нурланова", "+77009900001"),
    DemoUser("customer2", "Ержан Касымов", "+77009900002"),
    DemoUser("customer3", "Мадина Сейтова", "+77009900003"),
]


BUSINESSES = [
    DemoBusiness(
        key="sweet",
        name="Sweet Bakery",
        description=(
            "Кондитерская на Достыке: торты целиком и кусочками, "
            "пирожные, макаронс и десерты дня"
        ),
        logo_photo="1621303837174-89787a7d4729",
        branches=[
            DemoBranch(
                "Sweet Bakery Достык",
                "Проспект Достык 91, Алматы",
                43.2381, 76.9572, time(9, 0), time(22, 0),
            ),
        ],
        owner=DemoUser("sweet.owner", "Сауле Ахметова", "+77009900101"),
        manager=DemoUser("sweet.manager", "Дарья Ким", "+77009900102"),
        staff=[
            DemoUser("sweet.staff1", "Арман Жумабеков", "+77009900103"),
            DemoUser("sweet.staff2", "Камила Есенова", "+77009900104"),
        ],
        offers=[
            DemoOffer("berry-cake", "Ягодный торт", "Бисквит со сливочным кремом и свежими ягодами, 1,2 кг", "dessert", "1535141192574-5d4897c12636", 12900, 6900, 3, "evening"),
            DemoOffer("chocolate-cake", "Шоколадный торт", "Тёмный шоколад, ганаш и шоколадный бисквит, 1 кг", "dessert", "1578985545062-69928b1d9587", 11500, 6200, 3, "day"),
            DemoOffer("blueberry-cheesecake", "Чизкейк с черникой", "Кусочек классического чизкейка с черничным топпингом", "dessert", "1533134242443-d4fd215305ad", 2200, 1100, 12, "day"),
            DemoOffer("raspberry-slice", "Бисквит с малиной", "Кусочек воздушного бисквита с малиной и сливками", "dessert", "1565958011703-44f9829ba187", 1900, 990, 10, "evening"),
            DemoOffer("tiramisu", "Тирамису", "Маскарпоне, савоярди и эспрессо, порция 200 г", "dessert", "1571877227200-a0d98ea607e9", 2400, 1300, 8, "day"),
            DemoOffer("medovik", "Медовик", "Кусочек медового торта со сметанным кремом", "dessert", "1571115177098-24ec42ed204d", 1800, 900, 14, "evening"),
            DemoOffer("macarons", "Макаронс, 12 шт", "Ассорти миндальных пирожных: фисташка, малина, ваниль", "dessert", "1569864358642-9d1684040f43", 6000, 3200, 6, "day"),
            DemoOffer("chocolate-cupcakes", "Шоколадные капкейки, 4 шт", "Шоколадный бисквит и крем с карамелью", "dessert", "1550617931-e17a7b70dce2", 3600, 1800, 7, "evening"),
            DemoOffer("brownie", "Брауни, 3 шт", "Влажные брауни на бельгийском шоколаде", "dessert", "1606313564200-e75d5e30476c", 2700, 1400, 9, "day"),
            DemoOffer("blackberry-cake", "Торт «Ежевика»", "Ванильный бисквит, крем-чиз и ежевика, 1 кг", "dessert", "1559620192-032c4bc4674e", 10900, 5900, 2, "evening"),
            DemoOffer("caramel-mousse", "Муссовый торт «Карамель»", "Солёная карамель и сливочный мусс, 0,9 кг", "dessert", "1542826438-bd32f43d626f", 9800, 4900, 3, "day"),
            DemoOffer("meringue-tart", "Лимонный тарт с меренгой", "Песочная основа, лимонный курд и итальянская меренга", "dessert", "1519915028121-7d3463d20b13", 5400, 2700, 4, "evening"),
        ],
    ),
    DemoBusiness(
        key="crust",
        name="Golden Crust",
        description=(
            "Французская пекарня: круассаны на сливочном масле, багеты "
            "и хлеб на закваске из печи каждое утро"
        ),
        logo_photo="1517433670267-08bbd4be890f",
        branches=[
            DemoBranch(
                "Golden Crust Кабанбай батыра",
                "Улица Кабанбай батыра 83, Алматы",
                43.2468, 76.9446, time(8, 0), time(22, 0),
            ),
            DemoBranch(
                "Golden Crust Абая",
                "Проспект Абая 44, Алматы",
                43.2405, 76.9286, time(8, 0), time(21, 0),
            ),
        ],
        owner=DemoUser("crust.owner", "Тимур Абенов", "+77009900201"),
        manager=DemoUser("crust.manager", "Ольга Лим", "+77009900202"),
        staff=[
            DemoUser("crust.staff1", "Нурсултан Бекжанов", "+77009900203"),
            DemoUser("crust.staff2", "Айша Мукашева", "+77009900204"),
        ],
        offers=[
            DemoOffer("croissants", "Круассаны, 4 шт", "Классические круассаны на сливочном масле", "bakery", "1555507036-ab1f4038808a", 2800, 1400, 10, "day"),
            DemoOffer("almond-croissants", "Миндальные круассаны, 3 шт", "С миндальным кремом и лепестками миндаля", "bakery", "1623334044303-241021148842", 3300, 1700, 6, "evening"),
            DemoOffer("pain-au-chocolat", "Пан-о-шоколя, 4 шт", "Слоёное тесто с двумя палочками тёмного шоколада", "bakery", "1483695028939-5bb13f8648b0", 3200, 1600, 8, "day"),
            DemoOffer("baguettes", "Багеты, 2 шт", "Хрустящий французский багет на пулише", "bakery", "1568471173242-461f0a730452", 1600, 800, 12, "evening"),
            DemoOffer("rye-bread", "Ржаной хлеб с семечками", "Ржано-пшеничный хлеб с подсолнечником и льном", "bakery", "1509440159596-0249088772ff", 1400, 700, 10, "day"),
            DemoOffer("sourdough", "Хлеб на закваске", "Пшеничный хлеб на живой закваске, 48 часов брожения", "bakery", "1586444248902-2f64eddc13df", 1800, 950, 8, "evening"),
            DemoOffer("ciabatta", "Чиабатта", "Итальянская чиабатта с оливковым маслом", "bakery", "1597604391235-a7429b4b350c", 1200, 600, 9, "day", branch=1),
            DemoOffer("sliced-loaf", "Нарезной батон", "Мягкий пшеничный хлеб, нарезан", "bakery", "1549931319-a545dcf3bc73", 900, 450, 15, "evening", branch=1),
            DemoOffer("toast-bread", "Тостовый хлеб", "Молочный хлеб для тостов и сэндвичей", "bakery", "1598373182133-52452f7691ef", 1300, 650, 10, "day", branch=1),
            DemoOffer("brioche", "Бриошь", "Сдобная бриошь на сливочном масле и яйцах", "bakery", "1620921568790-c1cf8984624c", 2100, 1100, 6, "evening", branch=1),
            DemoOffer("pastry-mix", "Ассорти выпечки дня", "Шесть позиций с вечерней витрины: хлеб, слойки, булочки", "bakery", "1608198093002-ad4e005484ec", 4500, 1900, 5, "day", branch=1),
        ],
    ),
    DemoBusiness(
        key="korica",
        name="Корица",
        description=(
            "Пекарня-кондитерская в Самале: синнабоны, пончики, "
            "печенье и домашние пироги"
        ),
        logo_photo="1587241321921-91a834d6d191",
        branches=[
            DemoBranch(
                "Корица Самал",
                "Микрорайон Самал-2, 58, Алматы",
                43.2335, 76.9555, time(8, 30), time(22, 0),
            ),
        ],
        owner=DemoUser("korica.owner", "Гульнара Садыкова", "+77009900301"),
        manager=DemoUser("korica.manager", "Руслан Омаров", "+77009900302"),
        staff=[
            DemoUser("korica.staff1", "Диана Алиева", "+77009900303"),
            DemoUser("korica.staff2", "Бауыржан Тлеуов", "+77009900304"),
        ],
        offers=[
            DemoOffer("cinnamon-rolls", "Синнабоны, 4 шт", "Булочки с корицей и сливочной глазурью", "bakery", "1509365465985-25d11c17e812", 3600, 1800, 10, "day"),
            DemoOffer("glazed-donuts", "Пончики в глазури, 4 шт", "Пончики с шоколадной глазурью и посыпкой", "dessert", "1551024601-bec78aea704b", 2800, 1400, 8, "evening"),
            DemoOffer("donut-box", "Донат-бокс, 6 шт", "Ассорти пончиков: клубника, ваниль, шоколад", "dessert", "1514517521153-1be72277b32f", 4200, 2100, 5, "day"),
            DemoOffer("mini-donuts", "Мини-пончики, 10 шт", "Маленькие пончики с сахарной пудрой", "dessert", "1612240498936-65f5101365d2", 2000, 1000, 9, "evening"),
            DemoOffer("chocolate-cookies", "Печенье с шоколадом, 6 шт", "Американское печенье с кусочками шоколада", "dessert", "1558961363-fa8fdf82db35", 2100, 1000, 12, "day"),
            DemoOffer("double-cookies", "Двойное шоколадное печенье, 4 шт", "Мягкая серединка и хрустящий край", "dessert", "1499636136210-6f4ee915583e", 2000, 1000, 10, "evening"),
            DemoOffer("cherry-pie", "Пирог с вишней", "Песочный пирог с вишней и решёткой, 800 г", "bakery", "1464305795204-6f5bbfc7fb81", 5200, 2600, 4, "day"),
            DemoOffer("pancakes", "Панкейки с карамелью", "Пять панкейков, карамель и орехи, порция", "meal", "1509482560494-4126f8225994", 2600, 1400, 6, "evening"),
            DemoOffer("club-sandwich", "Сэндвич на гриле", "Тостовый хлеб, курица, сыр и соус, 2 шт", "meal", "1528735602780-2552fd46c7af", 2400, 1200, 7, "day"),
            DemoOffer("oreo-cupcakes", "Капкейки «Орео», 4 шт", "Шоколадные капкейки со сливочным кремом и печеньем", "dessert", "1612203985729-70726954388c", 3400, 1700, 6, "evening"),
            DemoOffer("surprise-box", "Сюрприз-бокс выпечки", "Что осталось на витрине к вечеру: 5–7 позиций", "mystery", "1568254183919-78a4f43a2877", 5000, 1990, 5, "day"),
        ],
    ),
]


def all_users() -> list[DemoUser]:
    users = list(CUSTOMERS)

    for business in BUSINESSES:
        users.extend(user for user, _ in business.members())

    return users


# --------------------------------------------------------------
# Seed (insert-only)
# --------------------------------------------------------------


@dataclass
class Report:
    created: dict[str, int] = field(default_factory=dict)
    skipped_phones: list[str] = field(default_factory=list)
    renewed_offers: int = 0
    cancelled_orders: int = 0

    def add(self, kind: str) -> None:
        self.created[kind] = self.created.get(kind, 0) + 1


class DemoSeedError(RuntimeError):
    pass


def _db_now(db: Session) -> datetime:
    return db.execute(select(func.now())).scalar_one()


def _check_email_conflicts(db: Session) -> None:
    """A demo e-mail registered by someone else must not be taken over."""
    users = all_users()
    rows = db.execute(
        select(User.id, User.email).where(
            func.lower(User.email).in_([user.email for user in users])
        )
    ).all()

    expected = {user.email: user.id for user in users}
    conflicts = [
        email for user_id, email in rows
        if expected[email.lower()] != user_id
    ]

    if conflicts:
        raise DemoSeedError(
            "These demo e-mails belong to other accounts: "
            + ", ".join(sorted(conflicts))
            + ". Nothing was written."
        )


def _new_user(db: Session, user: DemoUser, password_hash: str, report: Report) -> User:
    phone_taken = db.execute(
        select(User.id).where(User.phone == user.phone)
    ).first()

    if phone_taken:
        report.skipped_phones.append(user.phone)

    return User(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        phone=None if phone_taken else user.phone,
        password_hash=password_hash,
    )


def _offer_row(business: DemoBusiness, offer: DemoOffer, now: datetime) -> Offer:
    start, end = initial_window(offer.slot, now)

    return Offer(
        id=business.offer_id(offer),
        branch_id=business.branch_id(offer.branch),
        product_id=business.product_id(offer),
        type="product",
        title=offer.name,
        description=offer.description,
        original_price=Decimal(offer.original_price),
        sale_price=Decimal(offer.sale_price),
        quantity_total=offer.quantity,
        quantity_remaining=offer.quantity,
        pickup_start=start,
        pickup_end=end,
        status="active",
        is_demo=True,
    )


def seed_demo_environment(db: Session, *, password_hash: str) -> Report:
    """
    Inserts every demo row that does not exist yet and commits.

    Existing rows are left exactly as they are: repeated runs neither
    duplicate data nor undo bookings made while testing.
    """
    report = Report()
    _check_email_conflicts(db)
    now = _db_now(db)

    def missing(model, row_id) -> bool:
        return db.get(model, row_id) is None

    for user in all_users():
        if missing(User, user.id):
            db.add(_new_user(db, user, password_hash, report))
            report.add("users")

    db.flush()

    for business in BUSINESSES:
        if missing(Business, business.id):
            db.add(
                Business(
                    id=business.id,
                    name=business.name,
                    description=business.description,
                    logo_url=image(business.logo_photo),
                    status="active",
                )
            )
            report.add("businesses")

        for index, branch in enumerate(business.branches):
            if missing(Branch, business.branch_id(index)):
                db.add(
                    Branch(
                        id=business.branch_id(index),
                        business_id=business.id,
                        name=branch.name,
                        address=branch.address,
                        latitude=branch.latitude,
                        longitude=branch.longitude,
                        opening_time=branch.opening,
                        closing_time=branch.closing,
                    )
                )
                report.add("branches")

        db.flush()

        for user, role in business.members():
            exists = db.execute(
                select(BusinessMember.id).where(
                    BusinessMember.business_id == business.id,
                    BusinessMember.user_id == user.id,
                )
            ).first()

            if not exists:
                db.add(
                    BusinessMember(
                        id=demo_id(f"member:{business.key}:{user.key}"),
                        business_id=business.id,
                        user_id=user.id,
                        role=role,
                        status="active",
                    )
                )
                report.add("memberships")

        for offer in business.offers:
            if missing(Product, business.product_id(offer)):
                db.add(
                    Product(
                        id=business.product_id(offer),
                        business_id=business.id,
                        name=offer.name,
                        description=offer.description,
                        category=offer.category,
                        image_url=image(offer.photo),
                        base_price=Decimal(offer.original_price),
                        is_active=True,
                    )
                )
                report.add("products")

        db.flush()

        for offer in business.offers:
            if missing(Offer, business.offer_id(offer)):
                db.add(_offer_row(business, offer, now))
                report.add("offers")

    db.flush()

    # Demo offers that already existed may have expired while the API was
    # not running; bring them back in the same transaction.
    report.renewed_offers = renew_demo_offers(db)

    db.commit()
    return report


# --------------------------------------------------------------
# Reset (manual only)
# --------------------------------------------------------------


def demo_branch_ids() -> list[uuid.UUID]:
    return [
        business.branch_id(index)
        for business in BUSINESSES
        for index in range(len(business.branches))
    ]


def demo_offer_ids() -> list[uuid.UUID]:
    return [
        business.offer_id(offer)
        for business in BUSINESSES
        for offer in business.offers
    ]


def reset_demo_environment(db: Session, *, password_hash: str) -> Report:
    """
    Restores the initial demo state. Only rows with the fixed demo IDs are
    changed; open orders at demo branches are cancelled, never deleted.
    """
    _check_email_conflicts(db)
    now = _db_now(db)

    # Lock the demo offers first, in a fixed order, like checkout does.
    db.execute(
        select(Offer.id)
        .where(Offer.id.in_(demo_offer_ids()))
        .order_by(Offer.id)
        .with_for_update()
    ).all()

    cancelled = db.execute(
        update(Order)
        .where(
            Order.branch_id.in_(demo_branch_ids()),
            Order.status.in_(OPEN_ORDER_STATUSES),
        )
        .values(status="cancelled")
    ).rowcount or 0

    for user in all_users():
        row = db.get(User, user.id)
        if row is not None:
            row.full_name = user.full_name
            row.email = user.email
            row.password_hash = password_hash

    for business in BUSINESSES:
        row = db.get(Business, business.id)
        if row is not None:
            row.name = business.name
            row.description = business.description
            row.logo_url = image(business.logo_photo)
            row.status = "active"

        for user, role in business.members():
            db.execute(
                update(BusinessMember)
                .where(
                    BusinessMember.business_id == business.id,
                    BusinessMember.user_id == user.id,
                )
                .values(role=role, status="active")
            )

        for offer in business.offers:
            product = db.get(Product, business.product_id(offer))
            if product is not None:
                product.name = offer.name
                product.description = offer.description
                product.category = offer.category
                product.image_url = image(offer.photo)
                product.base_price = Decimal(offer.original_price)
                product.is_active = True

            row = db.get(Offer, business.offer_id(offer))
            if row is not None:
                fresh = _offer_row(business, offer, now)
                for column in (
                    "branch_id", "product_id", "type", "title", "description",
                    "original_price", "sale_price", "quantity_total",
                    "quantity_remaining", "pickup_start", "pickup_end",
                    "status", "is_demo",
                ):
                    setattr(row, column, getattr(fresh, column))

    db.commit()

    # Anything deleted by hand comes back.
    report = seed_demo_environment(db, password_hash=password_hash)
    report.cancelled_orders = cancelled
    return report


# --------------------------------------------------------------
# Check (read-only)
# --------------------------------------------------------------


def check_demo_environment(db: Session) -> list[str]:
    """Returns a list of problems; empty means the environment is sound."""
    problems: list[str] = []
    now = _db_now(db)

    for user in all_users():
        row = db.get(User, user.id)
        if row is None:
            problems.append(f"missing user {user.email}")

    for business in BUSINESSES:
        row = db.get(Business, business.id)
        if row is None:
            problems.append(f"missing business {business.name}")
            continue

        if row.status != "active":
            problems.append(f"{business.name}: status is {row.status}")

        same_name = db.execute(
            select(func.count(Business.id)).where(Business.name == business.name)
        ).scalar_one()
        if same_name > 1:
            problems.append(f"{business.name}: {same_name} businesses share this name")

        roles: dict[str, int] = {}
        for member in db.execute(
            select(BusinessMember).where(BusinessMember.business_id == business.id)
        ).scalars():
            if member.status == "active":
                roles[member.role] = roles.get(member.role, 0) + 1

        for role, needed in (("owner", 1), ("manager", 1), ("staff", 2)):
            if roles.get(role, 0) < needed:
                problems.append(
                    f"{business.name}: {roles.get(role, 0)} active {role}(s), expected {needed}+"
                )

        for offer in business.offers:
            offer_row = db.get(Offer, business.offer_id(offer))
            if offer_row is None:
                problems.append(f"{business.name}: missing offer {offer.name}")
                continue

            branch = db.get(Branch, offer_row.branch_id)
            if branch is None or branch.business_id != business.id:
                problems.append(f"{offer.name}: branch does not belong to {business.name}")

            product = db.get(Product, offer_row.product_id) if offer_row.product_id else None
            if product is None or product.business_id != business.id:
                problems.append(f"{offer.name}: product does not belong to {business.name}")

            if not offer_row.is_demo:
                problems.append(f"{offer.name}: is_demo is false")

            if offer_row.pickup_end <= now:
                problems.append(f"{offer.name}: pickup window has closed")

            if not (0 <= offer_row.quantity_remaining <= offer_row.quantity_total):
                problems.append(f"{offer.name}: stock out of bounds")

            if offer_row.sale_price >= offer_row.original_price:
                problems.append(f"{offer.name}: sale price is not lower than original")

    return problems


def check_images() -> list[str]:
    """HEAD-requests every demo image; network access required."""
    import urllib.request

    urls = {image(business.logo_photo) for business in BUSINESSES}
    urls |= {image(offer.photo) for business in BUSINESSES for offer in business.offers}

    problems = []
    for url in sorted(urls):
        request = urllib.request.Request(url, method="HEAD")
        try:
            with urllib.request.urlopen(request, timeout=15) as response:
                if response.status != 200:
                    problems.append(f"{response.status} {url}")
        except Exception as error:  # noqa: BLE001 - report every failure
            problems.append(f"{error} {url}")

    return problems


# --------------------------------------------------------------
# CLI
# --------------------------------------------------------------

LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1"}


def _require_local_database(allow_remote: bool) -> None:
    from app.database import engine

    host = engine.url.host or ""

    if host in LOCAL_HOSTS or allow_remote:
        return

    sys.exit(
        f"Refusing to write demo data to {host}.\n"
        "The demo environment belongs in its own database "
        "(see DEMO_ENVIRONMENT.md). Pass --allow-remote-database only "
        "for a dedicated staging/demo database, never for production."
    )


def _password_hash() -> str:
    from app.config import settings
    from app.security import hash_password

    password = settings.demo_account_password

    if not password or len(password) < 8:
        sys.exit(
            "Set DEMO_ACCOUNT_PASSWORD (8+ characters) in backend/.env "
            "or in the environment. It is not stored in the repository."
        )

    return hash_password(password)


def _print_report(title: str, report: Report) -> None:
    print(f"\nSAVEAT demo: {title}")
    if report.created:
        for kind, count in report.created.items():
            print(f"  + {count} {kind}")
    else:
        print("  nothing to create, everything is in place")
    if report.renewed_offers:
        print(f"  renewed {report.renewed_offers} demo offers")
    if report.cancelled_orders:
        print(f"  cancelled {report.cancelled_orders} open orders at demo branches")
    if report.skipped_phones:
        print(f"  phones already used by other accounts, left empty: {', '.join(report.skipped_phones)}")


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="python -m scripts.demo_env")
    parser.add_argument("command", choices=["seed", "reset", "renew", "check"])
    parser.add_argument(
        "--allow-remote-database",
        action="store_true",
        help="write to a non-local database (a dedicated demo/staging one only)",
    )
    parser.add_argument(
        "--images",
        action="store_true",
        help="check: also request every demo image over the network",
    )
    args = parser.parse_args(argv)

    from app.database import SessionLocal

    if args.command != "check":
        _require_local_database(args.allow_remote_database)

    db = SessionLocal()

    try:
        if args.command == "seed":
            _print_report("seed", seed_demo_environment(db, password_hash=_password_hash()))
        elif args.command == "reset":
            _print_report("reset", reset_demo_environment(db, password_hash=_password_hash()))
        elif args.command == "renew":
            renewed = renew_demo_offers(db)
            db.commit()
            print(f"Renewed {renewed} demo offers")
        else:
            problems = check_demo_environment(db)
            if args.images:
                problems += check_images()
            if problems:
                print("Problems found:")
                for problem in problems:
                    print(f"  - {problem}")
                sys.exit(1)
            offers = sum(len(business.offers) for business in BUSINESSES)
            print(
                f"Demo environment OK: {len(BUSINESSES)} businesses, "
                f"{offers} offers, {len(all_users())} accounts"
            )
    except DemoSeedError as error:
        db.rollback()
        sys.exit(str(error))
    finally:
        db.close()


if __name__ == "__main__":
    main()
