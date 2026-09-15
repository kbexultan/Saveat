"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useAuth } from "@/components/AuthProvider";
import type { Offer } from "@/components/OfferCard";
import { describeApiError } from "@/lib/apiErrors";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8001";

const LOAD_ERROR = "Не удалось загрузить избранное. Попробуйте ещё раз.";
const UPDATE_ERROR = "Не удалось обновить избранное. Попробуйте ещё раз.";
const SESSION_ERROR = "Сессия завершилась. Войдите снова.";

type FavoritesState = {
  ownerId: string | null;
  favoriteIds: Set<string>;
  favoriteOffers: Offer[];
  pendingIds: Set<string>;
  loading: boolean;
  error: string | null;
};

type FavoritesContextType = {
  favoriteIds: ReadonlySet<string>;
  favoriteOffers: Offer[];
  pendingIds: ReadonlySet<string>;
  loading: boolean;
  error: string | null;
  isFavorite: (offerId: string) => boolean;
  toggleFavorite: (offer: Offer) => Promise<boolean>;
  refreshFavorites: () => Promise<void>;
};

const EMPTY_IDS = new Set<string>();
const EMPTY_OFFERS: Offer[] = [];

const FavoritesContext = createContext<FavoritesContextType | null>(null);

function emptyState(): FavoritesState {
  return {
    ownerId: null,
    favoriteIds: new Set(),
    favoriteOffers: [],
    pendingIds: new Set(),
    loading: false,
    error: null,
  };
}

async function responseError(response: Response, fallback: string) {
  try {
    const data: { detail?: unknown } = await response.json();
    return describeApiError(data.detail, fallback);
  } catch {
    return fallback;
  }
}

function parseOffers(value: unknown): Offer[] {
  if (
    !Array.isArray(value) ||
    !value.every(
      (offer) =>
        typeof offer === "object" &&
        offer !== null &&
        "id" in offer &&
        typeof offer.id === "string",
    )
  ) {
    throw new Error(LOAD_ERROR);
  }

  return value as Offer[];
}

function parseIds(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((id) => typeof id === "string")) {
    throw new Error(LOAD_ERROR);
  }

  return value;
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading, refreshUser } = useAuth();
  const userId = user?.id ?? null;
  const requestSequence = useRef(0);
  const inFlightIds = useRef(new Set<string>());
  const [state, setState] = useState<FavoritesState>(emptyState);

  // Данные предыдущего аккаунта никогда не попадают в интерфейс нового.
  const current = state.ownerId === userId ? state : null;
  const favoriteIds = current?.favoriteIds ?? EMPTY_IDS;
  const favoriteOffers = current?.favoriteOffers ?? EMPTY_OFFERS;
  const pendingIds = current?.pendingIds ?? EMPTY_IDS;
  const loading = authLoading || Boolean(userId && (!current || current.loading));
  const error = current?.error ?? null;

  const expireSession = useCallback(async (expectedToken: string | null) => {
    // Ответ от старого запроса не должен удалить токен уже нового аккаунта.
    if (localStorage.getItem("access_token") !== expectedToken) {
      return false;
    }

    localStorage.removeItem("access_token");
    await refreshUser();

    return true;
  }, [refreshUser]);

  const refreshFavorites = useCallback(async () => {
    if (!userId) {
      return;
    }

    const token = localStorage.getItem("access_token");

    if (!token) {
      await expireSession(null);
      return;
    }

    const sequence = ++requestSequence.current;

    setState((previous) => ({
      ownerId: userId,
      favoriteIds:
        previous.ownerId === userId ? previous.favoriteIds : new Set(),
      favoriteOffers:
        previous.ownerId === userId ? previous.favoriteOffers : [],
      pendingIds:
        previous.ownerId === userId ? previous.pendingIds : new Set(),
      loading: true,
      error: null,
    }));

    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [offersResponse, idsResponse] = await Promise.all([
        fetch(`${API_URL}/favorites`, { headers }),
        fetch(`${API_URL}/favorites/ids`, { headers }),
      ]);

      if (offersResponse.status === 401 || idsResponse.status === 401) {
        if (sequence !== requestSequence.current) {
          return;
        }

        const expired = await expireSession(token);

        if (!expired) {
          setState((previous) =>
            previous.ownerId === userId
              ? { ...previous, loading: false }
              : previous,
          );
        }

        return;
      }

      if (!offersResponse.ok || !idsResponse.ok) {
        const failedResponse = !offersResponse.ok ? offersResponse : idsResponse;
        throw new Error(await responseError(failedResponse, LOAD_ERROR));
      }

      const [offersPayload, idsPayload]: [unknown, unknown] = await Promise.all([
        offersResponse.json(),
        idsResponse.json(),
      ]);

      if (sequence !== requestSequence.current) {
        return;
      }

      setState({
        ownerId: userId,
        favoriteIds: new Set(parseIds(idsPayload)),
        favoriteOffers: parseOffers(offersPayload),
        pendingIds: new Set(),
        loading: false,
        error: null,
      });
    } catch (caughtError) {
      if (sequence !== requestSequence.current) {
        return;
      }

      setState((previous) => ({
        ...previous,
        ownerId: userId,
        loading: false,
        error:
          caughtError instanceof TypeError
            ? LOAD_ERROR
            : caughtError instanceof Error
              ? caughtError.message
              : LOAD_ERROR,
      }));
    }
  }, [expireSession, userId]);

  useEffect(() => {
    requestSequence.current += 1;
    inFlightIds.current.clear();

    const timer = window.setTimeout(() => {
      if (userId) {
        void refreshFavorites();
      } else {
        setState(emptyState());
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [refreshFavorites, userId]);

  const isFavorite = useCallback(
    (offerId: string) => favoriteIds.has(offerId),
    [favoriteIds],
  );

  const toggleFavorite = useCallback(
    async (offer: Offer) => {
      if (!userId) {
        throw new Error("Войдите, чтобы сохранять предложения.");
      }

      if (!current || current.loading) {
        throw new Error("Подождите, избранное загружается.");
      }

      if (inFlightIds.current.has(offer.id)) {
        return favoriteIds.has(offer.id);
      }

      const token = localStorage.getItem("access_token");

      if (!token) {
        await expireSession(null);
        throw new Error(SESSION_ERROR);
      }

      const wasFavorite = favoriteIds.has(offer.id);
      inFlightIds.current.add(offer.id);

      setState((previous) => {
        if (previous.ownerId !== userId) {
          return previous;
        }

        const ids = new Set(previous.favoriteIds);
        const pending = new Set(previous.pendingIds);
        let offers = previous.favoriteOffers;

        pending.add(offer.id);

        if (wasFavorite) {
          ids.delete(offer.id);
          offers = offers.filter((item) => item.id !== offer.id);
        } else {
          ids.add(offer.id);
          offers = [offer, ...offers.filter((item) => item.id !== offer.id)];
        }

        return {
          ...previous,
          favoriteIds: ids,
          favoriteOffers: offers,
          pendingIds: pending,
          error: null,
        };
      });

      const rollbackOptimisticChange = () => {
        setState((previous) => {
          if (previous.ownerId !== userId) {
            return previous;
          }

          const ids = new Set(previous.favoriteIds);
          const pending = new Set(previous.pendingIds);
          let offers = previous.favoriteOffers;

          pending.delete(offer.id);

          if (wasFavorite) {
            ids.add(offer.id);
            offers = [offer, ...offers.filter((item) => item.id !== offer.id)];
          } else {
            ids.delete(offer.id);
            offers = offers.filter((item) => item.id !== offer.id);
          }

          return {
            ...previous,
            favoriteIds: ids,
            favoriteOffers: offers,
            pendingIds: pending,
          };
        });
      };

      try {
        const response = await fetch(`${API_URL}/favorites/${offer.id}`, {
          method: wasFavorite ? "DELETE" : "PUT",
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.status === 401) {
          const expired = await expireSession(token);

          if (!expired) {
            rollbackOptimisticChange();
            return wasFavorite;
          }

          throw new Error(SESSION_ERROR);
        }

        if (!response.ok) {
          throw new Error(await responseError(response, UPDATE_ERROR));
        }

        setState((previous) => {
          if (previous.ownerId !== userId) {
            return previous;
          }

          const pending = new Set(previous.pendingIds);
          pending.delete(offer.id);

          return { ...previous, pendingIds: pending };
        });

        return !wasFavorite;
      } catch (caughtError) {
        const message =
          caughtError instanceof TypeError
            ? UPDATE_ERROR
              : caughtError instanceof Error
              ? caughtError.message
              : UPDATE_ERROR;

        rollbackOptimisticChange();

        setState((previous) =>
          previous.ownerId === userId
            ? { ...previous, error: message }
            : previous,
        );

        throw new Error(message);
      } finally {
        inFlightIds.current.delete(offer.id);
      }
    },
    [current, expireSession, favoriteIds, userId],
  );

  const value = useMemo<FavoritesContextType>(
    () => ({
      favoriteIds,
      favoriteOffers,
      pendingIds,
      loading,
      error,
      isFavorite,
      toggleFavorite,
      refreshFavorites,
    }),
    [
      error,
      favoriteIds,
      favoriteOffers,
      isFavorite,
      loading,
      pendingIds,
      refreshFavorites,
      toggleFavorite,
    ],
  );

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const context = useContext(FavoritesContext);

  if (!context) {
    throw new Error("useFavorites must be used inside FavoritesProvider");
  }

  return context;
}
