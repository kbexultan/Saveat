import Header from "@/components/Header";

import Link from "next/link";

const offers = [
  {
    id: 1,
    business: "Sweet Cake",
    title: "Medovik",
    oldPrice: 2500,
    price: 1500,
    discount: 40,
    pickup: "20:00–21:00",
    remaining: 4,
    emoji: "🍰",
  },
  {
    id: 2,
    business: "Coffee Boom",
    title: "Croissant Box",
    oldPrice: 3200,
    price: 1900,
    discount: 41,
    pickup: "19:30–21:00",
    remaining: 3,
    emoji: "🥐",
  },
  {
    id: 3,
    business: "Dessert Lab",
    title: "Mystery Sweet Box",
    oldPrice: 4500,
    price: 2500,
    discount: 44,
    pickup: "20:30–22:00",
    remaining: 2,
    emoji: "🧁",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f1d7be] text-[#3B2F2F]">
      {/* Header */}
      <Header variant="home" />

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="max-w-2xl">
          <div className="mb-5 inline-flex rounded-full bg-[#F4DCDC] px-4 py-2 text-sm font-medium text-[#B85F68]">
            📍 Алматы
          </div>

          <h2 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Забирай вкусную еду
            <span className="text-[#D97A7A]"> дешевле</span>
          </h2>

          <p className="mt-5 max-w-xl text-lg leading-8 text-[#806E68]">
            Кондитерские, кофейни и пекарни продают свежие остатки дня
            со скидкой до 70%.
          </p>
        </div>

        {/* Filters */}
        <div className="mt-10 flex flex-wrap gap-3">
          <button className="rounded-full bg-[#4B3A3A] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#3B2F2F]">
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

        {/* Offers heading */}
        <div className="mt-12 flex items-end justify-between gap-4">
          <div>
            <h3 className="text-2xl font-semibold">
              Предложения рядом
            </h3>

            <p className="mt-1 text-sm text-[#9A8982]">
              Заберите сегодня до закрытия
            </p>
          </div>

          <button className="hidden text-sm font-medium text-[#C96868] transition hover:text-[#A94F59] sm:block">
            Показать на карте →
          </button>
        </div>

        {/* Cards */}
        <div className="mt-7 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {offers.map((offer) => (
            <article
              key={offer.id}
              className="overflow-hidden rounded-[28px] border border-[#E7DDD2] bg-[#FFFDF9] shadow-[0_10px_35px_rgba(90,65,55,0.06)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_16px_45px_rgba(90,65,55,0.10)]"
            >
              {/* Image */}
              <div className="relative flex h-52 items-center justify-center bg-[#F5E4E1]">
                <span className="text-7xl">
                  {offer.emoji}
                </span>

                <span className="absolute right-4 top-4 rounded-full bg-[#D97A7A] px-3 py-1.5 text-xs font-bold text-white shadow-sm">
                  -{offer.discount}%
                </span>
              </div>

              {/* Content */}
              <div className="p-5">
                <p className="text-sm font-medium text-[#A18C84]">
                  {offer.business}
                </p>

                <h4 className="mt-1 text-xl font-semibold text-[#3B2F2F]">
                  {offer.title}
                </h4>

                {/* Price */}
                <div className="mt-4 flex items-end gap-2">
                  <span className="text-2xl font-bold text-[#3B2F2F]">
                    {offer.price.toLocaleString()} ₸
                  </span>

                  <span className="pb-1 text-sm text-[#AFA09A] line-through">
                    {offer.oldPrice.toLocaleString()} ₸
                  </span>
                </div>

                {/* Info */}
                <div className="mt-5 space-y-3 rounded-2xl bg-[#FAF5EF] p-4 text-sm text-[#76635E]">
                  <div className="flex items-center justify-between gap-3">
                    <span>Забрать</span>

                    <span className="font-medium text-[#4C3C3C]">
                      {offer.pickup}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span>Осталось</span>

                    <span className="font-medium text-[#B85F68]">
                      {offer.remaining} шт.
                    </span>
                  </div>
                </div>

                {/* Reserve */}
                <button className="mt-5 w-full rounded-2xl bg-[#D97A7A] py-3.5 font-semibold text-white transition duration-200 hover:bg-[#C96868] active:scale-[0.98]">
                  Забронировать
                </button>
              </div>
            </article>
          ))}
        </div>

        {/* Mobile map */}
        <button className="mt-8 w-full rounded-2xl border border-[#E2D6CC] bg-[#FFFDF9] py-3 text-sm font-medium text-[#C96868] sm:hidden">
          Показать на карте
        </button>
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