import Constants from "expo-constants";

import { clearToken, getToken } from "@/lib/storage";
import type {
  Branch,
  BranchCreatePayload,
  BranchUpdatePayload,
  Business,
  BusinessAuthResponse,
  BusinessMeResponse,
  BusinessRegisterPayload,
  CheckoutPayload,
  LoginPayload,
  Offer,
  OfferCreatePayload,
  OfferUpdatePayload,
  Order,
  Product,
  ProductCreatePayload,
  ProductUpdatePayload,
  PublicOffer,
  RegisterPayload,
  TokenResponse,
  User,
} from "@/types/api";

/** Порт, на котором SAVEAT API поднимается локально. */
const DEFAULT_DEV_API_PORT = 8001;

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

/**
 * Адрес API берём из EXPO_PUBLIC_API_URL.
 *
 * Если переменная не задана (частый случай при первом запуске),
 * в dev-режиме подставляем хост, с которого телефон уже качает
 * бандл Metro — это тот же компьютер, где работает backend.
 * Никакого production-адреса в коде нет.
 */
function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();

  if (fromEnv) {
    return stripTrailingSlash(fromEnv);
  }

  const hostUri =
    Constants.expoConfig?.hostUri ??
    Constants.expoGoConfig?.debuggerHost ??
    null;

  const host = hostUri?.split(":")[0];

  if (host) {
    return `http://${host}:${DEFAULT_DEV_API_PORT}`;
  }

  return `http://127.0.0.1:${DEFAULT_DEV_API_PORT}`;
}

export const API_BASE_URL = resolveBaseUrl();

export const IS_API_URL_FROM_ENV = Boolean(
  process.env.EXPO_PUBLIC_API_URL?.trim(),
);

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Сеть недоступна или backend не отвечает. */
export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NetworkError";
  }
}

type UnauthorizedHandler = () => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;

/**
 * AuthProvider регистрирует сюда свой logout, чтобы любой
 * ответ 401 разлогинивал приложение из одного места.
 */
export function setUnauthorizedHandler(
  handler: UnauthorizedHandler | null,
): void {
  unauthorizedHandler = handler;
}

type ErrorDetailItem = {
  msg?: unknown;
  loc?: unknown;
};

function extractErrorMessage(payload: unknown, status: number): string {
  if (typeof payload === "string" && payload.trim()) {
    return payload.trim();
  }

  if (payload && typeof payload === "object") {
    const detail = (payload as { detail?: unknown }).detail;

    if (typeof detail === "string" && detail.trim()) {
      return detail.trim();
    }

    // Ошибка валидации Pydantic: detail — список объектов.
    if (Array.isArray(detail)) {
      const messages = detail
        .map((item: ErrorDetailItem) =>
          typeof item?.msg === "string" ? item.msg : null,
        )
        .filter((item): item is string => Boolean(item));

      if (messages.length > 0) {
        return messages.join(". ");
      }
    }
  }

  if (status >= 500) {
    return "Сервер SAVEAT временно недоступен. Попробуйте позже.";
  }

  return "Не удалось выполнить запрос. Попробуйте ещё раз.";
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /** Подставить Bearer-токен и разлогинить при 401. */
  auth?: boolean;
  signal?: AbortSignal;
};

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, auth = false, signal } = options;

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (auth) {
    const token = await getToken();

    if (!token) {
      unauthorizedHandler?.();

      throw new ApiError("Войдите в аккаунт SAVEAT.", 401);
    }

    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      signal,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw error;
    }

    throw new NetworkError(
      `Нет связи с сервером SAVEAT (${API_BASE_URL}). ` +
        "Проверьте подключение и адрес API.",
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const rawText = await response.text();

  let payload: unknown = null;

  if (rawText) {
    try {
      payload = JSON.parse(rawText);
    } catch {
      payload = rawText;
    }
  }

  if (!response.ok) {
    if (response.status === 401 && auth) {
      // Токен протух или отозван — чистим сессию.
      await clearToken();
      unauthorizedHandler?.();
    }

    throw new ApiError(
      extractErrorMessage(payload, response.status),
      response.status,
    );
  }

  return payload as T;
}

/** Человекочитаемый текст любой ошибки запроса. */
export function toErrorMessage(error: unknown): string {
  if (error instanceof ApiError || error instanceof NetworkError) {
    return error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Неизвестная ошибка. Попробуйте ещё раз.";
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

export function isForbidden(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}

export const api = {
  // --------------------------------
  // AUTH
  // --------------------------------

  auth: {
    register(payload: RegisterPayload) {
      return request<User>("/auth/register", {
        method: "POST",
        body: payload,
      });
    },

    login(payload: LoginPayload) {
      return request<TokenResponse>("/auth/login", {
        method: "POST",
        body: payload,
      });
    },

    me(signal?: AbortSignal) {
      return request<User>("/auth/me", { auth: true, signal });
    },
  },

  // --------------------------------
  // BUSINESS AUTH
  // --------------------------------

  businessAuth: {
    register(payload: BusinessRegisterPayload) {
      return request<BusinessAuthResponse>("/business-auth/register", {
        method: "POST",
        body: payload,
      });
    },

    login(payload: LoginPayload) {
      return request<BusinessAuthResponse>("/business-auth/login", {
        method: "POST",
        body: payload,
      });
    },

    me(signal?: AbortSignal) {
      return request<BusinessMeResponse>("/business-auth/me", {
        auth: true,
        signal,
      });
    },
  },

  // --------------------------------
  // ВИТРИНА
  // --------------------------------

  offers: {
    publicList(signal?: AbortSignal) {
      return request<PublicOffer[]>("/offers/public", { signal });
    },

    byBusiness(businessId: string, signal?: AbortSignal) {
      return request<Offer[]>(`/offers/business/${businessId}`, {
        auth: true,
        signal,
      });
    },

    getOne(offerId: string, signal?: AbortSignal) {
      return request<Offer>(`/offers/${offerId}`, { signal });
    },

    create(payload: OfferCreatePayload) {
      return request<Offer>("/offers", {
        method: "POST",
        auth: true,
        body: payload,
      });
    },

    update(offerId: string, payload: OfferUpdatePayload) {
      return request<Offer>(`/offers/${offerId}`, {
        method: "PATCH",
        auth: true,
        body: payload,
      });
    },
  },

  // --------------------------------
  // ЗАКАЗЫ ПОКУПАТЕЛЯ
  // --------------------------------

  orders: {
    list(signal?: AbortSignal) {
      return request<Order[]>("/orders", { auth: true, signal });
    },

    getOne(orderId: string, signal?: AbortSignal) {
      return request<Order>(`/orders/${orderId}`, { auth: true, signal });
    },

    checkout(payload: CheckoutPayload) {
      return request<Order>("/orders/checkout", {
        method: "POST",
        auth: true,
        body: payload,
      });
    },

    cancel(orderId: string) {
      return request<Order>(`/orders/${orderId}/cancel`, {
        method: "POST",
        auth: true,
      });
    },
  },

  // --------------------------------
  // КАБИНЕТ БИЗНЕСА
  // --------------------------------

  businesses: {
    getOne(businessId: string, signal?: AbortSignal) {
      return request<Business>(`/businesses/${businessId}`, { signal });
    },
  },

  branches: {
    byBusiness(businessId: string, signal?: AbortSignal) {
      return request<Branch[]>(`/branches/business/${businessId}`, {
        auth: true,
        signal,
      });
    },

    getOne(branchId: string, signal?: AbortSignal) {
      return request<Branch>(`/branches/${branchId}`, { signal });
    },

    create(payload: BranchCreatePayload) {
      return request<Branch>("/branches", {
        method: "POST",
        auth: true,
        body: payload,
      });
    },

    update(branchId: string, payload: BranchUpdatePayload) {
      return request<Branch>(`/branches/${branchId}`, {
        method: "PATCH",
        auth: true,
        body: payload,
      });
    },
  },

  products: {
    byBusiness(businessId: string, signal?: AbortSignal) {
      return request<Product[]>(`/products/business/${businessId}`, {
        auth: true,
        signal,
      });
    },

    getOne(productId: string, signal?: AbortSignal) {
      return request<Product>(`/products/${productId}`, { signal });
    },

    create(payload: ProductCreatePayload) {
      return request<Product>("/products", {
        method: "POST",
        auth: true,
        body: payload,
      });
    },

    update(productId: string, payload: ProductUpdatePayload) {
      return request<Product>(`/products/${productId}`, {
        method: "PATCH",
        auth: true,
        body: payload,
      });
    },
  },

  businessOrders: {
    list(businessId: string, signal?: AbortSignal) {
      return request<Order[]>(`/business-orders/${businessId}`, {
        auth: true,
        signal,
      });
    },

    getOne(businessId: string, orderId: string, signal?: AbortSignal) {
      return request<Order>(`/business-orders/${businessId}/${orderId}`, {
        auth: true,
        signal,
      });
    },

    findByPickupCode(
      businessId: string,
      pickupCode: string,
      signal?: AbortSignal,
    ) {
      return request<Order>(
        `/business-orders/${businessId}/pickup/${encodeURIComponent(
          pickupCode,
        )}`,
        { auth: true, signal },
      );
    },

    confirmPickup(businessId: string, pickupCode: string) {
      return request<Order>(
        `/business-orders/${businessId}/pickup/${encodeURIComponent(
          pickupCode,
        )}/confirm`,
        { method: "POST", auth: true },
      );
    },
  },
};
