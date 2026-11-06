import assert from "node:assert/strict";
import { test } from "node:test";
import { checkoutAttempt } from "./checkoutAttempt.ts";

test("checkout retry retains its persisted key regardless of item ordering", () => {
  const items = [{ offer_id: "one", quantity: 1 }, { offer_id: "two", quantity: 2 }];
  const first = checkoutAttempt(null, "A", items, () => "original");
  const stored = JSON.parse(JSON.stringify(first));
  assert.equal(checkoutAttempt(stored, "A", [...items].reverse(), () => "new").key, "original");
});
test("cart edits and account changes create a separate checkout attempt", () => {
  const items = [{ offer_id: "one", quantity: 1 }];
  const first = checkoutAttempt(null, "A", items, () => "original");
  assert.equal(checkoutAttempt(first, "B", items, () => "account-B").key, "account-B");
  assert.equal(checkoutAttempt(first, "A", [{ offer_id: "one", quantity: 2 }], () => "changed").key, "changed");
});
