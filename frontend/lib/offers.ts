/**
 * Форматирование предложений, общее для каталога и карты.
 *
 * Цены приходят из API строками ("2400.00"), а время выдачи — в UTC,
 * поэтому обе величины нельзя показывать как есть: цену надо привести
 * к числу, а время — к часовому поясу Алматы, иначе у пользователя
 * окно выдачи уедет на несколько часов.
 */

const ALMATY_TIME_ZONE = "Asia/Almaty";

export function formatPrice(value: string | number) {
  return `${Number(value).toLocaleString("ru-RU")} ₸`;
}

export function formatPickupTime(date: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: ALMATY_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function formatPickupWindow(
  start: string,
  end: string,
) {
  return `${formatPickupTime(start)}–${formatPickupTime(end)}`;
}

export function calculateDiscount(
  originalPrice: number,
  salePrice: number,
) {
  if (originalPrice <= 0) {
    return 0;
  }

  return Math.round(
    ((originalPrice - salePrice) / originalPrice) * 100,
  );
}
