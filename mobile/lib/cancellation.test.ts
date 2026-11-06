import assert from "node:assert/strict";
import test from "node:test";
import { canCancelOrder } from "./cancellation.ts";

test("cancellation ends exactly at pickup start and respects order status", () => {
  const start = Date.parse("2026-11-07T12:00:00+05:00");
  const order = { status: "reserved", pickup_start: "2026-11-07T07:00:00Z" };
  assert.equal(canCancelOrder(order, start - 1), true);
  assert.equal(canCancelOrder(order, start), false);
  assert.equal(canCancelOrder(order, start + 1), false);
  for (const status of ["paid", "ready", "picked_up", "cancelled"]) {
    assert.equal(canCancelOrder({ ...order, status }, start - 1), false);
  }
  assert.equal(canCancelOrder({ ...order, pickup_start: null }, start - 1), false);
  assert.equal(canCancelOrder({ ...order, pickup_start: "bad-date" }, start - 1), false);
});
