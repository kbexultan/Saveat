# Acceptance check log — ST4 (US5) and ST8 (US3)

**Verification date:** 2026-11-01 (Asia/Almaty, UTC+5). All runs listed
here were executed on this date.
**Source of criteria:** IT_PM_A6_A7_Saveat_Report.docx, Section 3.
**Database:** isolated Docker PostgreSQL 17 (`docker-compose.test.yml`,
`127.0.0.1:54329/saveat_test`). Production Supabase was not used.

| Task | Owner | Original estimate |
| --- | --- | --- |
| ST4 — US5: Concurrent reservation safety | Aktolkyn | 1.5 h |
| ST8 — US3: Booking confirmation and order history | Aktolkyn | 1.5 h |

Actual hours are not recorded here.

## Acceptance criteria

**US5-AC1:** If an offer has exactly one item and two customers attempt to
book it simultaneously, only one booking must be created. The second
customer must receive an unavailable-product error.

**US5-AC2:** The remaining quantity must never become negative and must
match both the application and database.

**US3-AC1:** After booking, the confirmation must contain the order code,
pickup time and bakery address.

**US3-AC2:** After booking, the quantity must decrease and the order must
appear in the customer's order list with the status "booked". The backend
status is `reserved`, shown on the web as «Забронирован».

## Results

| Task | Criterion | Test / Evidence | Expected Result | Actual Result | Status | Verification Date |
|---|---|---|---|---|---|---|
| ST4 | US5-AC1 | **API:** `test_acceptance_us3_us5.py::test_us5_ac1_one_booking_for_last_item`, `test_concurrent_reservation.py::test_two_customers_race_for_last_item`, `::test_many_customers_race_for_limited_stock`, `::test_race_is_detected_when_row_lock_is_missing` (negative control). **Web:** `tests/browser/run_acceptance.mjs` checks US5-AC1 (×7); screenshot `us5-01-sold-out-error-in-cart.png`; unit test `frontend/lib/checkoutErrors.test.ts` | Simultaneous requests for the last item: one 201, one unavailable-product error. One order in the DB. The web shows a Russian unavailable message. | The requests overlapped (one waited on the other's row lock). Results: 201 + 409 `"Last croissant is unavailable"`, one order in the DB. With 10 customers and 3 items: 3×201, 7×409. Web: customer B saw «К сожалению, товар закончился. Обновите корзину и попробуйте снова.» No English text was shown, the item stayed in the cart, and a double click sent 1 request. | **PASS** | 2026-11-01 |
| ST4 | US5-AC2 | **API:** `test_acceptance_us3_us5.py::test_us5_ac2_quantity_zero_and_consistent_after_race`, `::test_us5_ac2_quantity_consistent_after_partial_booking`, `::test_us5_ac2_quantity_cannot_go_negative_on_over_request`. **Web:** `run_acceptance.mjs` checks US5-AC2 (×3); screenshots `us5-01-…`, `us5-02-storefront-after-sold-out.png` | Quantity is 0 after the race and never negative. The app shows the same number as the DB. | DB: `quantity_remaining = 0`, status `sold_out`, `min(quantity_remaining) = 0`. Bakery cabinet `GET /offers/{id}` = 0. The storefront no longer lists the item. Partial booking: 5 → 3 in the DB, on the storefront and in the cabinet. Over-request: 409, stock stays 1. Web cart after the conflict shows «Нет в наличии» (fixed on this date, see below). | **PASS** | 2026-11-01 |
| ST8 | US3-AC1 | **API:** `test_acceptance_us3_us5.py::test_us3_ac1_confirmation_has_code_pickup_time_and_address`, `test_order_access.py::test_owner_sees_full_confirmation`. **Web:** `run_acceptance.mjs` checks US3-AC1 (×4); screenshot `us3-03-confirmation-page.png` | The confirmation contains the order code, pickup time and bakery address. | API returns `pickup_code` `SVT-` + 10 characters, `pickup_start`/`pickup_end` equal to the offer window, address `Test street 1, Almaty`. The web confirmation page displayed `SVT-2C7C376FDE`, «1 ноября, 06:08–09:08», «Test street 1, Almaty», «Saveat Test Bakery». | **PASS** | 2026-11-01 |
| ST8 | US3-AC2 | **API:** `test_acceptance_us3_us5.py::test_us3_ac2_quantity_decreases_and_order_listed_as_reserved`, `test_order_access.py::test_history_lists_only_own_orders_newest_first`. **Web:** `run_acceptance.mjs` checks US3-AC2 (×4); screenshots `us3-01-…`, `us3-04-…`, `us3-05-order-history.png`; unit test `frontend/lib/orders.test.ts` (status label) | Quantity decreases by the booked amount. The order is in this customer's history with status «Забронирован». | Booking 2 of 3 left 1 in the DB. The storefront changed from «Осталось 3 шт.» to «Осталось 1 шт.». API history contains the order with status `reserved`; the other customer's history is empty. The web history showed `SVT-2C7C376FDE` and «Забронирован». | **PASS** | 2026-11-01 |

Evidence directory: `backend/tests/acceptance-evidence/2026-11-01/`
(`browser-results.json` has 18 checks, 18 passed).

## Commands executed on 2026-11-01

```bash
docker compose -f docker-compose.test.yml up -d --wait

cd backend
uv run pytest                     # 49 passed
uv run pytest -v tests/test_acceptance_us3_us5.py tests/test_concurrent_reservation.py   # 11 passed

cd ../frontend
npm test                          # 27 passed
npx tsc --noEmit                  # 0 errors
npm run lint                      # 0 errors, 7 warnings (existing <img> usage)
npm run build                     # succeeded

cd ../mobile
npm test                          # 13 passed
npx tsc --noEmit                  # 0 errors
npx expo lint                     # clean
```

Browser checks (headless Google Chrome via the DevTools Protocol, with a
throwaway profile):

```bash
cd backend && uv run python -m tests.serve                              # guarded API on :8011
cd frontend && NEXT_PUBLIC_API_URL=http://127.0.0.1:8011 npx next dev -p 3001
node backend/tests/browser/run_acceptance.mjs <repo> backend/tests/acceptance-evidence/2026-11-01
# 18 checks, 18 passed
```

The first browser attempt failed for an unrelated reason: a dev server
left over from an earlier session was still holding port 3001. After that
server was stopped, the browser suite ran four times. The first two runs
had 17 checks (before the cart-stock check was added) and the last two had
18. Every run passed all of its checks. The committed evidence comes from
the last run, made with the committed script.

## Problem found and fixed during verification

**US5-AC2, web cart showed stale stock.** After the sold-out error, the
cart still said «Осталось: 1 шт.» while the database held 0. The cart
keeps a copy of the offer from when the item was added. Fix: after a
409/404 checkout response, the cart reloads stock from `GET /offers/public`
(`frontend/lib/cartAvailability.ts`, `CartProvider.syncAvailability`). A
sold-out item is shown as «Нет в наличии». Items are not removed from the
cart. Covered by `frontend/lib/cartAvailability.test.ts` and the browser
check «cart shows the live stock after the conflict».

## Scope notes

- **Simultaneous booking.** The simultaneous part of US5-AC1 is proven at
  the API level, where the test confirms that the two requests overlapped
  on the row lock. In the browser check, customer A books through the API
  just before customer B presses the button. That check verifies what the
  losing customer sees; it does not re-create the race in two browsers.
- **Mobile app.** The mobile UI was **NOT EXECUTED** (no device or
  emulator was used). The mobile checkout uses the same error mapping,
  covered by `mobile/lib/checkoutErrors.test.ts`. The mobile cart does not
  have the stock refresh described above.
- **Definition of Done.** The Definition of Done text was not available
  for this check, so this log records acceptance criteria only.
