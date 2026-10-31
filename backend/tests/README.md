# Saveat automated tests

Backend tests run against a throwaway PostgreSQL in Docker, never against
Supabase. Web and mobile have small `node:test` suites for checkout error
messages and order helpers.

## Quick start

From the repository root:

```bash
# 1. Start the isolated test database (127.0.0.1:54329, data in tmpfs)
docker compose -f docker-compose.test.yml up -d --wait

# 2. Backend tests (migrations run automatically from an empty schema)
cd backend
uv sync
uv run pytest

# 3. Frontend and mobile unit tests
cd ../frontend && npm test
cd ../mobile && npm test

# 4. Stop and delete the test database
cd ..
docker compose -f docker-compose.test.yml down -v
```

Run only the concurrency tests:

```bash
cd backend
uv run pytest tests/test_concurrent_reservation.py -v
```

## How production is protected

`tests/safety.py` runs before any `app` module is imported:

- The test URL comes only from `SAVEAT_TEST_DATABASE_URL` and defaults to
  the Docker database above. `DATABASE_URL` from `backend/.env` is never
  used by tests.
- The host must be `localhost`, `127.0.0.1` or `::1`, and the database name
  must contain `test`. Hosts containing `supabase`, `pooler`, `amazonaws`
  and similar are rejected with a dedicated message.
- The URL must differ from the database in `backend/.env` and from any
  `DATABASE_URL` exported in the shell.
- After `app.database` is imported, `conftest.py` checks that the engine is
  bound to the approved URL and aborts otherwise.
- Web push keys are blanked, so tests cannot notify real devices.

`tests/test_db_safety.py` covers these rules.

## Migrations

The first database test drops the `public` schema of the test database and
runs `alembic upgrade head` from scratch. `tests/test_migrations.py` then
checks that the database is at head and that the models match the
migrations.

To run Alembic by hand against the test database:

```bash
cd backend
DATABASE_URL=postgresql+psycopg://saveat_test:saveat_test@127.0.0.1:54329/saveat_test \
  uv run alembic upgrade head
```

PowerShell:

```powershell
$env:DATABASE_URL = "postgresql+psycopg://saveat_test:saveat_test@127.0.0.1:54329/saveat_test"
uv run alembic upgrade head
Remove-Item Env:DATABASE_URL
```

## Test data

`tests/seed.py` builds one deterministic scenario with fixed UUIDs:

| Entity | Value |
| --- | --- |
| Bakery | Saveat Test Bakery, branch "Saveat Test Bakery — Abaya" |
| Offer | "Last croissant", 1 of 1 left, 500 ₸, pickup window now+1h to now+4h |
| Customers | `customer.a@saveat-test.example.com`, `customer.b@saveat-test.example.com` |
| Owner | `owner@saveat-test.example.com` (receives order notifications) |
| Password | `saveat-test-password` (test-only) |

Each test truncates all tables afterwards. Seeding again replaces the
scenario instead of duplicating it.

`.test` addresses can't be used: the API's email validator rejects that
TLD, so `example.com` (reserved by RFC 2606) is used instead.

## Manual QA against the test database

```bash
docker compose -f docker-compose.test.yml up -d --wait
cd backend
uv run pytest -q              # also brings the schema to head
uv run python -m tests.seed   # load the scenario
uv run python -m tests.serve  # API on http://127.0.0.1:8011 (guarded)
```

In a second terminal (port 3001 is the web origin the API allows):

```bash
cd frontend
NEXT_PUBLIC_API_URL=http://127.0.0.1:8011 npx next dev -p 3001
```

Manual checks (not automated, because the web app has no browser test
runner):

1. Sign in as customer B and add "Last croissant" to the cart.
2. In a private window, sign in as customer A and reserve the croissant.
   Expected: the confirmation page shows the order number, pickup code,
   "Saveat Test Bakery", the address, pickup date and time window,
   "Last croissant × 1" and the status "Забронирован".
3. Back as customer B, press "Подтвердить бронирование". Expected: "К
   сожалению, товар закончился. Обновите корзину и попробуйте снова.",
   the item is still in the cart, and the dev console shows the raw 409.
4. Double-click the checkout button quickly. Expected: one request in the
   Network tab.
5. As customer B open customer A's `/orders/<id>`. Expected: the message
   about the order being placed from another account, and no order data.
6. Stop the API and press checkout. Expected: the network error message,
   and the cart is kept.
7. As customer B open "Мои заказы". Expected: "Пока заказов нет". With the
   API stopped: only the error message, without the empty state.

## What each file covers

| File | Sprint task |
| --- | --- |
| `safety.py`, `test_db_safety.py`, `../../docker-compose.test.yml` | ST9 |
| `seed.py`, `conftest.py` | ST1 |
| `test_concurrent_reservation.py` | ST2, ST3 |
| `test_checkout.py` | ST3, ST4 |
| `test_order_access.py` | ST5, ST7 |
| `test_migrations.py` | ST9, ST1 |
| `frontend/lib/checkoutErrors.test.ts`, `mobile/lib/checkoutErrors.test.ts` | ST6 |
| `frontend/lib/orders.test.ts` | ST5, ST7 |

## Missing specifications

The repository has no user stories or acceptance criteria. US3 and US5 are
not written down anywhere in it: no docs folder, and nothing in either
README. The tests above pin the behaviour the code implements today. They
are not a check against the original acceptance criteria. When the US3
and US5 text from the project management documents is available, compare
it with this table and add the missing cases.
