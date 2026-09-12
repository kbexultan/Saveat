import { ALMATY_TIME_ZONE } from "@/constants/theme";
import type { Money, OfferStatus, OrderStatus } from "@/types/api";

/** Numeric из Postgres приходит строкой — приводим к числу один раз. */
export function toNumber(value: Money | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }

  const parsed = typeof value === "number" ? value : Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatPrice(value: Money | null | undefined): string {
  return `${toNumber(value).toLocaleString("ru-RU")} ₸`;
}

export function calculateDiscount(
  originalPrice: Money,
  salePrice: Money,
): number {
  const original = toNumber(originalPrice);
  const sale = toNumber(salePrice);

  if (original <= 0 || sale <= 0 || sale >= original) {
    return 0;
  }

  return Math.round(((original - sale) / original) * 100);
}

export function formatTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: ALMATY_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: ALMATY_TIME_ZONE,
    day: "2-digit",
    month: "long",
  }).format(date);
}

export function formatDateTime(value: string): string {
  return `${formatDate(value)}, ${formatTime(value)}`;
}

export function formatPickupWindow(
  start: string,
  end: string,
): string {
  return `${formatTime(start)}–${formatTime(end)}`;
}

/** "09:00:00" → "09:00". Backend отдаёт time как HH:MM:SS. */
export function formatClockTime(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const [hours, minutes] = value.split(":");

  if (!hours || !minutes) {
    return value;
  }

  return `${hours}:${minutes}`;
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  reserved: "Забронирован",
  paid: "Оплачен",
  ready: "Готов к выдаче",
  picked_up: "Получен",
  cancelled: "Отменён",
};

export function orderStatusLabel(status: OrderStatus | string): string {
  return ORDER_STATUS_LABELS[status] ?? status;
}

const OFFER_STATUS_LABELS: Record<string, string> = {
  active: "Активно",
  paused: "Отключено",
  sold_out: "Распродано",
};

export function offerStatusLabel(status: OfferStatus | string): string {
  return OFFER_STATUS_LABELS[status] ?? status;
}

const BUSINESS_ROLE_LABELS: Record<string, string> = {
  owner: "Владелец",
  manager: "Менеджер",
  staff: "Сотрудник",
};

export function businessRoleLabel(role: string): string {
  return BUSINESS_ROLE_LABELS[role] ?? role;
}

export function paymentMethodLabel(method: string): string {
  if (method === "pay_on_pickup") {
    return "Оплата при получении";
  }

  return method;
}

/** Эмодзи-заглушка, когда у товара нет фото. Совпадает с вебом. */
export function categoryEmoji(category: string | null): string {
  const value = category?.toLowerCase() ?? "";

  if (value.includes("dessert") || value.includes("десерт")) {
    return "🍰";
  }

  if (value.includes("bakery") || value.includes("выпеч")) {
    return "🥐";
  }

  if (value.includes("coffee") || value.includes("кофе")) {
    return "☕";
  }

  if (value.includes("mystery")) {
    return "🎁";
  }

  return "🍴";
}

/** "SVT-A1B2C3D4E5" — нормализация введённого вручную кода. */
export function normalizePickupCode(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export function pluralizeItems(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return `${count} позиция`;
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} позиции`;
  }

  return `${count} позиций`;
}
