/** US8: only reserved orders strictly before pickup_start can be cancelled. */
export function canCancelOrder(order: { status: string; pickup_start: string | null }, now: number): boolean {
  return order.status === "reserved" && order.pickup_start !== null &&
    now < Date.parse(order.pickup_start);
}

export const PICKUP_STARTED_MESSAGE = "Время выдачи уже началось. Отменить заказ нельзя.";
