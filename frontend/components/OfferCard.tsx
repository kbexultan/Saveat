"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/components/AuthProvider";

export type Offer = {
  id: string;

  title: string;
  description: string | null;

  original_price: string | number;
  sale_price: string | number;

  quantity_remaining: number;

  pickup_start: string;
  pickup_end: string;

  type: string;
  status: string;

  product_id: string | null;
  product_name: string | null;
  product_image_url: string | null;
  category: string | null;

  branch_id: string;
  branch_name: string;
  address: string;

  latitude: number | null;
  longitude: number | null;

  business_id: string;
  business_name: string;
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:8001";

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

  if (
    value.includes("dessert") ||
    value.includes("десерт")
  ) {
    return "🍰";
  }

  if (
    value.includes("bakery") ||
    value.includes("выпеч")
  ) {
    return "🥐";
  }

  if (
    value.includes("coffee") ||
    value.includes("кофе")
  ) {
    return "☕";
  }

  if (value.includes("mystery")) {
    return "🎁";
  }

  return "🍴";
}

export default function OfferCard({
  offer,
}: {
  offer: Offer;
}) {
  const router = useRouter();

  const { user, loading: authLoading } =
    useAuth();

  const [quantity, setQuantity] =
    useState(1);

  // ВАЖНО:
  // теперь остаток хранится локально.
  // Поэтому после заказа нам не нужно
  // refresh всей страницы.
  const [remaining, setRemaining] =
    useState(offer.quantity_remaining);

  const [reserving, setReserving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  const originalPrice = Number(
    offer.original_price,
  );

  const salePrice = Number(
    offer.sale_price,
  );

  const discount = calculateDiscount(
    originalPrice,
    salePrice,
  );

  const totalPrice =
    salePrice * quantity;

  const pickup = `${formatPickupTime(
    offer.pickup_start,
  )}–${formatPickupTime(
    offer.pickup_end,
  )}`;

  const maxQuantity = Math.min(
    remaining,
    20,
  );

  function decreaseQuantity() {
    setQuantity((current) =>
      Math.max(1, current - 1),
    );

    setMessage("");
    setError("");
  }

  function increaseQuantity() {
    setQuantity((current) =>
      Math.min(
        maxQuantity,
        current + 1,
      ),
    );

    setMessage("");
    setError("");
  }

  async function handleReserve() {
    setMessage("");
    setError("");

    if (authLoading) {
      return;
    }

    if (!user) {
      router.push("/login");
      return;
    }

    const token =
      localStorage.getItem(
        "access_token",
      );

    if (!token) {
      router.push("/login");
      return;
    }

    if (
      quantity < 1 ||
      quantity > remaining
    ) {
      setError(
        "Такого количества уже нет.",
      );

      return;
    }

    try {
      setReserving(true);

      const orderedQuantity =
        quantity;

      const response = await fetch(
        `${API_URL}/orders`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${token}`,
          },

          body: JSON.stringify({
            offer_id: offer.id,
            quantity:
              orderedQuantity,
          }),
        },
      );

      const data =
        await response.json();

      if (!response.ok) {
        if (
          response.status === 409
        ) {
          throw new Error(
            "Такого количества уже нет в наличии.",
          );
        }

        if (
          response.status === 401
        ) {
          localStorage.removeItem(
            "access_token",
          );

          router.push("/login");
          return;
        }

        throw new Error(
          typeof data.detail ===
            "string"
            ? data.detail
            : "Не удалось создать заказ.",
        );
      }

      // Уменьшаем только эту карточку.
      // Никакого router.refresh().
      setRemaining(
        (current) =>
          Math.max(
            0,
            current -
              orderedQuantity,
          ),
      );

      setQuantity(1);

      setMessage(
        `Забронировано: ${orderedQuantity} шт.`,
      );
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(
          "Не удалось создать заказ.",
        );
      }
    } finally {
      setReserving(false);
    }
  }

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-[28px] border border-[#E7DDD2] bg-[#FFFDF9] shadow-[0_10px_35px_rgba(90,65,55,0.06)]">
      {/* Фото */}
      <div className="relative flex h-52 shrink-0 items-center justify-center overflow-hidden bg-[#F5E4E1]">
        {offer.product_image_url ? (
          <img
            src={
              offer.product_image_url
            }
            alt={
              offer.product_name ??
              offer.title
            }
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-7xl">
            {getEmoji(
              offer.category,
            )}
          </span>
        )}

        <span className="absolute right-4 top-4 rounded-full bg-[#D97A7A] px-3 py-1.5 text-xs font-bold text-white shadow-sm">
          -{discount}%
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <p className="text-sm font-medium text-[#A18C84]">
          {offer.business_name}
        </p>

        <h4 className="mt-1 text-xl font-semibold text-[#3B2F2F]">
          {offer.product_name ??
            offer.title}
        </h4>

        <p className="mt-1 text-xs text-[#9A8982]">
          {offer.branch_name}
        </p>

        {/* Цена */}
        <div className="mt-4 flex items-end gap-2">
          <span className="text-2xl font-bold text-[#3B2F2F]">
            {salePrice.toLocaleString(
              "ru-RU",
            )}{" "}
            ₸
          </span>

          <span className="pb-1 text-sm text-[#AFA09A] line-through">
            {originalPrice.toLocaleString(
              "ru-RU",
            )}{" "}
            ₸
          </span>
        </div>

        {/* Информация */}
        <div className="mt-5 space-y-3 rounded-2xl bg-[#FAF5EF] p-4 text-sm text-[#76635E]">
          <div className="flex items-center justify-between gap-3">
            <span>Забрать</span>

            <span className="font-medium text-[#4C3C3C]">
              {pickup}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span>Осталось</span>

            <span className="font-medium text-[#B85F68]">
              {remaining} шт.
            </span>
          </div>

          <div className="border-t border-[#EADFD6] pt-3">
            <p className="text-xs">
              📍 {offer.address}
            </p>
          </div>
        </div>

        {/* Количество */}
        <div className="mt-5 rounded-2xl border border-[#EADFD6] bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[#6F5B55]">
              Количество
            </span>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={
                  decreaseQuantity
                }
                disabled={
                  quantity <= 1 ||
                  reserving ||
                  remaining <= 0
                }
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#DDCEC3] bg-[#FFFDF9] text-lg font-semibold disabled:opacity-40"
              >
                −
              </button>

              <span className="min-w-6 text-center font-bold">
                {remaining <= 0
                  ? 0
                  : quantity}
              </span>

              <button
                type="button"
                onClick={
                  increaseQuantity
                }
                disabled={
                  quantity >=
                    maxQuantity ||
                  reserving ||
                  remaining <= 0
                }
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#DDCEC3] bg-[#FFFDF9] text-lg font-semibold disabled:opacity-40"
              >
                +
              </button>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-[#EEE4DC] pt-3">
            <span className="text-sm text-[#8B7770]">
              Итого
            </span>

            <span className="text-lg font-bold">
              {remaining <= 0
                ? "0"
                : totalPrice.toLocaleString(
                    "ru-RU",
                  )}{" "}
              ₸
            </span>
          </div>
        </div>

        {/* Тут высота всегда одинаковая */}
        <div className="mt-3 flex min-h-[48px] items-center">
          {message && (
            <p className="text-sm font-medium text-[#587852]">
              ✓ {message}
            </p>
          )}

          {error && (
            <p className="text-sm font-medium text-[#A64F55]">
              {error}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={handleReserve}
          disabled={
            reserving ||
            authLoading ||
            remaining <= 0
          }
          className="mt-auto w-full rounded-2xl bg-[#D97A7A] py-3.5 font-semibold text-white transition-colors hover:bg-[#C96868] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {reserving
            ? "Бронируем..."
            : remaining <= 0
              ? "Распродано"
              : `Забронировать · ${totalPrice.toLocaleString(
                  "ru-RU",
                )} ₸`}
        </button>
      </div>
    </article>
  );
}