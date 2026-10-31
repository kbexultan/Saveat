import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  CHECKOUT_NETWORK_ERROR_MESSAGE,
  SOLD_OUT_MESSAGE,
  describeCheckoutError,
  describeCheckoutFailure,
} from "./checkoutErrors.ts";

// Backend messages below are copied from backend/app/routers/orders.py
// and pinned by backend/tests/test_checkout.py.

describe("409 inventory conflicts", () => {
  test("sold-out offer shows the Russian sold-out message", () => {
    const error = describeCheckoutError(409, "Круассан is unavailable");

    assert.equal(error.kind, "sold_out");
    assert.equal(error.message, SOLD_OUT_MESSAGE);
    assert.equal(
      error.message,
      "К сожалению, товар закончился. Обновите корзину и попробуйте снова.",
    );
  });

  test("raw backend text never reaches the customer", () => {
    const details = [
      "Круассан is unavailable",
      "Not enough Круассан. Available: 2",
      "Круассан has expired",
      "Selected offers do not have a common pickup time",
      "This business is not accepting orders",
      "Something new the backend may say",
    ];

    for (const detail of details) {
      const { message } = describeCheckoutError(409, detail);

      assert.ok(!message.includes(detail), message);
      assert.match(message, /[а-яё]/i);
    }
  });

  test("insufficient stock names the remaining quantity", () => {
    const error = describeCheckoutError(
      409,
      "Not enough Медовик. Available: 2",
    );

    assert.equal(error.kind, "insufficient_stock");
    assert.match(error.message, /осталось только 2 шт\./);
  });

  test("insufficient stock with zero left is sold out", () => {
    const error = describeCheckoutError(
      409,
      "Not enough Медовик. Available: 0",
    );

    assert.equal(error.kind, "sold_out");
    assert.equal(error.message, SOLD_OUT_MESSAGE);
  });

  test("offer title containing the keywords is still parsed", () => {
    const error = describeCheckoutError(
      409,
      "Not enough Торт is unavailable. Available: 3",
    );

    assert.equal(error.kind, "insufficient_stock");
  });

  test("expired offer is not reported as sold out", () => {
    const error = describeCheckoutError(409, "Эклер has expired");

    assert.equal(error.kind, "expired");
    assert.notEqual(error.message, SOLD_OUT_MESSAGE);
  });

  test("other known conflicts", () => {
    assert.equal(
      describeCheckoutError(
        409,
        "Selected offers do not have a common pickup time",
      ).kind,
      "no_common_pickup",
    );
    assert.equal(
      describeCheckoutError(409, "This business is not accepting orders")
        .kind,
      "business_closed",
    );
  });

  test("unknown 409 is a generic conflict, not sold out", () => {
    const error = describeCheckoutError(409, { unexpected: true });

    assert.equal(error.kind, "conflict");
    assert.notEqual(error.message, SOLD_OUT_MESSAGE);
  });
});

describe("other statuses are not inventory conflicts", () => {
  test("server errors", () => {
    for (const status of [500, 502, 503]) {
      const error = describeCheckoutError(status, "Internal Server Error");

      assert.equal(error.kind, "server");
      assert.notEqual(error.message, SOLD_OUT_MESSAGE);
    }
  });

  test("unauthorized and forbidden", () => {
    assert.equal(describeCheckoutError(401, "Invalid token").kind, "unauthorized");
    assert.equal(describeCheckoutError(403, "Not authenticated").kind, "forbidden");
  });

  test("missing offers and cart validation", () => {
    assert.equal(
      describeCheckoutError(404, "One or more offers were not found").kind,
      "offer_not_found",
    );
    assert.equal(
      describeCheckoutError(400, "Cart must contain offers from one branch")
        .kind,
      "mixed_branches",
    );
    assert.equal(
      describeCheckoutError(400, "Maximum quantity per offer is 20").kind,
      "quantity_limit",
    );
    assert.equal(describeCheckoutError(422, []).kind, "validation");
  });
});

describe("failures without a response", () => {
  test("fetch TypeError is a network error", () => {
    const error = describeCheckoutFailure(new TypeError("Failed to fetch"));

    assert.equal(error.kind, "network");
    assert.equal(error.message, CHECKOUT_NETWORK_ERROR_MESSAGE);
  });

  test("anything else is unknown, without leaking its text", () => {
    const error = describeCheckoutFailure(new Error("Unexpected token <"));

    assert.equal(error.kind, "unknown");
    assert.ok(!error.message.includes("Unexpected token"));
  });
});
