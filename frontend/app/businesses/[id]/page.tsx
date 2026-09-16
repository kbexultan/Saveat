"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useState,
} from "react";

import Header from "@/components/Header";
import OfferCard, {
  type Offer,
} from "@/components/OfferCard";
import { SubscribeButton } from "@/components/SubscribeButton";
import {
  formatBranchCount,
  formatOfferCount,
} from "@/lib/plural";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8001";

type Business = {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  status: string;
  created_at: string;
};

type Branch = {
  id: string;
  business_id: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  opening_time: string | null;
  closing_time: string | null;
};

/** "08:00:00" → "08:00". Секунды в часах работы не нужны. */
function formatTime(value: string | null) {
  return value ? value.slice(0, 5) : null;
}

function formatWorkingHours(branch: Branch) {
  const opening = formatTime(branch.opening_time);
  const closing = formatTime(branch.closing_time);

  if (!opening || !closing) {
    return null;
  }

  return `${opening}–${closing}`;
}

export default function BusinessProfilePage() {
  const params = useParams();

  const businessId =
    typeof params.id === "string" ? params.id : "";

  const [business, setBusiness] =
    useState<Business | null>(null);

  const [offers, setOffers] = useState<Offer[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!businessId) {
        return;
      }

      setLoading(true);

      try {
        // Три независимых запроса — параллельно, иначе страница
        // ждала бы три round-trip'а подряд.
        const [
          businessResponse,
          offersResponse,
          branchesResponse,
        ] = await Promise.all([
          fetch(
            `${API_URL}/businesses/${businessId}`,
            { signal },
          ),
          fetch(
            `${API_URL}/offers/public?business_id=${businessId}`,
            { signal },
          ),
          fetch(
            `${API_URL}/branches?business_id=${businessId}`,
            { signal },
          ),
        ]);

        if (businessResponse.status === 404) {
          setNotFound(true);
          setError("");
          return;
        }

        if (
          !businessResponse.ok ||
          !offersResponse.ok ||
          !branchesResponse.ok
        ) {
          throw new Error("Request failed");
        }

        setBusiness(await businessResponse.json());
        setOffers(await offersResponse.json());
        setBranches(await branchesResponse.json());

        setNotFound(false);
        setError("");
      } catch (cause) {
        if (signal?.aborted) {
          return;
        }

        console.error(
          "Failed to load business:",
          cause,
        );

        setError(
          "Не удалось загрузить заведение. Проверьте связь и попробуйте снова.",
        );
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [businessId],
  );

  useEffect(() => {
    const controller = new AbortController();

    // Через таймер, чтобы не звать setState синхронно в эффекте:
    // иначе получаем каскадный ререндер на каждом заходе.
    const timer = window.setTimeout(() => {
      void load(controller.signal);
    }, 0);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [load]);

  if (loading) {
    return (
      <main className="saveat-mobile-page min-h-screen bg-sand text-ink">
        <Header variant="home" />

        <section className="saveat-screen mx-auto max-w-6xl px-6 py-8 sm:py-12">
          <div className="h-48 animate-pulse rounded-card-lg bg-surface shadow-soft" />

          <div className="mt-8 grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                aria-hidden="true"
                className="h-[520px] animate-pulse rounded-card-lg bg-surface shadow-soft"
              />
            ))}
          </div>
        </section>
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="saveat-mobile-page min-h-screen bg-sand text-ink">
        <Header variant="home" />

        <section className="saveat-screen mx-auto max-w-3xl px-6 py-16">
          <div className="rounded-card-lg bg-surface px-6 py-12 text-center shadow-soft">
            <div aria-hidden="true" className="text-5xl">
              🏚️
            </div>

            <h1 className="mt-4 text-section font-bold tracking-[-0.03em]">
              Заведение не найдено
            </h1>

            <p className="mx-auto mt-2 max-w-md text-body leading-6 text-muted">
              Возможно, оно больше не работает в SAVEAT или ссылка
              устарела.
            </p>

            <Link
              href="/businesses"
              className="mt-6 inline-flex min-h-12 items-center justify-center rounded-chip bg-primary px-6 text-body font-bold text-white shadow-primary transition hover:bg-primary-strong"
            >
              Все заведения
            </Link>
          </div>
        </section>
      </main>
    );
  }

  if (error || !business) {
    return (
      <main className="saveat-mobile-page min-h-screen bg-sand text-ink">
        <Header variant="home" />

        <section className="saveat-screen mx-auto max-w-3xl px-6 py-16">
          <div
            role="alert"
            className="flex flex-col gap-4 rounded-card-lg bg-danger-tint p-6 text-danger-ink sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="text-body font-semibold">
              {error || "Заведение недоступно."}
            </p>

            <button
              type="button"
              onClick={() => {
                void load();
              }}
              className="min-h-11 shrink-0 rounded-chip bg-surface px-5 text-body font-bold text-danger-ink shadow-soft transition hover:bg-surface-blush"
            >
              Попробовать снова
            </button>
          </div>
        </section>
      </main>
    );
  }

  const initial =
    business.name.trim().charAt(0).toUpperCase() || "?";

  return (
    <main className="saveat-mobile-page min-h-screen bg-sand text-ink">
      <Header variant="home" />

      <section className="saveat-screen mx-auto max-w-6xl px-6 py-8 sm:py-12">
        <Link
          href="/businesses"
          className="inline-flex items-center gap-1.5 text-caption font-semibold text-primary-strong transition hover:opacity-80"
        >
          <span aria-hidden="true">←</span>
          Все заведения
        </Link>

        {/* Шапка заведения */}
        <div className="mt-4 rounded-card-lg bg-surface p-6 shadow-soft sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              {business.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={business.logo_url}
                  alt=""
                  className="h-16 w-16 shrink-0 rounded-tile object-cover sm:h-20 sm:w-20"
                />
              ) : (
                <div
                  aria-hidden="true"
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-tile bg-primary-tint text-2xl font-bold text-primary-strong sm:h-20 sm:w-20"
                >
                  {initial}
                </div>
              )}

              <div className="min-w-0">
                <h1 className="text-page font-bold tracking-[-0.04em] sm:text-4xl">
                  {business.name}
                </h1>

                <p className="mt-1 text-caption text-subtle">
                  {formatBranchCount(branches.length)} ·{" "}
                  {offers.length > 0
                    ? `${formatOfferCount(
                        offers.length,
                      )} сейчас`
                    : "сейчас предложений нет"}
                </p>

                {business.description ? (
                  <p className="mt-3 max-w-xl text-body leading-6 text-muted">
                    {business.description}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="shrink-0">
              <SubscribeButton
                businessId={business.id}
                businessName={business.name}
                size="full"
              />
            </div>
          </div>
        </div>

        {/* Адреса */}
        {branches.length > 0 ? (
          <section className="mt-8">
            <h2 className="text-section font-bold tracking-[-0.035em] sm:text-2xl">
              Где забрать
            </h2>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {branches.map((branch) => {
                const hours = formatWorkingHours(branch);

                return (
                  <div
                    key={branch.id}
                    className="rounded-card-lg bg-surface p-5 shadow-soft"
                  >
                    <h3 className="truncate text-body font-bold">
                      {branch.name}
                    </h3>

                    <p className="mt-1 text-caption leading-5 text-muted">
                      {branch.address}
                    </p>

                    {hours ? (
                      <p className="mt-2 text-caption font-semibold text-primary-strong">
                        {hours}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* Предложения */}
        <section className="mt-10">
          <h2 className="text-section font-bold tracking-[-0.035em] sm:text-2xl">
            Предложения
          </h2>

          {offers.length === 0 ? (
            <div className="mt-4 rounded-card-lg bg-surface px-6 py-12 text-center shadow-soft">
              <div aria-hidden="true" className="text-5xl">
                🥐
              </div>

              <h3 className="mt-4 text-section font-bold tracking-[-0.03em]">
                Сейчас здесь пусто
              </h3>

              <p className="mx-auto mt-2 max-w-md text-body leading-6 text-muted">
                Подпишитесь — пришлём уведомление, как только
                «{business.name}» выставит новую скидку.
              </p>
            </div>
          ) : (
            <div className="mt-4 grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
              {offers.map((offer) => (
                <OfferCard key={offer.id} offer={offer} />
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
