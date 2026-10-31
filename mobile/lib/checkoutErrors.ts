/**
 * Customer-facing messages for a failed checkout (ST6).
 *
 * The backend answers checkout conflicts with English `detail` strings
 * that include the offer title ("Круассан is unavailable"). Those must
 * not reach the customer as-is. Each known backend message is mapped to
 * a Russian text; anything unrecognised gets a neutral message for its
 * status code, so a 500 is never presented as "sold out".
 *
 * The backend formats are pinned by backend/tests/test_checkout.py.
 *
 * Kept identical to frontend/lib/checkoutErrors.ts (web and mobile are
 * separate packages with no shared code). Change both together.
 *
 * This module has no imports so that `node --test` can load it directly.
 */

export type CheckoutErrorKind =
  | "sold_out"
  | "insufficient_stock"
  | "expired"
  | "no_common_pickup"
  | "business_closed"
  | "conflict"
  | "offer_not_found"
  | "mixed_branches"
  | "quantity_limit"
  | "validation"
  | "unauthorized"
  | "forbidden"
  | "server"
  | "network"
  | "unknown";

export type CheckoutError = {
  kind: CheckoutErrorKind;
  message: string;
};

export const SOLD_OUT_MESSAGE =
  "К сожалению, товар закончился. Обновите корзину и попробуйте снова.";

export const CHECKOUT_NETWORK_ERROR_MESSAGE =
  "Не удалось связаться с сервером. Проверьте подключение к интернету и попробуйте ещё раз. Корзина сохранена.";

const UNAVAILABLE = / is unavailable$/;
const EXPIRED = / has expired$/;
const NOT_ENOUGH = /^Not enough .+\. Available: (\d+)$/;

function insufficientStock(available: number): CheckoutError {
  if (available <= 0) {
    return { kind: "sold_out", message: SOLD_OUT_MESSAGE };
  }

  return {
    kind: "insufficient_stock",
    message: `К сожалению, осталось только ${available} шт. Уменьшите количество в корзине и попробуйте снова.`,
  };
}

function describeConflict(detail: unknown): CheckoutError {
  if (typeof detail === "string") {
    if (UNAVAILABLE.test(detail)) {
      return { kind: "sold_out", message: SOLD_OUT_MESSAGE };
    }

    const notEnough = NOT_ENOUGH.exec(detail);

    if (notEnough) {
      return insufficientStock(Number(notEnough[1]));
    }

    if (EXPIRED.test(detail)) {
      return {
        kind: "expired",
        message:
          "Время получения одного из товаров уже прошло. Удалите его из корзины и попробуйте снова.",
      };
    }

    if (detail === "Selected offers do not have a common pickup time") {
      return {
        kind: "no_common_pickup",
        message:
          "У товаров в корзине не совпадает время получения. Оформите их отдельными заказами.",
      };
    }

    if (detail === "This business is not accepting orders") {
      return {
        kind: "business_closed",
        message: "Заведение сейчас не принимает заказы. Попробуйте позже.",
      };
    }
  }

  return {
    kind: "conflict",
    message:
      "Товары в корзине изменились. Обновите корзину и попробуйте снова.",
  };
}

/** Maps an HTTP error response from POST /orders/checkout. */
export function describeCheckoutError(
  status: number,
  detail: unknown,
): CheckoutError {
  switch (status) {
    case 409:
      return describeConflict(detail);

    case 404:
      return {
        kind: "offer_not_found",
        message:
          "Некоторых товаров из корзины больше нет. Удалите их и попробуйте снова.",
      };

    case 400:
      if (detail === "Cart must contain offers from one branch") {
        return {
          kind: "mixed_branches",
          message:
            "В одной корзине можно заказать товары только из одного филиала.",
        };
      }

      if (detail === "Maximum quantity per offer is 20") {
        return {
          kind: "quantity_limit",
          message: "Одного товара можно заказать не больше 20 шт.",
        };
      }

      return {
        kind: "unknown",
        message: "Не удалось оформить заказ. Проверьте корзину.",
      };

    case 422:
      return {
        kind: "validation",
        message: "Не удалось оформить заказ. Проверьте корзину.",
      };

    case 401:
      return {
        kind: "unauthorized",
        message: "Сессия истекла. Войдите снова, чтобы оформить заказ.",
      };

    case 403:
      return {
        kind: "forbidden",
        message: "У вас нет доступа к оформлению этого заказа.",
      };
  }

  if (status >= 500) {
    return {
      kind: "server",
      message:
        "Сервер временно недоступен. Корзина сохранена — попробуйте чуть позже.",
    };
  }

  return {
    kind: "unknown",
    message: "Не удалось оформить заказ. Попробуйте ещё раз.",
  };
}

/** fetch() rejects with TypeError when the backend cannot be reached. */
export function describeCheckoutFailure(error: unknown): CheckoutError {
  if (error instanceof TypeError) {
    return {
      kind: "network",
      message: CHECKOUT_NETWORK_ERROR_MESSAGE,
    };
  }

  return {
    kind: "unknown",
    message: "Не удалось оформить заказ. Попробуйте ещё раз.",
  };
}
