"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8001";

export type SubscribedBusiness = {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  active_offers: number;
  subscribed_at: string;
};

type SubscriptionsContextType = {
  subscribedIds: ReadonlySet<string>;
  businesses: SubscribedBusiness[];
  pendingIds: ReadonlySet<string>;
  loading: boolean;
  isSubscribed: (businessId: string) => boolean;
  toggleSubscription: (
    businessId: string,
    businessName: string,
  ) => Promise<boolean>;
  refresh: () => Promise<void>;
};

const SubscriptionsContext = createContext<
  SubscriptionsContextType | undefined
>(undefined);

const EMPTY_IDS: ReadonlySet<string> = new Set();
const EMPTY_BUSINESSES: SubscribedBusiness[] = [];

function authHeaders() {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("access_token")
      : null;

  return token
    ? { Authorization: `Bearer ${token}` }
    : null;
}

export function SubscriptionsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { user } = useAuth();
  const toast = useToast();

  const [subscribedIds, setSubscribedIds] = useState<
    Set<string>
  >(new Set());

  const [businesses, setBusinesses] = useState<
    SubscribedBusiness[]
  >([]);

  const [pendingIds, setPendingIds] = useState<Set<string>>(
    new Set(),
  );

  const [loading, setLoading] = useState(false);

  const ownerId = useRef<string | null | undefined>(
    undefined,
  );

  /*
    Номер последнего запроса. Два запроса живут параллельно и не
    обязаны вернуться в порядке отправки: медленный ответ прошлого
    аккаунта, придя последним, положил бы его подписки в интерфейс
    нового. Тот же приём, что в FavoritesProvider.
  */
  const requestSequence = useRef(0);

  const userId = user?.id ?? null;

  const refresh = useCallback(async () => {
    const headers = authHeaders();

    if (!headers) {
      return;
    }

    const sequence = ++requestSequence.current;

    setLoading(true);

    try {
      const [listResponse, idsResponse] = await Promise.all([
        fetch(`${API_URL}/business-subscriptions`, {
          headers,
        }),
        fetch(`${API_URL}/business-subscriptions/ids`, {
          headers,
        }),
      ]);

      if (sequence !== requestSequence.current) {
        return;
      }

      if (!listResponse.ok || !idsResponse.ok) {
        return;
      }

      const list: SubscribedBusiness[] =
        await listResponse.json();

      const ids: string[] = await idsResponse.json();

      if (sequence !== requestSequence.current) {
        return;
      }

      setBusinesses(list);
      setSubscribedIds(new Set(ids));
    } catch (error) {
      console.error(
        "Failed to load subscriptions:",
        error,
      );
    } finally {
      if (sequence === requestSequence.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (ownerId.current === userId) {
      return;
    }

    ownerId.current = userId;

    // Ответы, уехавшие за прошлый аккаунт, с этого момента недействительны.
    requestSequence.current += 1;

    // Через таймер, чтобы не вызывать setState синхронно в эффекте.
    const timer = setTimeout(() => {
      setSubscribedIds(new Set());
      setBusinesses([]);

      if (userId) {
        void refresh();
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [userId, refresh]);

  /*
    Без пользователя показывать нечего. Маскируем в одном месте:
    раньше context отдавал пустой subscribedIds, а isSubscribed
    читал настоящий — и у вышедшего человека звёздочки на карточках
    оставались зажжёнными от прошлого аккаунта.
  */
  const visibleIds = userId ? subscribedIds : EMPTY_IDS;

  const visibleBusinesses = userId
    ? businesses
    : EMPTY_BUSINESSES;

  const isSubscribed = useCallback(
    (businessId: string) => visibleIds.has(businessId),
    [visibleIds],
  );

  const toggleSubscription = useCallback(
    async (businessId: string, businessName: string) => {
      const headers = authHeaders();

      if (!headers) {
        toast.error(
          "Нужен вход",
          "Войдите, чтобы подписываться на заведения.",
        );

        return false;
      }

      if (pendingIds.has(businessId)) {
        return false;
      }

      const wasSubscribed = subscribedIds.has(businessId);

      setPendingIds((previous) => {
        const next = new Set(previous);
        next.add(businessId);
        return next;
      });

      // Оптимистично: кнопка должна отвечать сразу, а не через
      // round-trip до Supabase.
      setSubscribedIds((previous) => {
        const next = new Set(previous);

        if (wasSubscribed) {
          next.delete(businessId);
        } else {
          next.add(businessId);
        }

        return next;
      });

      try {
        const response = await fetch(
          `${API_URL}/business-subscriptions/${businessId}`,
          {
            method: wasSubscribed ? "DELETE" : "PUT",
            headers,
          },
        );

        if (!response.ok) {
          throw new Error(
            `Request failed: ${response.status}`,
          );
        }

        toast.success(
          wasSubscribed
            ? `Отписались от «${businessName}»`
            : `Подписались на «${businessName}»`,
          wasSubscribed
            ? undefined
            : "Сообщим, когда появятся новые скидки.",
        );

        // Список нужен для страницы подписок: там показываем
        // счётчик доступных предложений, его считает сервер.
        void refresh();

        return true;
      } catch (error) {
        console.error(
          "Failed to toggle subscription:",
          error,
        );

        // Откатываем оптимистичное изменение.
        setSubscribedIds((previous) => {
          const next = new Set(previous);

          if (wasSubscribed) {
            next.add(businessId);
          } else {
            next.delete(businessId);
          }

          return next;
        });

        toast.error("Не удалось изменить подписку");

        return false;
      } finally {
        setPendingIds((previous) => {
          const next = new Set(previous);
          next.delete(businessId);
          return next;
        });
      }
    },
    [pendingIds, subscribedIds, toast, refresh],
  );

  const value = useMemo(
    () => ({
      subscribedIds: visibleIds,
      businesses: visibleBusinesses,
      pendingIds,
      loading,
      isSubscribed,
      toggleSubscription,
      refresh,
    }),
    [
      visibleIds,
      visibleBusinesses,
      pendingIds,
      loading,
      isSubscribed,
      toggleSubscription,
      refresh,
    ],
  );

  return (
    <SubscriptionsContext.Provider value={value}>
      {children}
    </SubscriptionsContext.Provider>
  );
}

export function useSubscriptions() {
  const context = useContext(SubscriptionsContext);

  if (context === undefined) {
    throw new Error(
      "useSubscriptions must be used inside SubscriptionsProvider",
    );
  }

  return context;
}
