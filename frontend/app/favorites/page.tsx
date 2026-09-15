"use client";

import Link from "next/link";
import {
  useRouter,
} from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  useAuth,
} from "@/components/AuthProvider";
import {
  useFavorites,
} from "@/components/FavoritesProvider";
import Header from "@/components/Header";
import OfferCard from "@/components/OfferCard";

const PENDING_FAVORITE_NOTICE_KEY = "pending_favorite_notice";

export default function FavoritesPage() {
  const router = useRouter();
  const revalidatedUserId = useRef<string | null>(null);
  const [pendingFavoriteNotice, setPendingFavoriteNotice] = useState("");

  const {
    user,
    loading: authLoading,
  } = useAuth();

  const {
    favoriteOffers,
    loading,
    error,
    refreshFavorites,
  } = useFavorites();

  useEffect(() => {
    if (
      !authLoading &&
      !user
    ) {
      router.replace(
        "/login?next=/favorites",
      );
    }
  }, [
    authLoading,
    user,
    router,
  ]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      revalidatedUserId.current = null;
      return;
    }

    // Начальная загрузка провайдера уже является актуализацией данных.
    if (loading) {
      revalidatedUserId.current = user.id;
      return;
    }

    if (revalidatedUserId.current === user.id) {
      return;
    }

    revalidatedUserId.current = user.id;
    void refreshFavorites();
  }, [authLoading, loading, refreshFavorites, user]);

  useEffect(() => {
    const notice = sessionStorage.getItem(PENDING_FAVORITE_NOTICE_KEY);

    if (!notice) {
      return;
    }

    const timer = window.setTimeout(() => {
      sessionStorage.removeItem(PENDING_FAVORITE_NOTICE_KEY);
      setPendingFavoriteNotice(notice);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const isInitialLoading =
    authLoading ||
    (Boolean(user) &&
      loading &&
      favoriteOffers.length === 0);

  return (
    <main className="saveat-mobile-page min-h-screen bg-sand text-ink">
      <Header variant="home" />

      <section className="saveat-screen mx-auto max-w-6xl px-6 py-8 sm:py-12">
        <div className="mb-8 sm:mb-10">
          <p className="text-caption font-semibold text-primary-strong">
            SAVEAT
          </p>

          <h1 className="mt-1 text-3xl font-bold tracking-[-0.04em] sm:text-4xl">
            Избранное
          </h1>

          <p className="mt-2 max-w-xl text-body leading-6 text-muted sm:text-base">
            Сохраняйте интересные предложения, чтобы быстро вернуться к ним позже.
          </p>
        </div>

        {pendingFavoriteNotice ? (
          <div
            role="status"
            className="mb-6 flex items-start justify-between gap-4 rounded-card-lg bg-surface-blush p-5 text-muted shadow-soft"
          >
            <p className="text-body font-semibold">
              {pendingFavoriteNotice}
            </p>

            <button
              type="button"
              onClick={() => setPendingFavoriteNotice("")}
              aria-label="Закрыть сообщение"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-chip bg-surface text-xl font-bold text-primary-strong transition hover:bg-primary-tint"
            >
              ×
            </button>
          </div>
        ) : null}

        {error ? (
          <div
            role="alert"
            className="mb-6 flex flex-col gap-4 rounded-card-lg bg-danger-tint p-5 text-danger-ink sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="text-body font-semibold">
              {error}
            </p>

            <button
              type="button"
              onClick={() => {
                void refreshFavorites();
              }}
              disabled={loading}
              className="min-h-11 shrink-0 rounded-chip bg-surface px-5 text-body font-bold text-danger-ink shadow-soft transition hover:bg-surface-blush disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? "Обновляем…"
                : "Попробовать снова"}
            </button>
          </div>
        ) : null}

        {isInitialLoading ? (
          <div
            aria-live="polite"
            aria-busy="true"
            className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3"
          >
            <span className="sr-only">
              Загружаем избранное
            </span>

            {[0, 1, 2].map(
              (item) => (
                <div
                  key={item}
                  aria-hidden="true"
                  className="h-[520px] animate-pulse rounded-card-lg bg-surface shadow-soft"
                />
              ),
            )}
          </div>
        ) : null}

        {!authLoading &&
        user &&
        !loading &&
        !error &&
        favoriteOffers.length === 0 ? (
          <div className="rounded-card-lg bg-surface px-6 py-12 text-center shadow-soft sm:py-16">
            <div
              aria-hidden="true"
              className="text-5xl"
            >
              ♡
            </div>

            <h2 className="mt-4 text-section font-bold tracking-[-0.03em]">
              Здесь пока пусто
            </h2>

            <p className="mx-auto mt-2 max-w-md text-body leading-6 text-muted">
              Нажмите на сердце у предложения — и оно появится на этой странице.
            </p>

            <Link
              href="/"
              className="mt-6 inline-flex min-h-12 items-center justify-center rounded-chip bg-primary px-6 text-body font-bold text-white shadow-primary transition hover:bg-primary-strong"
            >
              Смотреть предложения
            </Link>
          </div>
        ) : null}

        {!isInitialLoading &&
        favoriteOffers.length > 0 ? (
          <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
            {favoriteOffers.map(
              (offer) => (
                <OfferCard
                  key={offer.id}
                  offer={offer}
                />
              ),
            )}
          </div>
        ) : null}
      </section>
    </main>
  );
}
