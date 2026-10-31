/**
 * Shared helpers for the order confirmation and order history pages
 * (ST5, ST7).
 *
 * Both pages used to keep their own copies of the types, status labels
 * and error handling, and showed raw English `detail` strings from the
 * backend when cancelling failed.
 *
 * This module has no imports so that `node --test` can load it directly.
 */

export type OrderItem = {
  id: string;
  offer_id: string | null;

  offer_title: string;

  product_name: string | null;
  product_image_url: string | null;

  quantity: number;

  unit_price: string | number;
  total_price: string | number;
};

export type Order = {
  id: string;
  user_id: string;
  branch_id: string;

  business_name: string;
  branch_name: string;
  address: string;

  pickup_start: string;
  pickup_end: string;

  total_price: string | number;

  payment_method: string;

  status: string;
  pickup_code: string;

  created_at: string;
  picked_up_at: string | null;

  items: OrderItem[];
};

const ALMATY_TIME_ZONE = "Asia/Almaty";

// Same wording as mobile/lib/format.ts.
const ORDER_STATUS_LABELS: Record<string, string> = {
  reserved: "Забронирован",
  paid: "Оплачен",
  ready: "Готов к выдаче",
  picked_up: "Получен",
  cancelled: "Отменён",
};

export function getOrderStatusLabel(status: string): string {
  return ORDER_STATUS_LABELS[status] ?? "Статус уточняется";
}

export function getPaymentMethodLabel(method: string): string {
  if (method === "pay_on_pickup") {
    return "При получении";
  }

  return "Другой способ";
}

/** Order number shown to the customer: first 8 hex digits of the UUID. */
export function formatOrderNumber(orderId: string): string {
  return orderId.slice(0, 8).toUpperCase();
}

function formatTime(date: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: ALMATY_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function formatDay(date: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: ALMATY_TIME_ZONE,
    day: "numeric",
    month: "long",
  }).format(new Date(date));
}

/**
 * "1 ноября, 18:00–21:00". A window that crosses midnight names both
 * days: "1 ноября, 22:00 – 2 ноября, 01:00".
 */
export function formatPickupDateWindow(start: string, end: string): string {
  const startDay = formatDay(start);
  const endDay = formatDay(end);

  if (startDay === endDay) {
    return `${startDay}, ${formatTime(start)}–${formatTime(end)}`;
  }

  return `${startDay}, ${formatTime(start)} – ${endDay}, ${formatTime(end)}`;
}

export function getTotalQuantity(order: Pick<Order, "items">): number {
  return order.items.reduce((sum, item) => sum + item.quantity, 0);
}

/** GET /orders/{id} failed with this status. */
export function describeOrderLoadError(status: number): string {
  switch (status) {
    case 403:
      return "Этот заказ оформлен с другого аккаунта. Войдите в аккаунт, с которого делали заказ.";

    case 404:
    case 422:
      return "Заказ не найден. Проверьте ссылку или откройте список заказов.";

    case 409:
      return "Этот заказ сохранён в старом формате и не может быть показан.";
  }

  if (status >= 500) {
    return "Сервер временно недоступен. Попробуйте обновить страницу чуть позже.";
  }

  return "Не удалось загрузить заказ.";
}

/** GET /orders failed with this status. */
export function describeOrderListError(status: number): string {
  if (status >= 500) {
    return "Сервер временно недоступен. Попробуйте обновить страницу чуть позже.";
  }

  return "Не удалось загрузить заказы.";
}

/** POST /orders/{id}/cancel failed with this status and detail. */
export function describeCancelError(status: number, detail: unknown): string {
  if (status === 409) {
    switch (detail) {
      case "Order is already cancelled":
        return "Заказ уже отменён.";

      case "Picked up order cannot be cancelled":
        return "Заказ уже получен, его нельзя отменить.";

      default:
        return "Этот заказ уже нельзя отменить.";
    }
  }

  if (status === 403) {
    return "Можно отменить только свой заказ.";
  }

  if (status === 404) {
    return "Заказ не найден.";
  }

  if (status >= 500) {
    return "Сервер временно недоступен. Попробуйте отменить заказ чуть позже.";
  }

  return "Не удалось отменить заказ.";
}
