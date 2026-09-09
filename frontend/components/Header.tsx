"use client";

import Link from "next/link";

import { useAuth } from "@/components/AuthProvider";
import { useCart } from "@/components/CartProvider";

type HeaderProps = {
  variant?: "home" | "auth";
};

export default function Header({
  variant = "home",
}: HeaderProps) {
  const {
    user,
    loading,
  } = useAuth();

  const { totalItems } =
    useCart();

  return (
    <header className="border-b border-[#eadfd6] bg-[#fffdf9]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        {/* Logo */}
        <Link
          href="/"
          className="block"
        >
          <h1 className="text-3xl font-bold tracking-tight text-[#D87979]">
            SAVEAT
          </h1>

          <p className="mt-0.5 text-sm text-[#A48070]">
            Save food. Save money.
          </p>
        </Link>

        {variant === "auth" ? (
          <Link
            href="/"
            className="rounded-xl bg-[#D87979] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#C96868]"
          >
            На главную
          </Link>
        ) : (
          <div className="flex items-center gap-3">
            {/* Корзина */}
            <Link
              href="/cart"
              aria-label="Корзина"
              title="Корзина"
              className="relative flex h-11 w-11 items-center justify-center rounded-full border border-[#DDCEC3] bg-[#FFFDF9] text-[#5C4949] transition hover:border-[#D87979] hover:bg-[#F7E7E1] hover:text-[#D87979]"
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

                <circle
                  cx="10"
                  cy="20"
                  r="1.5"
                  fill="currentColor"
                />

                <circle
                  cx="18"
                  cy="20"
                  r="1.5"
                  fill="currentColor"
                />
              </svg>

              {totalItems > 0 && (
                <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[#D87979] px-1 text-[10px] font-bold text-white">
                  {totalItems > 99
                    ? "99+"
                    : totalItems}
                </span>
              )}
            </Link>

            {/* Auth */}
            {loading ? (
              <div className="h-11 w-11 rounded-full border border-[#DDCEC3] bg-[#F7EFE8]" />
            ) : user ? (
              <Link
                href="/profile"
                aria-label="Открыть профиль"
                title="Профиль"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-[#DDCEC3] bg-[#FFFDF9] text-[#5C4949] transition hover:border-[#D87979] hover:bg-[#F7E7E1] hover:text-[#D87979]"
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />

                  <path
                    d="M4 22C4 17.5817 7.58172 14 12 14C16.4183 14 20 17.5817 20 22"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </Link>
            ) : (
              <Link
                href="/login"
                className="rounded-xl border border-[#DDCEC3] bg-[#FFFDF9] px-5 py-3 text-sm font-medium text-[#5C4949] transition hover:bg-[#F3E9E0]"
              >
                Войти
              </Link>
            )}

            <button
              type="button"
              className="rounded-xl bg-[#D87979] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#C96868]"
            >
              Для бизнеса
            </button>
          </div>
        )}
      </div>
    </header>
  );
}