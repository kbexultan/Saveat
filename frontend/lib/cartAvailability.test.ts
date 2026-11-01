import assert from "node:assert/strict";
import { test } from "node:test";

import { applyLiveAvailability } from "./cartAvailability.ts";

const cart = [
  { offer: { id: "croissant", title: "Круассан", quantity_remaining: 1 }, quantity: 1 },
  { offer: { id: "bread", title: "Хлеб", quantity_remaining: 5 }, quantity: 2 },
];

test("sold-out offer missing from the storefront shows 0 left", () => {
  const updated = applyLiveAvailability(cart, [
    { id: "bread", quantity_remaining: 5 },
  ]);

  assert.equal(updated[0].offer.quantity_remaining, 0);
  assert.equal(updated[1].offer.quantity_remaining, 5);
});

test("remaining stock is taken from the storefront", () => {
  const updated = applyLiveAvailability(cart, [
    { id: "croissant", quantity_remaining: 1 },
    { id: "bread", quantity_remaining: 1 },
  ]);

  assert.equal(updated[1].offer.quantity_remaining, 1);
});

test("cart quantities and other fields are kept", () => {
  const updated = applyLiveAvailability(cart, []);

  assert.deepEqual(
    updated.map((item) => [item.offer.title, item.quantity]),
    [
      ["Круассан", 1],
      ["Хлеб", 2],
    ],
  );
  // The original array is not mutated.
  assert.equal(cart[0].offer.quantity_remaining, 1);
});
