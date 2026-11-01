/**
 * Refreshes the stock numbers stored with cart items (US5-AC2).
 *
 * The cart keeps a copy of each offer from the moment it was added. After
 * a checkout conflict that copy is stale: the cart said "Осталось: 1 шт."
 * while the database already held 0. `liveOffers` is the current
 * storefront (GET /offers/public). An offer missing from it is sold out,
 * expired or paused, so it is shown with 0 left.
 *
 * Quantities in the cart are not changed: the customer decides what to
 * remove or reduce.
 *
 * This module has no imports so that `node --test` can load it directly.
 */

type StockItem = {
  offer: {
    id: string;
    quantity_remaining: number;
  };
};

type LiveOffer = {
  id: string;
  quantity_remaining: number;
};

export function applyLiveAvailability<T extends StockItem>(
  items: T[],
  liveOffers: LiveOffer[],
): T[] {
  const remaining = new Map(
    liveOffers.map((offer) => [offer.id, offer.quantity_remaining]),
  );

  return items.map((item) => ({
    ...item,
    offer: {
      ...item.offer,
      quantity_remaining: remaining.get(item.offer.id) ?? 0,
    },
  }));
}
