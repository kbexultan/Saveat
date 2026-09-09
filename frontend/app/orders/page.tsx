"use client";

import {
  useEffect,
  useState,
} from "react";

import {
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


function getPaymentMethod(
  method: string,
) {
  if (
    method ===
    "pay_on_pickup"
  ) {
    return "При получении";
  }

  return method;
}


export default function OrdersPage() {
  const router = useRouter();

  const {
    user,
    loading: authLoading,
  } = useAuth();

  const [
    orders,
    setOrders,
  ] = useState<Order[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    cancellingId,
    setCancellingId,
  ] = useState<
    string | null
  >(null);


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

    async function loadOrders() {
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
        setError("");
        setLoading(true);

        const response =
          await fetch(
            `${API_URL}/orders`,
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            },
          );

        if (
          response.status === 401
        ) {
          localStorage.removeItem(
            "access_token",
          );

          router.replace(
            "/login",
          );

          return;
        }

        if (!response.ok) {
          throw new Error(
            "Не удалось загрузить заказы.",
          );
        }

        const data: Order[] =
          await response.json();

        setOrders(data);
      } catch (err) {
        if (
          err instanceof Error
        ) {
          setError(
            err.message,
          );
        } else {
          setError(
            "Не удалось загрузить заказы.",
          );
        }
      } finally {
        setLoading(false);
      }
    }

    void loadOrders();

  }, [
    authLoading,
    user,
    router,
  ]);


  async function cancelOrder(
    orderId: string,
  ) {
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
      setError("");
      setCancellingId(
        orderId,
      );

      const response =
        await fetch(
          `${API_URL}/orders/${orderId}/cancel`,
          {
            method: "POST",

            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          },
        );

      let data:
        | {
            detail?: string;
          }
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

        router.push(
          "/login",
        );

        return;
      }

      if (!response.ok) {
        throw new Error(
          data?.detail ??
            "Не удалось отменить заказ.",
        );
      }

      setOrders(
        (current) =>
          current.map(
            (order) =>
              order.id ===
              orderId
                ? {
                    ...order,
                    status:
                      "cancelled",
                  }
                : order,
          ),
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
          "Не удалось отменить заказ.",
        );
      }
    } finally {
      setCancellingId(
        null,
      );
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
            Мои заказы
          </h1>

          <p className="mt-2 text-[#806E68]">
            Ваши текущие и прошлые
            бронирования.
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-2xl bg-[#FBE3E1] p-4 text-sm font-medium text-[#A64F55]">
            {error}
          </div>
        )}

        {(authLoading ||
          loading) && (
          <div className="rounded-[28px] border border-[#DFC2AA] bg-[#FFFDF9] p-8">
            Загружаем заказы...
          </div>
        )}

        {!authLoading &&
          !loading &&
          orders.length ===
            0 && (
            <div className="rounded-[28px] border border-[#DFC2AA] bg-[#FFFDF9] px-6 py-14 text-center">
              <div className="text-5xl">
                🛍️
              </div>

              <h2 className="mt-4 text-xl font-bold">
                Пока заказов нет
              </h2>

              <p className="mt-2 text-sm text-[#806E68]">
                Найдите сладости со
                скидкой и добавьте их
                в корзину.
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

        {!authLoading &&
          !loading && (
            <div className="space-y-6">
              {orders.map(
                (order) => {
                  const totalPrice =
                    Number(
                      order.total_price,
                    );

                  const totalQuantity =
                    order.items.reduce(
                      (
                        sum,
                        item,
                      ) =>
                        sum +
                        item.quantity,
                      0,
                    );

                  const isCancelled =
                    order.status ===
                    "cancelled";

                  return (
                    <article
                      key={
                        order.id
                      }
                      className={`overflow-hidden rounded-[28px] border bg-[#FFFDF9] shadow-[0_15px_45px_rgba(91,60,44,0.07)] ${
                        isCancelled
                          ? "border-[#DDD1C8] opacity-75"
                          : "border-[#DFC2AA]"
                      }`}
                    >
                      <div className="p-6">
                        {/* Header заказа */}
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-medium text-[#A18C84]">
                              {
                                order.business_name
                              }
                            </p>

                            <h2 className="mt-1 text-xl font-bold">
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

                          <span
                            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                              isCancelled
                                ? "bg-[#EEE8E3] text-[#8C7C75]"
                                : order.status ===
                                    "picked_up"
                                  ? "bg-[#E4F0E1] text-[#587852]"
                                  : "bg-[#F7DFDC] text-[#B85F68]"
                            }`}
                          >
                            {getStatus(
                              order.status,
                            )}
                          </span>
                        </div>

                        {/* Товары */}
                        <div className="mt-6 overflow-hidden rounded-2xl border border-[#EADFD6]">
                          {order.items.map(
                            (
                              item,
                              index,
                            ) => {
                              const itemPrice =
                                Number(
                                  item.total_price,
                                );

                              return (
                                <div
                                  key={
                                    item.id
                                  }
                                  className={`flex items-center gap-4 p-4 ${
                                    index !==
                                    order
                                      .items
                                      .length -
                                      1
                                      ? "border-b border-[#EADFD6]"
                                      : ""
                                  }`}
                                >
                                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#F5E4E1]">
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
                                      <span className="text-3xl">
                                        🍰
                                      </span>
                                    )}
                                  </div>

                                  <div className="min-w-0 flex-1">
                                    <p className="font-semibold">
                                      {item.product_name ??
                                        item.offer_title}
                                    </p>

                                    <p className="mt-1 text-sm text-[#8C7870]">
                                      {
                                        item.quantity
                                      }{" "}
                                      ×{" "}
                                      {Number(
                                        item.unit_price,
                                      ).toLocaleString(
                                        "ru-RU",
                                      )}{" "}
                                      ₸
                                    </p>
                                  </div>

                                  <p className="font-bold">
                                    {itemPrice.toLocaleString(
                                      "ru-RU",
                                    )}{" "}
                                    ₸
                                  </p>
                                </div>
                              );
                            },
                          )}
                        </div>

                        {/* Информация */}
                        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <div className="rounded-2xl bg-[#FAF1E8] p-4">
                            <p className="text-xs text-[#A2877C]">
                              Сумма
                            </p>

                            <p className="mt-1 font-bold">
                              {totalPrice.toLocaleString(
                                "ru-RU",
                              )}{" "}
                              ₸
                            </p>
                          </div>

                          <div className="rounded-2xl bg-[#FAF1E8] p-4">
                            <p className="text-xs text-[#A2877C]">
                              Товаров
                            </p>

                            <p className="mt-1 font-bold">
                              {
                                totalQuantity
                              }{" "}
                              шт.
                            </p>
                          </div>

                          <div className="rounded-2xl bg-[#FAF1E8] p-4">
                            <p className="text-xs text-[#A2877C]">
                              Забрать
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
                              {getPaymentMethod(
                                order.payment_method,
                              )}
                            </p>
                          </div>
                        </div>

                        {/* Pickup code */}
                        {!isCancelled && (
                          <div className="mt-5 rounded-2xl border border-[#E3B8B5] bg-[#FFF6F4] p-5">
                            <p className="text-xs font-medium text-[#A77973]">
                              Код получения
                            </p>

                            <p className="mt-1 text-2xl font-black tracking-[0.12em] text-[#C5686D]">
                              {
                                order.pickup_code
                              }
                            </p>

                            {order.status ===
                              "reserved" && (
                              <p className="mt-2 text-sm text-[#806E68]">
                                Покажите этот
                                код сотруднику
                                при получении.
                              </p>
                            )}
                          </div>
                        )}

                        <div className="mt-5">
                          <p className="text-sm text-[#806E68]">
                            📍{" "}
                            {
                              order.address
                            }
                          </p>

                          <p className="mt-1 text-xs text-[#A18C84]">
                            Оформлен{" "}
                            {formatDate(
                              order.created_at,
                            )}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="mt-5 flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              router.push(
                                `/orders/${order.id}`,
                              )
                            }
                            className="rounded-xl bg-[#D87979] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#C96868]"
                          >
                            Открыть заказ
                          </button>

                          {order.status ===
                            "reserved" && (
                            <button
                              type="button"
                              onClick={() =>
                                cancelOrder(
                                  order.id,
                                )
                              }
                              disabled={
                                cancellingId ===
                                order.id
                              }
                              className="rounded-xl border border-[#D87979] px-5 py-2.5 text-sm font-semibold text-[#C96868] transition hover:bg-[#F7E7E1] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {cancellingId ===
                              order.id
                                ? "Отменяем..."
                                : "Отменить заказ"}
                            </button>
                          )}
                        </div>

                        {isCancelled && (
                          <p className="mt-5 text-sm font-medium text-[#8C7C75]">
                            Заказ отменён.
                            Все товары
                            возвращены в
                            доступный остаток.
                          </p>
                        )}
                      </div>
                    </article>
                  );
                },
              )}
            </div>
          )}
      </section>
    </main>
  );
}