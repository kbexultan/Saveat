import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  describeCancelError,
  describeOrderListError,
  describeOrderLoadError,
  formatOrderNumber,
  formatPickupDateWindow,
  getOrderStatusLabel,
  getPaymentMethodLabel,
  getTotalQuantity,
} from "./orders.ts";

describe("status labels", () => {
  test("every backend status has a Russian label", () => {
    assert.equal(getOrderStatusLabel("reserved"), "Забронирован");
    assert.equal(getOrderStatusLabel("paid"), "Оплачен");
    assert.equal(getOrderStatusLabel("ready"), "Готов к выдаче");
    assert.equal(getOrderStatusLabel("picked_up"), "Получен");
    assert.equal(getOrderStatusLabel("cancelled"), "Отменён");
  });

  test("unknown status does not show the raw English value", () => {
    assert.equal(getOrderStatusLabel("on_hold"), "Статус уточняется");
  });

  test("payment method", () => {
    assert.equal(getPaymentMethodLabel("pay_on_pickup"), "При получении");
    assert.equal(getPaymentMethodLabel("card"), "Другой способ");
  });
});

describe("formatting", () => {
  test("pickup window includes the date in Almaty time", () => {
    // 13:00–16:00 UTC is 18:00–21:00 in Almaty (UTC+5).
    assert.equal(
      formatPickupDateWindow(
        "2026-11-01T13:00:00Z",
        "2026-11-01T16:00:00Z",
      ),
      "1 ноября, 18:00–21:00",
    );
  });

  test("window crossing midnight names both days", () => {
    assert.equal(
      formatPickupDateWindow(
        "2026-11-01T17:00:00Z",
        "2026-11-01T20:00:00Z",
      ),
      "1 ноября, 22:00 – 2 ноября, 01:00",
    );
  });

  test("order number", () => {
    assert.equal(
      formatOrderNumber("5a7ea700-0000-4000-8000-0000000000f1"),
      "5A7EA700",
    );
  });

  test("total quantity", () => {
    assert.equal(
      getTotalQuantity({
        items: [
          { quantity: 2 },
          { quantity: 3 },
        ] as never,
      }),
      5,
    );
  });
});

describe("error messages", () => {
  test("another customer's order", () => {
    assert.match(describeOrderLoadError(403), /другого аккаунта/);
  });

  test("missing, malformed and legacy orders", () => {
    assert.match(describeOrderLoadError(404), /не найден/);
    assert.match(describeOrderLoadError(422), /не найден/);
    assert.match(describeOrderLoadError(409), /старом формате/);
  });

  test("server errors", () => {
    assert.match(describeOrderLoadError(500), /временно недоступен/);
    assert.match(describeOrderListError(503), /временно недоступен/);
    assert.equal(describeOrderListError(400), "Не удалось загрузить заказы.");
  });

  test("cancel conflicts are translated", () => {
    assert.equal(
      describeCancelError(409, "Order is already cancelled"),
      "Заказ уже отменён.",
    );
    assert.equal(
      describeCancelError(409, "Picked up order cannot be cancelled"),
      "Заказ уже получен, его нельзя отменить.",
    );
    assert.equal(
      describeCancelError(409, "Order cannot be cancelled"),
      "Этот заказ уже нельзя отменить.",
    );
    assert.equal(
      describeCancelError(403, "You do not have access to this order"),
      "Можно отменить только свой заказ.",
    );
  });
});
