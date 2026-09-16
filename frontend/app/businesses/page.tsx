"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
} from "react";

import BusinessCard, {
  type BusinessCardData,
} from "@/components/BusinessCard";
import Header from "@/components/Header";
import { formatBusinessCount } from "@/lib/plural";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8001";

/**
 * Пауза перед запросом: без неё каждый символ уходил бы
 * отдельным запросом к Supabase.
 */
const SEARCH_DEBOUNCE_MS = 300;

export default function BusinessesPage() {
  const [query, setQuery] = useState("");

  const [businesses, setBusinesses] = useState<
    BusinessCardData[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /*
    Держим последний запрос, чтобы отменить его при новом вводе:
    иначе медленный ответ по «на» мог бы перезаписать быстрый
    ответ по «нан» и показать не то, что набрано.
  */
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const term = query.trim();

    const timer = window.setTimeout(() => {
      requestRef.current?.abort();

      const controller = new AbortController();
      requestRef.current = controller;

      setLoading(true);

      const url = term
        ? `${API_URL}/businesses/public?search=${encodeURIComponent(
            term,
          )}`
        : `${API_URL}/businesses/public`;

      fetch(url, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(
              `Request failed: ${response.status}`,
            );
          }

          const data: BusinessCardData[] =
            await response.json();

          setBusinesses(data);
          setError("");
        })
        .catch((cause) => {
          if (controller.signal.aborted) {
            return;
          }

          console.error(
            "Failed to load businesses:",
            cause,
          );

          setError(
            "Не удалось загрузить заведения. Проверьте связь и попробуйте снова.",
          );
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setLoading(false);
          }
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    return () => requestRef.current?.abort();
  }, []);

  const term = query.trim();

  return (
    <main className="saveat-mobile-page min-h-screen bg-sand text-ink">
      <Header variant="home" />

      <section className="saveat-screen mx-auto max-w-6xl px-6 py-8 sm:py-12">
        <div className="mb-6 sm:mb-8">
          <p className="text-caption font-semibold text-primary-strong">
            SAVEAT
          </p>

          <h1 className="mt-1 text-3xl font-bold tracking-[-0.04em] sm:text-4xl">
            Заведения
          </h1>

          <p className="mt-2 max-w-xl text-body leading-6 text-muted sm:text-base">
            Найдите любимое место и подпишитесь — сообщим, когда там
            появятся новые скидки.
          </p>
        </div>

        <div className="relative mb-8">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-subtle"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                cx="11"
                cy="11"
                r="6.5"
                stroke="currentColor"
                strokeWidth="1.8"
              />

              <path
                d="m16 16 4 4"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </span>

          <input
            type="search"
            value={query}
            onChange={(event) =>
              setQuery(event.target.value)
            }
            placeholder="Название заведения — «нан», «coffee»…"
            aria-label="Поиск заведения"
            className="min-h-13 w-full rounded-chip bg-surface py-3.5 pl-13 pr-5 text-body text-ink shadow-soft outline-none transition placeholder:text-subtle focus:ring-2 focus:ring-primary-soft"
          />
        </div>

        {error ? (
          <div
            role="alert"
            className="mb-6 flex flex-col gap-4 rounded-card-lg bg-danger-tint p-5 text-danger-ink sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="text-body font-semibold">{error}</p>

            <button
              type="button"
              onClick={() =>
                setQuery((previous) => `${previous} `.trim())
              }
              className="min-h-11 shrink-0 rounded-chip bg-surface px-5 text-body font-bold text-danger-ink shadow-soft transition hover:bg-surface-blush"
            >
              Попробовать снова
            </button>
          </div>
        ) : null}

        {loading ? (
          <div
            aria-live="polite"
            aria-busy="true"
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            <span className="sr-only">
              Загружаем заведения
            </span>

            {[0, 1, 2, 3, 4, 5].map((item) => (
              <div
                key={item}
                aria-hidden="true"
                className="h-[236px] animate-pulse rounded-card-lg bg-surface shadow-soft"
              />
            ))}
          </div>
        ) : null}

        {!loading && !error && businesses.length === 0 ? (
          <div className="rounded-card-lg bg-surface px-6 py-12 text-center shadow-soft sm:py-16">
            <div aria-hidden="true" className="text-5xl">
              🔍
            </div>

            <h2 className="mt-4 text-section font-bold tracking-[-0.03em]">
              {term
                ? "Ничего не нашлось"
                : "Заведений пока нет"}
            </h2>

            <p className="mx-auto mt-2 max-w-md text-body leading-6 text-muted">
              {term
                ? `По запросу «${term}» ничего нет. Попробуйте короче — например, часть названия.`
                : "Как только заведения появятся, они окажутся здесь."}
            </p>

            {term ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="mt-6 inline-flex min-h-12 items-center justify-center rounded-chip bg-primary px-6 text-body font-bold text-white shadow-primary transition hover:bg-primary-strong"
              >
                Показать все заведения
              </button>
            ) : (
              <Link
                href="/"
                className="mt-6 inline-flex min-h-12 items-center justify-center rounded-chip bg-primary px-6 text-body font-bold text-white shadow-primary transition hover:bg-primary-strong"
              >
                Смотреть предложения
              </Link>
            )}
          </div>
        ) : null}

        {!loading && businesses.length > 0 ? (
          <>
            <p className="mb-4 text-caption text-subtle">
              {term
                ? `Нашли ${formatBusinessCount(
                    businesses.length,
                  )}`
                : `Всего ${formatBusinessCount(
                    businesses.length,
                  )}`}
            </p>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {businesses.map((business) => (
                <BusinessCard
                  key={business.id}
                  business={business}
                />
              ))}
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}
