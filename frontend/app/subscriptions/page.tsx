"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/components/AuthProvider";
import BusinessCard from "@/components/BusinessCard";
import Header from "@/components/Header";
import { useSubscriptions } from "@/components/SubscriptionsProvider";
import { formatBusinessCount } from "@/lib/plural";

/**
 * Мои подписки — только то, на что человек подписан.
 *
 * Каталог всех заведений живёт отдельно, на /businesses: здесь
 * намеренно нет ни поиска, ни чужих заведений, иначе страница
 * перестаёт отвечать на вопрос «за чем я слежу».
 */
export default function SubscriptionsPage() {
  const router = useRouter();

  const { user, loading: authLoading } = useAuth();

  const {
    businesses,
    loading,
  } = useSubscriptions();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(
        "/login?next=/subscriptions",
      );
    }
  }, [authLoading, user, router]);

  if (!authLoading && !user) {
    return null;
  }

  const isInitialLoading =
    authLoading ||
    (loading && businesses.length === 0);

  return (
    <main className="saveat-mobile-page min-h-screen bg-sand text-ink">
      <Header variant="home" />

      <section className="saveat-screen mx-auto max-w-6xl px-6 py-8 sm:py-12">
        <div className="mb-8 sm:mb-10">
          <p className="text-caption font-semibold text-primary-strong">
            SAVEAT
          </p>

          <h1 className="mt-1 text-3xl font-bold tracking-[-0.04em] sm:text-4xl">
            Мои подписки
          </h1>

          <p className="mt-2 max-w-xl text-body leading-6 text-muted sm:text-base">
            {isInitialLoading
              ? "Загружаем подписки…"
              : businesses.length > 0
                ? `${formatBusinessCount(businesses.length)} — сообщим, когда там появятся новые скидки.`
                : "Заведения, за которыми вы следите, будут здесь."}
          </p>
        </div>

        {isInitialLoading ? (
          <div
            aria-live="polite"
            aria-busy="true"
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            <span className="sr-only">
              Загружаем подписки
            </span>

            {[0, 1, 2].map((item) => (
              <div
                key={item}
                aria-hidden="true"
                className="h-[236px] animate-pulse rounded-card-lg bg-surface shadow-soft"
              />
            ))}
          </div>
        ) : businesses.length === 0 ? (
          <div className="rounded-card-lg bg-surface px-6 py-12 text-center shadow-soft sm:py-16">
            <div aria-hidden="true" className="text-5xl">
              ☆
            </div>

            <h2 className="mt-4 text-section font-bold tracking-[-0.03em]">
              Подписок пока нет
            </h2>

            <p className="mx-auto mt-2 max-w-md text-body leading-6 text-muted">
              Найдите заведение через поиск и нажмите «Подписаться» —
              оно появится здесь вместе с уведомлениями о новых скидках.
            </p>

            <Link
              href="/businesses"
              className="mt-6 inline-flex min-h-12 items-center justify-center rounded-chip bg-primary px-6 text-body font-bold text-white shadow-primary transition hover:bg-primary-strong"
            >
              Найти заведения
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {businesses.map((business) => (
              <BusinessCard
                key={business.id}
                business={business}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
