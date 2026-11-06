import assert from "node:assert/strict";
import { test } from "node:test";
import { applyLiveAvailability, canCheckout, maxQuantityFor } from "./cartAvailability.ts";
import { checkoutAttempt } from "./checkoutAttempt.ts";

const offer = { id: "one", status: "active", quantity_remaining: 3, pickup_end: "2099-01-01T00:00:00Z", sale_price: "500" };
const cart = [{ offer, quantity: 2 }];

test("last item reserved by A: B retains row, sees zero and cannot checkout", () => {
  const updated = applyLiveAvailability(cart, []);
  assert.equal(updated.length, 1);
  assert.equal(updated[0].offer.quantity_remaining, 0);
  assert.equal(updated[0].quantity, 2);
  assert.equal(canCheckout(updated), false);
  assert.equal(cart[0].offer.quantity_remaining, 3);
});

for (const status of ["sold_out", "paused", "removed"]) {
  test(`${status} cannot be reserved even with stale positive stock`, () => {
    const updated = applyLiveAvailability(cart, [{ ...offer, status }]);
    assert.equal(updated[0].offer.quantity_remaining, 0);
    assert.equal(canCheckout(updated), false);
  });
}

test("expired and negative stock never look available", () => {
  assert.equal(maxQuantityFor({ ...offer, pickup_end: "2000-01-01" }), 0);
  assert.equal(maxQuantityFor({ ...offer, quantity_remaining: -3 }), 0);
});
test("fresh prices and quantity limits replace snapshots", () => {
  const updated = applyLiveAvailability(cart, [{ ...offer, quantity_remaining: 1, sale_price: "400" }]);
  assert.equal(updated[0].quantity, 1);
  assert.equal(updated[0].offer.sale_price, "400");
  assert.equal(canCheckout(updated), true);
});
test("identical refresh retains state identity", () => {
  assert.equal(applyLiveAvailability(cart, [{ ...offer }]), cart);
});
test("stock above the per-order limit stays accurate while quantity is capped at 20", () => {
  const updated = applyLiveAvailability([{ offer, quantity: 20 }], [{ ...offer, quantity_remaining: 30 }]);
  assert.equal(updated[0].offer.quantity_remaining, 30);
  assert.equal(updated[0].quantity, 20);
  assert.equal(maxQuantityFor(updated[0].offer), 20);
});
test("checkout retries reuse the key across navigation; edits and account switches replace it", () => {
  const items = [{ offer_id: "one", quantity: 1 }];
  const attempt = checkoutAttempt(null, "A", items, () => "first");
  assert.equal(checkoutAttempt(attempt, "A", items, () => "second").key, "first");
  assert.equal(checkoutAttempt(attempt, "B", items, () => "second").key, "second");
  assert.equal(checkoutAttempt(attempt, "A", [{ offer_id: "one", quantity: 2 }], () => "third").key, "third");
});
