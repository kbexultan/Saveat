import Header from "@/components/Header";

import CategoryFilter from "@/components/CategoryFilter";

import {
  type Offer,
} from "@/components/OfferCard";

import { fetchCategories } from "@/lib/categories";

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

export default async function Home() {
  // Оба запроса параллельно: последовательно это лишний round-trip
  // к бэкенду на каждый рендер главной.
  //
  // Справочник статический и в БД не ходит, поэтому держим его в кеше
  // час, в отличие от офферов с их cache: "no-store".
  const [offers, categories] = await Promise.all([
    getOffers(),
    fetchCategories({
      next: { revalidate: 3600 },
    }),
  ]);

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

        <CategoryFilter
          offers={offers}
          categories={categories}
        />
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
