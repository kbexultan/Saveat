"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import OfferCard, {
  type Offer,
} from "@/components/OfferCard";

import type { Category } from "@/lib/categories";

/** Псевдо-категория «показать всё». Не пересекается со slug'ами справочника. */
const ALL = "all";

export default function CategoryFilter({
  offers,
  categories,
}: {
  offers: Offer[];
  categories: Category[];
}) {
  const [active, setActive] = useState<string>(ALL);

  /*
    Рисуем только те категории, в которых реально есть предложения.
    Пустая кнопка ведёт в никуда и читается как поломка, а состав
    каталога меняется каждый день — держать фиксированный список
    кнопок смысла нет.
  */
  const chips = useMemo(() => {
    const counts = new Map<string, number>();

    for (const offer of offers) {
      if (!offer.category) {
        continue;
      }

      counts.set(
        offer.category,
        (counts.get(offer.category) ?? 0) + 1,
      );
    }

    const known = categories
      .filter((category) => counts.has(category.slug))
      .map((category) => ({
        ...category,
        count: counts.get(category.slug) ?? 0,
      }));

    return [
      { slug: ALL, label: "Все", count: offers.length },
      ...known,
    ];
  }, [offers, categories]);

  const visibleOffers =
    active === ALL
      ? offers
      : offers.filter(
          (offer) => offer.category === active,
        );

  const activeLabel =
    chips.find((chip) => chip.slug === active)?.label ?? "Все";

  return (
    <>
      {/* Категории: горизонтальная лента, без горизонтального скролла страницы */}
      <div className="saveat-hscroll -mx-5 mt-7 flex snap-x gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:mt-10 sm:flex-wrap sm:gap-3 sm:overflow-visible sm:px-0">
        {chips.map((chip) => {
          const isActive = chip.slug === active;

          return (
            <button
              key={chip.slug}
              type="button"
              aria-pressed={isActive}
              onClick={() => setActive(chip.slug)}
              className={`min-h-11 flex-none snap-start rounded-pill px-5 text-body font-semibold transition ${
                isActive
                  ? "bg-ink text-white"
                  : "bg-surface text-muted shadow-soft hover:bg-surface-blush hover:text-primary-strong"
              }`}
            >
              {chip.label}

              <span
                className={`ml-2 text-caption font-bold ${
                  isActive ? "text-white/70" : "text-subtle"
                }`}
              >
                {chip.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Заголовок списка */}
      <div className="mt-9 flex flex-wrap items-end justify-between gap-4 sm:mt-12">
        <div>
          <h3 className="text-section font-bold tracking-[-0.035em] sm:text-2xl">
            {active === ALL
              ? "Предложения рядом"
              : activeLabel}
          </h3>

          <p className="mt-1 text-caption text-subtle sm:text-sm">
            Заберите сегодня до закрытия
          </p>
        </div>

        <Link
          href="/map"
          className="inline-flex min-h-11 items-center gap-2 rounded-chip bg-surface px-4 text-body font-semibold text-primary-strong shadow-soft transition hover:bg-surface-blush sm:px-5"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M20 10C20 15 12 22 12 22C12 22 4 15 4 10C4 5.58 7.58 2 12 2C16.42 2 20 5.58 20 10Z"
              stroke="currentColor"
              strokeWidth="1.8"
            />

            <circle
              cx="12"
              cy="10"
              r="3"
              stroke="currentColor"
              strokeWidth="1.8"
            />
          </svg>

          На карте
        </Link>
      </div>

      {/* Пустое состояние: каталог пуст целиком */}
      {offers.length === 0 && (
        <div className="mt-7 rounded-card-lg bg-surface px-6 py-12 text-center shadow-soft">
          <div className="text-4xl">🍰</div>

          <h4 className="mt-4 text-section font-bold">
            Пока нет активных предложений
          </h4>

          <p className="mt-2 text-body leading-6 text-muted">
            Новые предложения появятся здесь, когда
            заведения опубликуют остатки.
          </p>
        </div>
      )}

      {/* Пустое состояние: пусто только в выбранной категории */}
      {offers.length > 0 && visibleOffers.length === 0 && (
        <div className="mt-7 rounded-card-lg bg-surface px-6 py-12 text-center shadow-soft">
          <div className="text-4xl">🔍</div>

          <h4 className="mt-4 text-section font-bold">
            В категории «{activeLabel}» пока пусто
          </h4>

          <p className="mt-2 text-body leading-6 text-muted">
            Попробуйте другую категорию или посмотрите все предложения.
          </p>

          <button
            type="button"
            onClick={() => setActive(ALL)}
            className="mt-6 inline-flex min-h-12 items-center justify-center rounded-chip bg-primary px-6 text-body font-bold text-white shadow-primary transition hover:bg-primary-strong"
          >
            Показать все
          </button>
        </div>
      )}

      {/* Предложения */}
      {visibleOffers.length > 0 && (
        <div className="mt-6 grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
          {visibleOffers.map((offer) => (
            <OfferCard
              key={offer.id}
              offer={offer}
            />
          ))}
        </div>
      )}
    </>
  );
}
