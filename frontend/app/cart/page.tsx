"use client";

import {
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import Header from "@/components/Header";

import {
  useAuth,
} from "@/components/AuthProvider";

import {
  useCart,
} from "@/components/CartProvider";

const API_URL =
  process.env
    .NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:8001";

function formatTime(
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

export default function CartPage() {
  const router = useRouter();

  const {
    user,
    loading: authLoading,
  } = useAuth();

  const {
    items,
    updateQuantity,
    removeItem,
    clearCart,
  } = useCart();

  const [
    checkingOut,
    setCheckingOut,
  ] = useState(false);

  const [error, setError] =
    useState("");

  const totalPrice =
    items.reduce(
      (sum, item) =>
        sum +
        Number(
          item.offer
            .sale_price,
        ) *
          item.quantity,
      0,
    );

  async function checkout() {
    setError("");

    if (authLoading) {
      return;
    }

    if (!user) {
      router.push("/login");
      return;
    }

    if (
      items.length === 0
    ) {
      setError(
        "Корзина пустая.",
      );

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

    try {
      setCheckingOut(true);

      const response =
        await fetch(
          `${API_URL}/orders/checkout`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${token}`,
            },

            body:
              JSON.stringify({
                items:
                  items.map(
                    (item) => ({
                      offer_id:
                        item.offer
                          .id,

                      quantity:
                        item.quantity,
                    }),
                  ),
              }),
          },
        );

      let data:
        | unknown
        | null = null;

      try {
        data =
          await response.json();
      } catch {
        data = null;
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

      if (!response.ok) {
        let message =
          "Не удалось оформить заказ.";

        if (
          data &&
          typeof data ===
            "object" &&
          "detail" in data
        ) {
          const detail =
            (
              data as {
                detail?: unknown;
              }
            ).detail;

          if (
            typeof detail ===
            "string"
          ) {
            message =
              detail;
          }
        }

        throw new Error(
          message,
        );
      }

      clearCart();

      router.push(
        "/orders",
      );
    } catch (err) {
      if (
        err instanceof Error
      ) {
        setError(
          err.message,
        );
      } else {
        setError(
          "Не удалось оформить заказ.",
        );
      }
    } finally {
      setCheckingOut(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f1d7be] text-[#3B2F2F]">
      <Header variant="home" />

      <section className="mx-auto max-w-5xl px-6 py-12">
        <div className="mb-8">
          <p className="text-sm font-medium text-[#C5686D]">
            SAVEAT
          </p>

          <h1 className="mt-1 text-3xl font-bold">
            Корзина
          </h1>

          <p className="mt-2 text-[#806E68]">
            Проверь заказ перед
            бронированием.
          </p>
        </div>

        {/* Пустая корзина */}
        {items.length === 0 && (
          <div className="rounded-[28px] border border-[#DFC2AA] bg-[#FFFDF9] px-6 py-14 text-center">
            <div className="text-5xl">
              🛒
            </div>

            <h2 className="mt-4 text-xl font-bold">
              Корзина пустая
            </h2>

            <p className="mt-2 text-sm text-[#806E68]">
              Добавь сладости со
              скидкой.
            </p>

            <button
              type="button"
              onClick={() =>
                router.push("/")
              }
              className="mt-5 rounded-xl bg-[#D87979] px-5 py-3 font-semibold text-white transition hover:bg-[#C96868]"
            >
              Смотреть предложения
            </button>
          </div>
        )}

        {items.length > 0 && (
          <div className="grid gap-7 lg:grid-cols-[1fr_340px]">
            {/* Товары */}
            <div className="space-y-4">
              {items.map(
                (item) => {
                  const price =
                    Number(
                      item.offer
                        .sale_price,
                    );

                  const itemTotal =
                    price *
                    item.quantity;

                  return (
                    <article
                      key={
                        item.offer
                          .id
                      }
                      className="overflow-hidden rounded-[26px] border border-[#E3D2C5] bg-[#FFFDF9] shadow-[0_12px_35px_rgba(90,65,55,0.05)]"
                    >
                      <div className="grid sm:grid-cols-[150px_1fr]">
                        {/* Фото */}
                        <div className="flex h-48 items-center justify-center overflow-hidden bg-[#F5E4E1] sm:h-full sm:min-h-[190px]">
                          {item.offer
                            .product_image_url ? (
                            <img
                              src={
                                item.offer
                                  .product_image_url
                              }
                              alt={
                                item.offer
                                  .product_name ??
                                item.offer
                                  .title
                              }
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="text-6xl">
                              🍰
                            </span>
                          )}
                        </div>

                        <div className="p-5">
                          <p className="text-sm font-medium text-[#A18C84]">
                            {
                              item.offer
                                .business_name
                            }
                          </p>

                          <h2 className="mt-1 text-xl font-bold">
                            {item.offer
                              .product_name ??
                              item.offer
                                .title}
                          </h2>

                          <p className="mt-1 text-xs text-[#9A8982]">
                            {
                              item.offer
                                .branch_name
                            }
                          </p>

                          <p className="mt-3 text-lg font-bold">
                            {price.toLocaleString(
                              "ru-RU",
                            )}{" "}
                            ₸
                          </p>

                          <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
                            {/* Количество */}
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() =>
                                  updateQuantity(
                                    item.offer
                                      .id,

                                    item.quantity -
                                      1,
                                  )
                                }
                                disabled={
                                  item.quantity <=
                                  1
                                }
                                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#DDCEC3] bg-white text-lg font-semibold disabled:opacity-40"
                              >
                                −
                              </button>

                              <span className="min-w-6 text-center font-bold">
                                {
                                  item.quantity
                                }
                              </span>

                              <button
                                type="button"
                                onClick={() =>
                                  updateQuantity(
                                    item.offer
                                      .id,

                                    item.quantity +
                                      1,
                                  )
                                }
                                disabled={
                                  item.quantity >=
                                  Math.min(
                                    item.offer
                                      .quantity_remaining,
                                    20,
                                  )
                                }
                                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#DDCEC3] bg-white text-lg font-semibold disabled:opacity-40"
                              >
                                +
                              </button>
                            </div>

                            <p className="text-lg font-bold">
                              {itemTotal.toLocaleString(
                                "ru-RU",
                              )}{" "}
                              ₸
                            </p>
                          </div>

                          <div className="mt-4 flex items-center justify-between gap-4 border-t border-[#EEE2D8] pt-4">
                            <p className="text-xs text-[#8D7770]">
                              Осталось:{" "}
                              {
                                item.offer
                                  .quantity_remaining
                              }{" "}
                              шт.
                            </p>

                            <button
                              type="button"
                              onClick={() =>
                                removeItem(
                                  item.offer
                                    .id,
                                )
                              }
                              className="text-sm font-semibold text-[#C96868] transition hover:text-[#A94F55]"
                            >
                              Удалить
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                },
              )}
            </div>

            {/* Checkout */}
            <aside className="h-fit rounded-[28px] border border-[#DFC2AA] bg-[#FFFDF9] p-6 shadow-[0_15px_45px_rgba(91,60,44,0.07)] lg:sticky lg:top-6">
              <h2 className="text-xl font-bold">
                Ваш заказ
              </h2>

              {items[0] && (
                <div className="mt-4 rounded-2xl bg-[#FAF1E8] p-4">
                  <p className="text-xs text-[#A2877C]">
                    Получение
                  </p>

                  <p className="mt-1 font-semibold">
                    {
                      items[0]
                        .offer
                        .business_name
                    }
                  </p>

                  <p className="mt-1 text-sm text-[#806E68]">
                    {
                      items[0]
                        .offer
                        .branch_name
                    }
                  </p>

                  <p className="mt-2 text-xs text-[#806E68]">
                    📍{" "}
                    {
                      items[0]
                        .offer
                        .address
                    }
                  </p>
                </div>
              )}

              {items[0] && (
                <div className="mt-4 rounded-2xl bg-[#FAF1E8] p-4">
                  <p className="text-xs text-[#A2877C]">
                    Время получения
                  </p>

                  <p className="mt-1 font-semibold">
                    {formatTime(
                      items[0]
                        .offer
                        .pickup_start,
                    )}
                    –
                    {formatTime(
                      items[0]
                        .offer
                        .pickup_end,
                    )}
                  </p>
                </div>
              )}

              {/* Оплата */}
              <div className="mt-4">
                <p className="text-sm font-semibold">
                  Способ оплаты
                </p>

                <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-2xl border border-[#D87979] bg-[#FFF8F6] p-4">
                  <input
                    type="radio"
                    checked
                    readOnly
                    className="h-4 w-4 accent-[#D87979]"
                  />

                  <div>
                    <p className="font-semibold">
                      При получении
                    </p>

                    <p className="mt-0.5 text-xs text-[#8D7770]">
                      Оплатите заказ в
                      заведении
                    </p>
                  </div>
                </label>
              </div>

              {/* Итого */}
              <div className="mt-6 border-t border-[#EADFD6] pt-5">
                <div className="flex items-center justify-between">
                  <span className="text-[#806E68]">
                    Итого
                  </span>

                  <span className="text-2xl font-bold">
                    {totalPrice.toLocaleString(
                      "ru-RU",
                    )}{" "}
                    ₸
                  </span>
                </div>
              </div>

              {error && (
                <div className="mt-4 rounded-xl bg-[#FBE3E1] px-3 py-3 text-sm text-[#A64F55]">
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={checkout}
                disabled={
                  checkingOut ||
                  authLoading
                }
                className="mt-6 w-full rounded-2xl bg-[#D87979] py-3.5 font-semibold text-white transition hover:bg-[#C96868] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {checkingOut
                  ? "Оформляем..."
                  : "Подтвердить бронирование"}
              </button>

              {!user &&
                !authLoading && (
                  <p className="mt-3 text-center text-xs text-[#8D7770]">
                    Для оформления
                    потребуется войти в
                    аккаунт.
                  </p>
                )}
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}