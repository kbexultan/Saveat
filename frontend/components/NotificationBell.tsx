"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
} from "react";

import { useAuth } from "@/components/AuthProvider";
import { useNotifications } from "@/components/NotificationsProvider";

function formatWhen(value: string) {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.round(diffMs / 60000);

  if (diffMinutes < 1) {
    return "только что";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} мин назад`;
  }

  const diffHours = Math.round(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours} ч назад`;
  }

  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Almaty",
    day: "numeric",
    month: "short",
  }).format(date);
}

export default function NotificationBell() {
  const { user } = useAuth();

  const {
    notifications,
    unread,
    markRead,
    markAllRead,
  } = useNotifications();

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(
          event.target as Node,
        )
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handlePointerDown,
    );
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener(
        "mousedown",
        handlePointerDown,
      );
      document.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [open]);

  // Незалогиненному колокольчик показывать нечего.
  if (!user) {
    return null;
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={
          unread > 0
            ? `Уведомления, непрочитанных: ${unread}`
            : "Уведомления"
        }
        aria-expanded={open}
        title="Уведомления"
        className="relative flex h-11 w-11 items-center justify-center rounded-chip bg-surface-blush text-muted shadow-soft transition hover:bg-primary-tint hover:text-primary-strong"
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M12 3a6 6 0 0 0-6 6v3.6L4.4 16.2h15.2L18 12.6V9a6 6 0 0 0-6-6Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />

          <path
            d="M9.8 19a2.3 2.3 0 0 0 4.4 0"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>

        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-pill bg-primary px-1 text-[10px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Уведомления"
          className="absolute right-0 top-13 z-50 mt-2 w-[320px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-[#E2C8B5] bg-[#FFFDF9] shadow-lg"
        >
          <div className="flex items-center justify-between gap-3 border-b border-[#EEE0D5] px-4 py-3">
            <h3 className="font-bold text-ink">
              Уведомления
            </h3>

            {unread > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-xs font-semibold text-[#B85F68] transition hover:underline"
              >
                Прочитать все
              </button>
            )}
          </div>

          <div className="max-h-[320px] overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-[#9A8176]">
                Уведомлений пока нет
              </p>
            ) : (
              notifications.map((item) => {
                const href = item.order_id
                  ? `/orders/${item.order_id}`
                  : "/notifications";

                return (
                  <Link
                    key={item.id}
                    href={href}
                    onClick={() => {
                      if (!item.is_read) {
                        void markRead(item.id);
                      }

                      setOpen(false);
                    }}
                    className={`block border-b border-[#F0E6DE] px-4 py-3 transition last:border-b-0 hover:bg-[#F9EFE9] ${
                      item.is_read ? "" : "bg-[#FFF6F2]"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {!item.is_read && (
                        <span
                          aria-hidden="true"
                          className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary"
                        />
                      )}

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[#4B3A3A]">
                          {item.title}
                        </p>

                        <p className="mt-0.5 text-xs leading-5 text-[#8B746C]">
                          {item.body}
                        </p>

                        <p className="mt-1 text-[11px] text-[#A2877C]">
                          {formatWhen(item.created_at)}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>

          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-[#EEE0D5] px-4 py-3 text-center text-sm font-semibold text-[#B85F68] transition hover:bg-[#F9EFE9]"
          >
            Все уведомления
          </Link>
        </div>
      )}
    </div>
  );
}
