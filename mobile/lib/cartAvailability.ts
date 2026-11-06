// No runtime imports: used by the app and node regression tests.
type StockOffer = {
  id: string;
  quantity_remaining: number;
  status: string;
  pickup_end: string;
};

export function availableStock(offer: StockOffer, now = Date.now()): number {
  if (offer.status !== "active" || !(Date.parse(offer.pickup_end) > now)) return 0;
  if (!Number.isFinite(offer.quantity_remaining)) return 0;
  return Math.max(0, Math.floor(offer.quantity_remaining));
}

export function maxQuantityFor(offer: StockOffer, now = Date.now()): number {
  return Math.min(20, availableStock(offer, now));
}

export function applyLiveAvailability<O extends StockOffer>(
  items: { offer: O; quantity: number }[], liveOffers: O[], now = Date.now(),
): { offer: O; quantity: number }[] {
  const byId = new Map(liveOffers.map((offer) => [offer.id, offer]));
  let changed = false;
  const next = items.map((item) => {
    const fresh = byId.get(item.offer.id);
    const snapshot = fresh ?? item.offer;
    const remaining = fresh ? availableStock(fresh, now) : 0;
    const offer = { ...snapshot, quantity_remaining: remaining,
      status: remaining > 0 ? snapshot.status : "unavailable" };
    // Keep unavailable items for the customer to remove; no zero/negative cart quantity.
    const quantity = Math.max(1, Math.min(20, Math.floor(item.quantity) || 1, remaining || 20));
    if (JSON.stringify(offer) === JSON.stringify(item.offer) && quantity === item.quantity) return item;
    changed = true;
    return { offer, quantity };
  });
  return changed ? next : items;
}

export function canCheckout(items: { offer: StockOffer; quantity: number }[], now = Date.now()): boolean {
  return items.length > 0 && items.every(({ offer, quantity }) =>
    Number.isInteger(quantity) && quantity > 0 && quantity <= maxQuantityFor(offer, now));
}
