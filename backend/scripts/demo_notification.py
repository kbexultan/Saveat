"""
Ручная проверка уведомлений.

Два режима:

  # 1. Прислать уведомление конкретному аккаунту прямо сейчас
  uv run python -m scripts.demo_notification --to biz1.owner@saveat.kz

  # 2. Полный цикл по заказу: создание -> выдача -> отмена
  uv run python -m scripts.demo_notification --flow

Первый режим — самый быстрый способ увидеть колокольчик, тост и push.
Второй проверяет то же самое, но через настоящие события заказа.
"""

import argparse
import sys
import time
import uuid

from sqlalchemy import select

from app.database import SessionLocal
from app.models.user import User
from app.notifications import (
    ORDER_CREATED,
    create_notification,
)


def send_direct(email: str) -> int:
    db = SessionLocal()

    try:
        user = db.execute(
            select(User).where(
                User.email == email.strip().lower()
            )
        ).scalar_one_or_none()

        if user is None:
            print(f"Пользователь {email} не найден.")
            print()
            print("Доступные демо-аккаунты:")

            for row in db.execute(
                select(User.email)
                .where(User.email.like("%@saveat.kz"))
                .order_by(User.email)
                .limit(20)
            ).scalars():
                print(f"  {row}")

            return 1

        stamp = time.strftime("%H:%M:%S")

        create_notification(
            db,
            user_id=user.id,
            type=ORDER_CREATED,
            title="Проверка уведомлений",
            body=(
                f"Тестовое уведомление, отправлено в {stamp}. "
                "Если вы это видите — колокольчик работает."
            ),
            order_id=None,
        )

        db.commit()

        print(f"Отправлено: {user.full_name} <{user.email}>")
        print()
        print("Что должно произойти на открытой странице:")
        print("  1. В течение 30 секунд загорится бейдж на колокольчике")
        print("  2. Всплывёт тост с текстом уведомления")
        print("  3. Если включён push — придёт системное уведомление")
        print()
        print("Не хотите ждать 30 секунд — переключитесь на другую")
        print("вкладку и обратно: возврат обновляет список сразу.")

        return 0

    finally:
        db.close()


def run_flow() -> int:
    import json
    import urllib.error
    import urllib.request

    API = "http://127.0.0.1:8001"

    def call(method, path, body=None, token=None):
        data = (
            json.dumps(body).encode()
            if body is not None
            else None
        )

        request = urllib.request.Request(
            API + path,
            data=data,
            method=method,
        )

        request.add_header(
            "Content-Type", "application/json"
        )

        if token:
            request.add_header(
                "Authorization", f"Bearer {token}"
            )

        try:
            with urllib.request.urlopen(
                request, timeout=60
            ) as response:
                raw = response.read().decode()

                return response.status, (
                    json.loads(raw) if raw else None
                )
        except urllib.error.HTTPError as error:
            return error.code, error.read().decode()[:200]
        except urllib.error.URLError:
            return 0, None

    buyer_email = "aigerim.a@saveat.kz"

    status, result = call(
        "POST",
        "/auth/login",
        {"email": buyer_email, "password": "Demo12345!"},
    )

    if status == 0:
        print("Backend не отвечает на 127.0.0.1:8001.")
        print("Запустите его: uv run uvicorn app.main:app --reload --port 8001")
        return 1

    if status != 200:
        print(f"Не удалось войти как {buyer_email}: {status}")
        return 1

    buyer = result["access_token"]

    status, offers = call("GET", "/offers/public")

    if not offers:
        print("Нет активных предложений — нечего заказывать.")
        return 1

    offer = offers[0]

    # Ищем владельца того заведения, которому уйдёт уведомление.
    owner_token = None
    owner_email = None

    for index in range(1, 9):
        email = f"biz{index}.owner@saveat.kz"

        status, result = call(
            "POST",
            "/auth/login",
            {"email": email, "password": "Demo12345!"},
        )

        if status != 200:
            continue

        token = result["access_token"]

        status, me = call(
            "GET", "/business-auth/me", token=token
        )

        if status != 200:
            continue

        for membership in (me or {}).get("memberships", []):
            if (
                membership["business"]["id"]
                == offer["business_id"]
            ):
                owner_token = token
                owner_email = email
                break

        if owner_token:
            break

    if not owner_token:
        print("Не нашёл владельца для этого заведения.")
        return 1

    print(f"Заведение:  {offer['business_name']}")
    print(f"Владелец:   {owner_email}")
    print(f"Покупатель: {buyer_email}")
    print("Пароль у обоих: Demo12345!")
    print()
    input("Войдите как ВЛАДЕЛЕЦ и нажмите Enter...")

    status, order = call(
        "POST",
        "/orders/checkout",
        {
            "items": [
                {"offer_id": offer["id"], "quantity": 1}
            ]
        },
        token=buyer,
    )

    if status != 201:
        print(f"Не удалось создать заказ: {status} {order}")
        return 1

    print()
    print(f"Заказ создан, код выдачи {order['pickup_code']}")
    print(">>> Смотрите колокольчик владельца: «Новый заказ»")
    print()
    input("Теперь войдите как ПОКУПАТЕЛЬ и нажмите Enter...")

    status, business_me = call(
        "GET", "/business-auth/me", token=owner_token
    )

    business_id = offer["business_id"]

    status, _ = call(
        "POST",
        f"/business-orders/{business_id}"
        f"/pickup/{order['pickup_code']}/confirm",
        token=owner_token,
    )

    if status != 200:
        print(f"Не удалось выдать заказ: {status}")
        return 1

    print()
    print(">>> Смотрите колокольчик покупателя: «Заказ выдан»")
    print()
    print(f"Тестовый заказ: {order['id']}")
    print("Он останется в истории как выданный — это нормально.")

    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Проверка уведомлений SAVEAT",
    )

    parser.add_argument(
        "--to",
        help="email аккаунта, которому прислать уведомление",
    )

    parser.add_argument(
        "--flow",
        action="store_true",
        help="полный цикл через настоящий заказ",
    )

    args = parser.parse_args()

    if args.flow:
        return run_flow()

    if args.to:
        return send_direct(args.to)

    parser.print_help()

    return 0


if __name__ == "__main__":
    sys.exit(main())
