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
    ((originalPrice -
      salePrice) /
      originalPrice) *
      100,
  );
}

function formatPickupTime(
  date: string,
) {
  return new Intl.DateTimeFormat(
    "ru-RU",
    {
      timeZone:
        "Asia/Almaty",

      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(new Date(date));
}

function getEmoji(
  category: string | null,
) {
  const value =
    category?.toLowerCase() ??
    "";

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

  if (
    value.includes("mystery")
  ) {
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

  const { addItem } =
    useCart();

  const [quantity, setQuantity] =
    useState(1);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  const originalPrice =
    Number(
      offer.original_price,
    );

  const salePrice =
    Number(
      offer.sale_price,
    );

  const discount =
    calculateDiscount(
      originalPrice,
      salePrice,
    );

  const totalPrice =
    salePrice * quantity;

  const maxQuantity =
    Math.min(
      offer.quantity_remaining,
      20,
    );

  const pickup =
    `${formatPickupTime(
      offer.pickup_start,
    )}–${formatPickupTime(
      offer.pickup_end,
    )}`;

  function decreaseQuantity() {
    setQuantity((current) =>
      Math.max(
        1,
        current - 1,
      ),
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

  function handleAddToCart() {
    setMessage("");
    setError("");

    const result =
      addItem(
        offer,
        quantity,
      );

    if (!result.success) {
      setError(
        result.message ??
          "Не удалось добавить товар.",
      );

      return;
    }

    setMessage(
      result.message ??
        "Добавлено в корзину.",
    );

    setQuantity(1);
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

      {/* Контент */}
      <div className="flex flex-1 flex-col p-5">
        <p className="text-sm font-medium text-[#A18C84]">
          {
            offer.business_name
          }
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
            <span>
              Забрать
            </span>

            <span className="font-medium text-[#4C3C3C]">
              {pickup}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span>
              Осталось
            </span>

            <span className="font-medium text-[#B85F68]">
              {
                offer.quantity_remaining
              }{" "}
              шт.
            </span>
          </div>

          <div className="border-t border-[#EADFD6] pt-3">
            <p className="text-xs">
              📍{" "}
              {offer.address}
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
                  quantity <= 1
                }
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#DDCEC3] bg-[#FFFDF9] text-lg font-semibold text-[#5C4949] transition hover:bg-[#F7E7E1] disabled:cursor-not-allowed disabled:opacity-40"
              >
                −
              </button>

              <span className="min-w-6 text-center font-bold">
                {quantity}
              </span>

              <button
                type="button"
                onClick={
                  increaseQuantity
                }
                disabled={
                  quantity >=
                  maxQuantity
                }
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#DDCEC3] bg-[#FFFDF9] text-lg font-semibold text-[#5C4949] transition hover:bg-[#F7E7E1] disabled:cursor-not-allowed disabled:opacity-40"
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
              {totalPrice.toLocaleString(
                "ru-RU",
              )}{" "}
              ₸
            </span>
          </div>
        </div>

        {/* Сообщение */}
        <div className="mt-3 flex min-h-[44px] items-center">
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

        {/* Кнопки */}
        <div className="mt-auto space-y-2">
          <button
            type="button"
            onClick={
              handleAddToCart
            }
            disabled={
              offer.quantity_remaining <=
              0
            }
            className="w-full rounded-2xl bg-[#D97A7A] py-3.5 font-semibold text-white transition-colors hover:bg-[#C96868] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {offer.quantity_remaining <=
            0
              ? "Распродано"
              : "Добавить в корзину"}
          </button>

          {message && (
            <button
              type="button"
              onClick={() =>
                router.push(
                  "/cart",
                )
              }
              className="w-full rounded-2xl border border-[#D87979] py-3 text-sm font-semibold text-[#C96868] transition hover:bg-[#F7E7E1]"
            >
              Перейти в корзину
            </button>
          )}
        </div>
      </div>
    </article>
  );
}