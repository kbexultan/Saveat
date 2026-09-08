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

function calculateDiscount(
  originalPrice: number,
  salePrice: number,
) {
  if (originalPrice <= 0) {
    return 0;
  }

  return Math.round(
    ((originalPrice - salePrice) / originalPrice) * 100,
  );
}

function formatPickupTime(date: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Almaty",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function getEmoji(category: string | null) {
  const normalizedCategory =
    category?.toLowerCase() ?? "";

  if (
    normalizedCategory.includes("dessert") ||
    normalizedCategory.includes("десерт")
  ) {
    return "🍰";
  }

  if (
    normalizedCategory.includes("bakery") ||
    normalizedCategory.includes("выпеч")
  ) {
    return "🥐";
  }

  if (
    normalizedCategory.includes("coffee") ||
    normalizedCategory.includes("кофе")
  ) {
    return "☕";
  }

  return "🍴";
}

export default async function Home() {
  const offers = await getOffers();

  return (
    <main className="min-h-screen bg-[#f1d7be] text-[#3B2F2F]">
      <Header variant="home" />

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="max-w-2xl">
          <div className="mb-5 inline-flex rounded-full bg-[#F4DCDC] px-4 py-2 text-sm font-medium text-[#B85F68]">
            📍 Алматы
          </div>

          <h2 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Забирай вкусную еду
            <span className="text-[#D97A7A]">
              {" "}
              дешевле
            </span>
          </h2>

          <p className="mt-5 max-w-xl text-lg leading-8 text-[#806E68]">
            Кондитерские, кофейни и пекарни продают
            свежие остатки дня со скидкой до 70%.
          </p>
        </div>

        {/* Filters */}
        <div className="mt-10 flex flex-wrap gap-3">
          <button className="rounded-full bg-[#4B3A3A] px-5 py-2.5 text-sm font-medium text-white">
            Все
          </button>

          <button className="rounded-full border border-[#DED2C7] bg-[#FFFDF9] px-5 py-2.5 text-sm font-medium text-[#6E5C5C] transition hover:bg-[#F3E9DF]">
            Десерты
          </button>

          <button className="rounded-full border border-[#DED2C7] bg-[#FFFDF9] px-5 py-2.5 text-sm font-medium text-[#6E5C5C] transition hover:bg-[#F3E9DF]">
            Выпечка
          </button>

          <button className="rounded-full border border-[#DED2C7] bg-[#FFFDF9] px-5 py-2.5 text-sm font-medium text-[#6E5C5C] transition hover:bg-[#F3E9DF]">
            Mystery Box
          </button>
        </div>

        {/* Heading */}
        <div className="mt-12 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h3 className="text-2xl font-semibold">
              Предложения рядом
            </h3>

            <p className="mt-1 text-sm text-[#9A8982]">
              Заберите сегодня до закрытия
            </p>
          </div>

          <Link
            href="/map"
            className="inline-flex items-center gap-2 rounded-xl border border-[#D87979] bg-[#FFFDF9] px-5 py-3 text-sm font-semibold text-[#C96868] transition hover:bg-[#F7E7E1]"
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

            Показать на карте
          </Link>
        </div>

        {/* Empty state */}
        {offers.length === 0 && (
          <div className="mt-8 rounded-[28px] border border-[#DFC2AA] bg-[#FFFDF9] px-6 py-14 text-center">
            <div className="text-4xl">🍰</div>

            <h4 className="mt-4 text-xl font-bold">
              Пока нет активных предложений
            </h4>

            <p className="mt-2 text-sm text-[#806E68]">
              Новые предложения появятся здесь, когда
              заведения опубликуют остатки.
            </p>
          </div>
        )}

        {/* Real offers */}
        <div className="mt-7 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {offers.map((offer) => (
            <OfferCard
              key={offer.id}
              offer={offer}
            />
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-12 border-t border-[#E7DDD2] bg-[#FFFDF9]">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-8 text-sm text-[#9B8982] sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-bold text-[#D97A7A]">
              SAVEAT
            </p>

            <p className="mt-1 text-xs">
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