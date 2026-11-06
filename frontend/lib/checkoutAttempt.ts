export type CheckoutAttempt = { identity: string; key: string };

export function checkoutAttempt(
  previous: CheckoutAttempt | null,
  userId: string,
  items: { offer_id: string; quantity: number }[],
  makeKey: () => string,
): CheckoutAttempt {
  const identity = JSON.stringify([userId, [...items].sort((a, b) => a.offer_id.localeCompare(b.offer_id))]);
  return previous?.identity === identity ? previous : { identity, key: makeKey() };
}
