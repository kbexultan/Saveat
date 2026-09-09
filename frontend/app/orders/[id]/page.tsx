"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  useParams,
  useRouter,
} from "next/navigation";

import Header from "@/components/Header";
import { useAuth } from "@/components/AuthProvider";


type OrderItem = {
  id: string;
  offer_id: string | null;

  offer_title: string;

  product_name: string | null;
  product_image_url: string | null;

  quantity: number;

  unit_price: string | number;
  total_price: string | number;
};


type Order = {
  id: string;
  user_id: string;
  branch_id: string;

  business_name: string;
  branch_name: string;
  address: string;

  pickup_start: string;
  pickup_end: string;

  total_price: string | number;

  payment_method: string;

  status: string;
  pickup_code: string;

  created_at: string;
  picked_up_at: string | null;

  items: OrderItem[];
};


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


function formatDate(
  date: string,
) {
  return new Intl.DateTimeFormat(
    "ru-RU",
    {
      timeZone:
        "Asia/Almaty",

      day: "2-digit",
      month: "long",
      year: "numeric",

      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(new Date(date));
}


function getStatus(
  status: string,
) {
  switch (status) {
    case "reserved":
      return "Забронирован";

    case "paid":
      return "Оплачен";

    case "ready":
      return "Готов к выдаче";

    case "picked_up":
      return "Получен";

    case "cancelled":
      return "Отменён";

    default:
      return status;
  }
}


export default function OrderPage() {
  const router = useRouter();

  const params =
    useParams<{
      id: string;
    }>();

  const orderId =
    params.id;

  const {
    user,
    loading: authLoading,
  } = useAuth();

  const [
    order,
    setOrder,
  ] = useState<
    Order | null
  >(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    cancelling,
    setCancelling,
  ] = useState(false);


  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      router.replace(
        "/login",
      );

      return;
    }

    async function loadOrder() {
      const token =
        localStorage.getItem(
          "access_token",
        );

      if (!token) {
        router.replace(
          "/login",
        );

        return;
      }

      try {
        setLoading(true);
        setError("");

        const response =
          await fetch(
            `${API_URL}/orders/${orderId}`,
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            },
          );

        if (
          response.status ===
          401
        ) {
          localStorage.removeItem(
            "access_token",
          );

          router.replace(
            "/login",
          );

          return;
        }

        if (
          response.status ===
          404
        ) {
          throw new Error(
            "Заказ не найден.",
          );
        }

        if (!response.ok) {
          throw new Error(
            "Не удалось загрузить заказ.",
          );
        }

        const data: Order =
          await response.json();

        setOrder(data);
      } catch (err) {
        if (
          err instanceof Error
        ) {
          setError(
            err.message,
          );
        } else {
          setError(
            "Не удалось загрузить заказ.",
          );
        }
      } finally {
        setLoading(false);
      }
    }

    void loadOrder();

  }, [
    authLoading,
    user,
    router,
    orderId,
  ]);


  async function cancelOrder() {
    if (!order) {
      return;
    }

    const token =
      localStorage.getItem(
        "access_token",
      );

    if (!token) {
      router.push(
        "/login",
      );

      return;
    }

    try {
      setCancelling(true);
      setError("");

      const response =
        await fetch(
          `${API_URL}/orders/${order.id}/cancel`,
          {
            method: "POST",

            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          },
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail ===
            "string"
            ? data.detail
            : "Не удалось отменить заказ.",
        );
      }

      setOrder(data);
    } catch (err) {
      if (
        err instanceof Error
      ) {
        setError(
          err.message,
        );
      }
    } finally {
      setCancelling(false);
    }
  }


  const totalQuantity =
    order?.items.reduce(
      (sum, item) =>
        sum +
        item.quantity,
      0,
    ) ?? 0;


  return (
    <main className="min-h-screen bg-[#f1d7be] text-[#3B2F2F]">
      <Header variant="home" />

      <section className="mx-auto max-w-4xl px-6 py-12">
        <button
          type="button"
          onClick={() =>
            router.push(
              "/orders",
            )
          }
          className="mb-6 text-sm font-semibold text-[#A45F62] transition hover:text-[#C96868]"
        >
          ← Мои заказы
        </button>

        {(loading ||
          authLoading) && (
          <div className="rounded-[28px] bg-[#FFFDF9] p-8">
            Загружаем заказ...
          </div>
        )}

        {error && (
          <div className="mb-5 rounded-2xl bg-[#FBE3E1] p-4 text-sm font-medium text-[#A64F55]">
            {error}
          </div>
        )}

        {!loading &&
          order && (
            <>
              {/* Success */}
              {order.status ===
                "reserved" && (
                <div className="mb-6 rounded-[28px] border border-[#CFE1C9] bg-[#F4FAF2] p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#DDEED8] text-2xl">
                      ✓
                    </div>

                    <div>
                      <h1 className="text-2xl font-bold text-[#496B46]">
                        Заказ
                        оформлен
                      </h1>

                      <p className="mt-1 text-sm text-[#61795E]">
                        Сладости
                        забронированы.
                        Оплатите их в
                        заведении при
                        получении.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <article className="overflow-hidden rounded-[30px] border border-[#DFC2AA] bg-[#FFFDF9] shadow-[0_15px_45px_rgba(91,60,44,0.07)]">
                <div className="p-7">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-[#A18C84]">
                        {
                          order.business_name
                        }
                      </p>

                      <h2 className="mt-1 text-2xl font-bold">
                        {
                          order.branch_name
                        }
                      </h2>

                      <p className="mt-1 text-sm text-[#806E68]">
                        Заказ №
                        {order.id
                          .slice(
                            0,
                            8,
                          )
                          .toUpperCase()}
                      </p>
                    </div>

                    <span className="rounded-full bg-[#F7DFDC] px-4 py-2 text-sm font-semibold text-[#B85F68]">
                      {getStatus(
                        order.status,
                      )}
                    </span>
                  </div>

                  {/* Pickup code */}
                  {order.status !==
                    "cancelled" && (
                    <div className="mt-7 rounded-[24px] border-2 border-dashed border-[#DFA5A2] bg-[#FFF6F4] p-7 text-center">
                      <p className="text-sm font-medium text-[#9D7772]">
                        Код получения
                      </p>

                      <p className="mt-2 break-all text-3xl font-black tracking-[0.12em] text-[#C5686D] sm:text-4xl">
                        {
                          order.pickup_code
                        }
                      </p>

                      <p className="mx-auto mt-3 max-w-md text-sm text-[#806E68]">
                        Покажите этот
                        код сотруднику
                        заведения.
                      </p>
                    </div>
                  )}

                  {/* Items */}
                  <div className="mt-7">
                    <h3 className="font-bold">
                      Ваш заказ
                    </h3>

                    <div className="mt-3 overflow-hidden rounded-2xl border border-[#EADFD6]">
                      {order.items.map(
                        (
                          item,
                          index,
                        ) => (
                          <div
                            key={
                              item.id
                            }
                            className={`flex items-center gap-4 p-4 ${
                              index !==
                              order.items
                                .length -
                                1
                                ? "border-b border-[#EADFD6]"
                                : ""
                            }`}
                          >
                            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#F5E4E1]">
                              {item.product_image_url ? (
                                <img
                                  src={
                                    item.product_image_url
                                  }
                                  alt={
                                    item.product_name ??
                                    item.offer_title
                                  }
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span className="text-4xl">
                                  🍰
                                </span>
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="font-semibold">
                                {item.product_name ??
                                  item.offer_title}
                              </p>

                              <p className="mt-1 text-sm text-[#806E68]">
                                {
                                  item.quantity
                                }{" "}
                                шт. ×{" "}
                                {Number(
                                  item.unit_price,
                                ).toLocaleString(
                                  "ru-RU",
                                )}{" "}
                                ₸
                              </p>
                            </div>

                            <p className="font-bold">
                              {Number(
                                item.total_price,
                              ).toLocaleString(
                                "ru-RU",
                              )}{" "}
                              ₸
                            </p>
                          </div>
                        ),
                      )}
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="mt-7 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-[#FAF1E8] p-4">
                      <p className="text-xs text-[#A2877C]">
                        Итого
                      </p>

                      <p className="mt-1 text-xl font-bold">
                        {Number(
                          order.total_price,
                        ).toLocaleString(
                          "ru-RU",
                        )}{" "}
                        ₸
                      </p>
                    </div>

                    <div className="rounded-2xl bg-[#FAF1E8] p-4">
                      <p className="text-xs text-[#A2877C]">
                        Товаров
                      </p>

                      <p className="mt-1 text-xl font-bold">
                        {
                          totalQuantity
                        }{" "}
                        шт.
                      </p>
                    </div>

                    <div className="rounded-2xl bg-[#FAF1E8] p-4">
                      <p className="text-xs text-[#A2877C]">
                        Время получения
                      </p>

                      <p className="mt-1 font-bold">
                        {formatTime(
                          order.pickup_start,
                        )}
                        –
                        {formatTime(
                          order.pickup_end,
                        )}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-[#FAF1E8] p-4">
                      <p className="text-xs text-[#A2877C]">
                        Оплата
                      </p>

                      <p className="mt-1 font-bold">
                        При получении
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 rounded-2xl border border-[#EADFD6] p-5">
                    <p className="font-semibold">
                      📍{" "}
                      {
                        order.address
                      }
                    </p>

                    <p className="mt-2 text-sm text-[#806E68]">
                      Оформлен:{" "}
                      {formatDate(
                        order.created_at,
                      )}
                    </p>
                  </div>

                  {order.status ===
                    "reserved" && (
                    <button
                      type="button"
                      onClick={
                        cancelOrder
                      }
                      disabled={
                        cancelling
                      }
                      className="mt-6 w-full rounded-2xl border border-[#D87979] py-3.5 font-semibold text-[#C96868] transition hover:bg-[#F7E7E1] disabled:opacity-50"
                    >
                      {cancelling
                        ? "Отменяем..."
                        : "Отменить заказ"}
                    </button>
                  )}

                  {order.status ===
                    "cancelled" && (
                    <div className="mt-6 rounded-2xl bg-[#EEE8E3] p-4 text-sm font-medium text-[#7C6D67]">
                      Заказ отменён.
                      Товары возвращены
                      в предложение.
                    </div>
                  )}
                </div>
              </article>
            </>
          )}
      </section>
    </main>
  );
}