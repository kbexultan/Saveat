"use client";

import Link from "next/link";

import { useAuth } from "@/components/AuthProvider";
import { useCart } from "@/components/CartProvider";
import NotificationBell from "@/components/NotificationBell";
import { MobileBottomNavigation } from "@/components/mobile/MobileBottomNavigation";

type HeaderProps = {
  variant?: "home" | "auth";
};

/** Общая кнопка-иконка шапки: 44px тап-таргет, без тяжёлых бордеров. */
const iconButtonClass =
  "flex h-11 w-11 items-center justify-center rounded-chip bg-surface-blush text-muted shadow-soft transition hover:bg-primary-tint hover:text-primary-strong";

export default function Header({
  variant = "home",
}: HeaderProps) {
  const {
    user,
    loading,
  } = useAuth();

  const { totalItems } = useCart();

  return (
    <>
      <header className="sticky top-0 z-40 bg-surface/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3 sm:px-6 sm:py-5">
          {/* Логотип */}
          <Link href="/" className="block">
            <h1 className="text-[22px] font-extrabold tracking-[-0.06em] text-primary sm:text-3xl">
              SAVEAT
            </h1>

            <p className="mt-0.5 hidden text-caption text-subtle sm:block sm:text-sm">
              Save food. Save money.
            </p>
          </Link>

          {variant === "auth" ? (
            <Link
              href="/"
              className="flex min-h-11 items-center rounded-chip bg-primary px-4 text-body font-bold text-white shadow-primary transition hover:bg-primary-strong sm:px-5"
            >
              На главную
            </Link>
          ) : (
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Колокольчик сам прячется у неавторизованных. */}
              <NotificationBell />

              {/* Избранное: на мобильном доступно из нижней навигации. */}
              <Link
                href="/favorites"
                aria-label="Избранное"
                title="Избранное"
                className="hidden h-11 w-11 items-center justify-center rounded-chip bg-surface-blush text-muted shadow-soft transition hover:bg-primary-tint hover:text-primary-strong md:flex"
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M20.8 5.8a5.2 5.2 0 0 0-7.4 0L12 7.2l-1.4-1.4a5.2 5.2 0 1 0-7.4 7.4L12 22l8.8-8.8a5.2 5.2 0 0 0 0-7.4Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>

              {/* Корзина */}
              <Link
                href="/cart"
                aria-label="Корзина"
                title="Корзина"
                className={`relative ${iconButtonClass}`}
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M3 4H5L7.3 15.2C7.5 16.2 8.4 17 9.5 17H17.5C18.5 17 19.4 16.3 19.7 15.3L21 9H7"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  <circle cx="10" cy="20" r="1.5" fill="currentColor" />

                  <circle cx="18" cy="20" r="1.5" fill="currentColor" />
                </svg>

                {totalItems > 0 && (
                  <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-pill bg-primary px-1 text-[10px] font-bold text-white">
                    {totalItems > 99 ? "99+" : totalItems}
                  </span>
                )}
              </Link>

              {/* Auth */}
              {loading ? (
                <div className="h-11 w-11 rounded-chip bg-sand-deep" />
              ) : user ? (
                <Link
                  href="/profile"
                  aria-label="Открыть профиль"
                  title="Профиль"
                  className={iconButtonClass}
                >
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle
                      cx="12"
                      cy="8"
                      r="3.8"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    />

                    <path
                      d="M4.5 20.4c0-3.8 3.35-6.3 7.5-6.3s7.5 2.5 7.5 6.3"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="flex h-11 items-center justify-center rounded-chip bg-surface-blush px-4 text-body font-semibold text-muted shadow-soft transition hover:bg-primary-tint sm:px-5"
                >
                  Войти
                </Link>
              )}

              <Link
                href="/business"
                aria-label="Для бизнеса"
                title="Для бизнеса"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-chip bg-primary text-white shadow-primary transition hover:bg-primary-strong sm:w-auto sm:gap-2 sm:px-5 sm:text-body sm:font-bold"
              >
                <svg
                  width="21"
                  height="21"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M4 10.5V20h16v-9.5M3 10.5l2-6.5h14l2 6.5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M3 10.5c0 1.4 1.1 2.5 2.5 2.5S8 11.9 8 10.5c0 1.4 1.1 2.5 2.5 2.5s2.5-1.1 2.5-2.5c0 1.4 1.1 2.5 2.5 2.5s2.5-1.1 2.5-2.5c0 1.4 1.1 2.5 2.5 2.5s2.5-1.1 2.5-2.5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M9.5 20v-4h5v4"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="hidden sm:inline">Для бизнеса</span>
              </Link>
            </div>
          )}
        </div>
      </header>

      {variant === "home" ? <MobileBottomNavigation /> : null}
    </>
  );
}
