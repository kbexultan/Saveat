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

/**
 * Как часто спрашиваем счётчик непрочитанных.
 *
 * 30 секунд — компромисс: сервер ходит в Supabase, каждый запрос это
 * ~300 мс сетевой задержки, и опрашивать чаще ради колокольчика смысла
 * нет. Настоящий realtime — это WebSocket или push, а push у нас уже
 * есть отдельным каналом.
 */
const POLL_INTERVAL_MS = 30_000;

export type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  order_id: string | null;
  is_read: boolean;
  created_at: string;
};

type NotificationsContextType = {
  notifications: Notification[];
  unread: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
};

const NotificationsContext = createContext<
  NotificationsContextType | undefined
>(undefined);

function authHeaders() {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("access_token")
      : null;

  return token
    ? { Authorization: `Bearer ${token}` }
    : null;
}

export function NotificationsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { user } = useAuth();
  const toast = useToast();

  const [notifications, setNotifications] = useState<
    Notification[]
  >([]);

  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);

  /*
    Что уже показали тостом. Без этого каждый опрос заново всплывал бы
    теми же уведомлениями. При первой загрузке множество заполняется
    молча — иначе человек, открывший вкладку, получил бы очередь
    тостов за всю прошлую неделю.
  */
  const announcedIds = useRef(new Set<string>());
  const primed = useRef(false);
  const ownerId = useRef<string | null>(null);

  const userId = user?.id ?? null;

  const refresh = useCallback(async () => {
    const headers = authHeaders();

    if (!headers) {
      return;
    }

    setLoading(true);

    try {
      const [listResponse, countResponse] =
        await Promise.all([
          fetch(`${API_URL}/notifications?limit=30`, {
            headers,
          }),
          fetch(`${API_URL}/notifications/unread-count`, {
            headers,
          }),
        ]);

      if (!listResponse.ok || !countResponse.ok) {
        return;
      }

      const list: Notification[] =
        await listResponse.json();

      const count: { unread: number } =
        await countResponse.json();

      setNotifications(list);
      setUnread(count.unread);

      if (!primed.current) {
        for (const item of list) {
          announcedIds.current.add(item.id);
        }

        primed.current = true;
        return;
      }

      // Новые непрочитанные показываем тостом — от старых к новым,
      // чтобы самое свежее оказалось последним в стопке.
      const fresh = list
        .filter(
          (item) =>
            !item.is_read &&
            !announcedIds.current.has(item.id),
        )
        .reverse();

      for (const item of fresh) {
        announcedIds.current.add(item.id);

        toast.show({
          tone: "info",
          title: item.title,
          description: item.body,
        });
      }
    } catch (error) {
      console.error(
        "Failed to load notifications:",
        error,
      );
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    let cancelled = false;

    // Сменился пользователь (или вышел) — чужие уведомления
    // показывать нельзя, состояние сбрасываем полностью.
    const switched = ownerId.current !== userId;

    if (switched) {
      ownerId.current = userId;
      announcedIds.current = new Set();
      primed.current = false;
    }

    /*
      Стартуем на следующем тике, а не прямо в теле эффекта: синхронный
      setState внутри эффекта вызывает каскадный ререндер, на что
      справедливо ругается react-hooks/set-state-in-effect.
    */
    const startTimer = setTimeout(() => {
      if (cancelled) {
        return;
      }

      if (switched) {
        setNotifications([]);
        setUnread(0);
      }

      if (userId) {
        void refresh();
      }
    }, 0);

    const pollTimer = userId
      ? setInterval(() => {
          void refresh();
        }, POLL_INTERVAL_MS)
      : null;

    // Возврат на вкладку — повод обновиться сразу: пока вкладка была
    // скрыта, таймеры в браузере сильно замедляются.
    function handleVisibility() {
      if (
        userId &&
        document.visibilityState === "visible"
      ) {
        void refresh();
      }
    }

    document.addEventListener(
      "visibilitychange",
      handleVisibility,
    );

    return () => {
      cancelled = true;
      clearTimeout(startTimer);

      if (pollTimer) {
        clearInterval(pollTimer);
      }

      document.removeEventListener(
        "visibilitychange",
        handleVisibility,
      );
    };
  }, [userId, refresh]);

  const markRead = useCallback(async (id: string) => {
    const headers = authHeaders();

    if (!headers) {
      return;
    }

    // Оптимистично: колокольчик должен гаснуть сразу, а не через
    // round-trip до Supabase.
    setNotifications((previous) =>
      previous.map((item) =>
        item.id === id
          ? { ...item, is_read: true }
          : item,
      ),
    );

    setUnread((previous) => Math.max(0, previous - 1));

    try {
      await fetch(
        `${API_URL}/notifications/${id}/read`,
        { method: "POST", headers },
      );
    } catch (error) {
      console.error(
        "Failed to mark notification as read:",
        error,
      );
    }
  }, []);

  const markAllRead = useCallback(async () => {
    const headers = authHeaders();

    if (!headers) {
      return;
    }

    setNotifications((previous) =>
      previous.map((item) => ({
        ...item,
        is_read: true,
      })),
    );

    setUnread(0);

    try {
      await fetch(`${API_URL}/notifications/read-all`, {
        method: "POST",
        headers,
      });
    } catch (error) {
      console.error(
        "Failed to mark all as read:",
        error,
      );
    }
  }, []);

  const value = useMemo(
    () => ({
      notifications,
      unread,
      loading,
      refresh,
      markRead,
      markAllRead,
    }),
    [
      notifications,
      unread,
      loading,
      refresh,
      markRead,
      markAllRead,
    ],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);

  if (context === undefined) {
    throw new Error(
      "useNotifications must be used inside NotificationsProvider",
    );
  }

  return context;
}
