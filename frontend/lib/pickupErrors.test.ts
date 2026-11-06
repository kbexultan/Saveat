import assert from "node:assert/strict";
import { test } from "node:test";
import { pickupErrorMessage } from "./pickupErrors.ts";

test("pickup conflict is explained in Russian", () => {
  assert.match(pickupErrorMessage("Order has already been picked up"), /уже выдан/);
  assert.match(pickupErrorMessage("Cancelled order cannot be picked up"), /Отменённый/);
});
test("internal failures are never exposed", () => {
  assert.doesNotMatch(pickupErrorMessage("psycopg: password=secret"), /secret|psycopg/);
});
