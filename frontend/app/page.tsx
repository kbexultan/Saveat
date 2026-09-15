import Link from "next/link";

import Header from "@/components/Header";

import OfferCard, {
  type Offer,
} from "@/components/OfferCard";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8001";

async function getOffers(): Promise<Offer[]> {
  try {
    const response = await fetch(`${API_URL}/offers/public`, {
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(
        "Failed to load offers:",
        response.status,
      );

      return [];
    }

    return response.json();
  } catch (error) {
    console.error("Failed to connect to backend:", error);

    return [];
  }
}

const categories = [
  "Все",
  "Десерты",
  "Выпечка",
  "Mystery Box",
];

export default async function Home() {
  const offers = await getOffers();

  return (
    <main className="saveat-mobile-page min-h-screen text-ink">
      <Header variant="home" />

      <section className="saveat-screen mx-auto max-w-6xl px-6 py-8 sm:py-14">
        {/* Hero */}
        <div className="saveat-discovery-hero max-w-2xl">
          <div className="mb-5 inline-flex rounded-pill bg-primary-tint px-4 py-2 text-caption font-semibold text-primary-strong">
            📍 Алматы
          </div>

          <h2 className="saveat-screen-title text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Забирай вкусную еду
            <span className="text-primary"> дешевле</span>
          </h2>

          <p className="mt-5 max-w-xl text-lead leading-7 text-muted sm:text-lg sm:leading-8">
            Кондитерские, кофейни и пекарни продают
            свежие остатки дня со скидкой до 70%.
          </p>
        </div>

        {/* Категории: горизонтальная лента, без горизонтального скролла страницы */}
        <div className="saveat-hscroll -mx-5 mt-7 flex snap-x gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:mt-10 sm:flex-wrap sm:gap-3 sm:overflow-visible sm:px-0">
          {categories.map((category, index) => (
            <button
              key={category}
              type="button"
              className={`min-h-11 flex-none snap-start rounded-pill px-5 text-body font-semibold transition ${
                index === 0
                  ? "bg-ink text-white"
                  : "bg-surface text-muted shadow-soft hover:bg-surface-blush hover:text-primary-strong"
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Заголовок списка */}
        <div className="mt-9 flex flex-wrap items-end justify-between gap-4 sm:mt-12">
          <div>
            <h3 className="text-section font-bold tracking-[-0.035em] sm:text-2xl">
              Предложения рядом
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

        {/* Пустое состояние */}
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

        {/* Предложения */}
        <div className="mt-6 grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
          {offers.map((offer) => (
            <OfferCard
              key={offer.id}
              offer={offer}
            />
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-10 bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-caption text-subtle sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:text-sm">
          <div>
            <p className="text-lead font-extrabold tracking-[-0.04em] text-primary">
              SAVEAT
            </p>

            <p className="mt-1 text-meta">
              Save food. Save money.
            </p>
          </div>

          <p>© 2026 SAVEAT</p>

          <p>Спасаем еду вместе.</p>
        </div>
      </footer>
    </main>
  );
}
