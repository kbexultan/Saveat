"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { useCart } from "@/components/CartProvider";

export type Offer = {
  id: string;

  title: string;
  description: string | null;

  original_price:
    | string
    | number;

  sale_price:
    | string
    | number;

  quantity_remaining: number;

  pickup_start: string;
  pickup_end: string;

  type: string;
  status: string;

  product_id: string | null;
  product_name: string | null;
  product_image_url:
    | string
    | null;

  category: string | null;

  branch_id: string;
  branch_name: string;
  address: string;

  latitude: number | null;
  longitude: number | null;

  business_id: string;
  business_name: string;
};

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
  const value = category?.toLowerCase() ?? "";

  if (value.includes("dessert") || value.includes("десерт")) {
    return "🍰";
  }

  if (value.includes("bakery") || value.includes("выпеч")) {
    return "🥐";
  }

  if (value.includes("coffee") || value.includes("кофе")) {
    return "☕";
  }

  if (value.includes("mystery")) {
    return "🎁";
  }

  return "🍴";
}

export default function OfferCard({ offer }: { offer: Offer }) {
  const router = useRouter();

  const { addItem } = useCart();

  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const originalPrice = Number(offer.original_price);
  const salePrice = Number(offer.sale_price);

  const discount = calculateDiscount(originalPrice, salePrice);
  const totalPrice = salePrice * quantity;
  const maxQuantity = Math.min(offer.quantity_remaining, 20);
  const soldOut = offer.quantity_remaining <= 0;

  const pickup = `${formatPickupTime(offer.pickup_start)}–${formatPickupTime(
    offer.pickup_end,
  )}`;

  function decreaseQuantity() {
    setQuantity((current) => Math.max(1, current - 1));

    setMessage("");
    setError("");
  }

  function increaseQuantity() {
    setQuantity((current) => Math.min(maxQuantity, current + 1));

    setMessage("");
    setError("");
  }

  function handleAddToCart() {
    setMessage("");
    setError("");

    const result = addItem(offer, quantity);

    if (!result.success) {
      setError(result.message ?? "Не удалось добавить товар.");

      return;
    }

    setMessage(result.message ?? "Добавлено в корзину.");

    setQuantity(1);
  }

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-card-lg bg-surface shadow-soft transition hover:shadow-card">
      {/* Фото */}
      <div className="relative flex h-44 shrink-0 items-center justify-center overflow-hidden bg-linear-to-br from-sand-deep to-sand-blush sm:h-52">
        {offer.product_image_url ? (
          <img
            src={offer.product_image_url}
            alt={offer.product_name ?? offer.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-6xl sm:text-7xl">{getEmoji(offer.category)}</span>
        )}

        <span className="absolute right-3 top-3 rounded-pill bg-primary px-3 py-1.5 text-caption font-bold text-white shadow-primary">
          −{discount}%
        </span>

        {soldOut ? (
          <span className="absolute left-3 top-3 rounded-pill bg-ink/85 px-3 py-1.5 text-caption font-bold text-white">
            Распродано
          </span>
        ) : null}
      </div>

      {/* Контент */}
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <p className="text-caption font-semibold text-subtle">
          {offer.business_name}
        </p>

        <h4 className="mt-1 text-card font-bold tracking-[-0.03em] text-ink sm:text-xl">
          {offer.product_name ?? offer.title}
        </h4>

        <p className="mt-0.5 text-caption text-subtle">{offer.branch_name}</p>

        {/* Цена */}
        <div className="mt-3 flex items-end gap-2">
          <span className="text-2xl font-extrabold tracking-[-0.05em] tabular-nums text-ink">
            {salePrice.toLocaleString("ru-RU")} ₸
          </span>

          <span className="pb-1 text-caption text-subtle line-through">
            {originalPrice.toLocaleString("ru-RU")} ₸
          </span>
        </div>

        {/* Информация */}
        <div className="mt-4 space-y-2.5 rounded-tile bg-surface-warm p-4 text-body text-muted">
          <div className="flex items-center justify-between gap-3">
            <span>Забрать</span>
            <span className="font-semibold text-ink">{pickup}</span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span>Осталось</span>
            <span className="font-semibold text-primary-strong">
              {offer.quantity_remaining} шт.
            </span>
          </div>

          <p className="pt-1 text-caption leading-5">📍 {offer.address}</p>
        </div>

        {/* Количество */}
        <div className="mt-3 rounded-tile bg-surface-blush p-3">
          <div className="flex items-center justify-between">
            <span className="text-body font-semibold text-muted">Количество</span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={decreaseQuantity}
                disabled={quantity <= 1}
                aria-label="Уменьшить количество"
                className="flex h-11 w-11 items-center justify-center rounded-chip bg-surface text-lg font-bold text-ink shadow-soft transition hover:bg-primary-tint disabled:cursor-not-allowed disabled:opacity-40"
              >
                −
              </button>

              <span className="min-w-8 text-center text-lead font-extrabold tabular-nums">
                {quantity}
              </span>

              <button
                type="button"
                onClick={increaseQuantity}
                disabled={quantity >= maxQuantity}
                aria-label="Увеличить количество"
                className="flex h-11 w-11 items-center justify-center rounded-chip bg-surface text-lg font-bold text-ink shadow-soft transition hover:bg-primary-tint disabled:cursor-not-allowed disabled:opacity-40"
              >
                +
              </button>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-white/70 pt-3">
            <span className="text-body text-muted">Итого</span>

            <span className="text-lead font-extrabold tabular-nums text-ink">
              {totalPrice.toLocaleString("ru-RU")} ₸
            </span>
          </div>
        </div>

        {/* Сообщение */}
        <div className="mt-2 flex min-h-11 items-center">
          {message && (
            <p className="text-body font-semibold text-success-ink">✓ {message}</p>
          )}

          {error && (
            <p className="text-body font-semibold text-danger-ink">{error}</p>
          )}
        </div>

        {/* Кнопки */}
        <div className="mt-auto space-y-2">
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={soldOut}
            className="min-h-13 w-full rounded-chip bg-primary py-3.5 text-body font-bold text-white shadow-primary transition hover:bg-primary-strong disabled:cursor-not-allowed disabled:bg-primary-soft disabled:shadow-none"
          >
            {soldOut ? "Распродано" : "Добавить в корзину"}
          </button>

          {message && (
            <button
              type="button"
              onClick={() => router.push("/cart")}
              className="min-h-12 w-full rounded-chip bg-surface-blush py-3 text-body font-bold text-primary-strong transition hover:bg-primary-tint"
            >
              Перейти в корзину
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
