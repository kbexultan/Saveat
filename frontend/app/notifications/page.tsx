"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/components/AuthProvider";
import { useNotifications } from "@/components/NotificationsProvider";
import { usePushSubscription } from "@/components/PushSubscription";
import Header from "@/components/Header";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Almaty",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function NotificationsPage() {
  const router = useRouter();

  const { user, loading: authLoading } = useAuth();

  const {
    notifications,
    unread,
    loading,
    markRead,
    markAllRead,
  } = useNotifications();

  const {
    status: pushStatus,
    busy: pushBusy,
    subscribe,
    unsubscribe,
  } = usePushSubscription();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login?next=/notifications");
    }
  }, [authLoading, user, router]);

  if (!authLoading && !user) {
    return null;
  }

  return (
    <main className="saveat-mobile-page min-h-screen bg-sand text-ink">
      <Header variant="home" />

      <section className="saveat-screen mx-auto max-w-3xl px-6 py-8 sm:py-12">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-caption font-semibold text-primary-strong">
              SAVEAT
            </p>

            <h1 className="mt-1 text-3xl font-bold tracking-[-0.04em] sm:text-4xl">
              Уведомления
            </h1>

            <p className="mt-2 text-body leading-6 text-muted">
              {unread > 0
                ? `Непрочитанных: ${unread}`
                : "Все уведомления прочитаны"}
            </p>
          </div>

          {unread > 0 && (
            <button
              type="button"
              onClick={() => void markAllRead()}
              className="min-h-11 rounded-chip bg-surface px-5 text-body font-semibold text-primary-strong shadow-soft transition hover:bg-surface-blush"
            >
              Прочитать все
            </button>
          )}
        </div>

        {/* Push: показываем блок только когда браузер и сервер его тянут */}
        {pushStatus !== "unsupported" &&
          pushStatus !== "disabled" && (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-card-lg bg-surface p-5 shadow-soft">
              <div className="min-w-0">
                <p className="text-body font-bold">
                  Push-уведомления
                </p>

                <p className="mt-1 text-caption leading-5 text-muted">
                  {pushStatus === "denied"
                    ? "Показ уведомлений заблокирован в настройках браузера."
                    : pushStatus === "subscribed"
                      ? "Включены: сообщим о заказе, даже если вкладка закрыта."
                      : "Включите, чтобы узнавать о заказах при закрытой вкладке."}
                </p>
              </div>

              {pushStatus !== "denied" && (
                <button
                  type="button"
                  disabled={pushBusy}
                  onClick={() =>
                    pushStatus === "subscribed"
                      ? void unsubscribe()
                      : void subscribe()
                  }
                  className="min-h-11 shrink-0 rounded-chip bg-primary px-5 text-body font-bold text-white shadow-primary transition hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pushBusy
                    ? "Минуту…"
                    : pushStatus === "subscribed"
                      ? "Выключить"
                      : "Включить"}
                </button>
              )}
            </div>
          )}

        {loading && notifications.length === 0 ? (
          <div
            aria-busy="true"
            className="space-y-3"
          >
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                aria-hidden="true"
                className="h-24 animate-pulse rounded-card-lg bg-surface shadow-soft"
              />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="rounded-card-lg bg-surface px-6 py-12 text-center shadow-soft">
            <div
              aria-hidden="true"
              className="text-5xl"
            >
              🔔
            </div>

            <h2 className="mt-4 text-section font-bold">
              Здесь пока пусто
            </h2>

            <p className="mx-auto mt-2 max-w-md text-body leading-6 text-muted">
              Мы сообщим, когда с вашим заказом что-то произойдёт.
            </p>

            <Link
              href="/"
              className="mt-6 inline-flex min-h-12 items-center justify-center rounded-chip bg-primary px-6 text-body font-bold text-white shadow-primary transition hover:bg-primary-strong"
            >
              Смотреть предложения
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {notifications.map((item) => {
              const href = item.order_id
                ? `/orders/${item.order_id}`
                : null;

              const content = (
                <div className="flex items-start gap-3">
                  {!item.is_read && (
                    <span
                      aria-hidden="true"
                      className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-primary"
                    />
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="text-body font-bold">
                      {item.title}
                    </p>

                    <p className="mt-1 text-body leading-6 text-muted">
                      {item.body}
                    </p>

                    <p className="mt-2 text-caption text-subtle">
                      {formatDateTime(item.created_at)}
                    </p>
                  </div>
                </div>
              );

              return (
                <li key={item.id}>
                  {href ? (
                    <Link
                      href={href}
                      onClick={() => {
                        if (!item.is_read) {
                          void markRead(item.id);
                        }
                      }}
                      className={`block rounded-card-lg p-5 shadow-soft transition hover:bg-surface-blush ${
                        item.is_read
                          ? "bg-surface"
                          : "bg-[#FFF6F2]"
                      }`}
                    >
                      {content}
                    </Link>
                  ) : (
                    <div
                      className={`rounded-card-lg p-5 shadow-soft ${
                        item.is_read
                          ? "bg-surface"
                          : "bg-[#FFF6F2]"
                      }`}
                    >
                      {content}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
