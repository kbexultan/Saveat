"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import Header from "@/components/Header";
import { useAuth } from "@/components/AuthProvider";

type Order = {
  id: string;
  offer_id: string;

  quantity: number;

  unit_price: string | number;
  total_price: string | number;

  status: string;
  pickup_code: string;

  created_at: string;
  picked_up_at: string | null;

  offer_title: string;

  product_name: string | null;
  product_image_url: string | null;

  business_name: string;
  branch_name: string;
  address: string;

  pickup_start: string;
  pickup_end: string;
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:8001";

function formatTime(date: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Almaty",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Almaty",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

function getStatus(status: string) {
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

export default function OrdersPage() {
  const router = useRouter();

  const {
    user,
    loading: authLoading,
  } = useAuth();

  const [orders, setOrders] =
    useState<Order[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [
    cancellingId,
    setCancellingId,
  ] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      router.replace("/login");
      return;
    }

    async function loadOrders() {
      const token =
        localStorage.getItem(
          "access_token",
        );

      if (!token) {
        router.replace("/login");
        return;
      }

      try {
        setError("");
        setLoading(true);

        const response = await fetch(
          `${API_URL}/orders`,
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          },
        );

        if (response.status === 401) {
          localStorage.removeItem(
            "access_token",
          );

          router.replace("/login");
          return;
        }

        if (!response.ok) {
          throw new Error(
            "Не удалось загрузить заказы.",
          );
        }

        const data =
          await response.json();

        setOrders(data);
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
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
  }, [authLoading, user, router]);

  async function cancelOrder(
    orderId: string,
  ) {
    const token =
      localStorage.getItem(
        "access_token",
      );

    if (!token) {
      router.push("/login");
      return;
    }

    try {
      setError("");
      setCancellingId(orderId);

      const response = await fetch(
        `${API_URL}/orders/${orderId}/cancel`,
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

      if (response.status === 401) {
        localStorage.removeItem(
          "access_token",
        );

        router.push("/login");
        return;
      }

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Не удалось отменить заказ.",
        );
      }

      setOrders((current) =>
        current.map((order) =>
          order.id === orderId
            ? {
                ...order,
                status: "cancelled",
              }
            : order,
        ),
      );
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(
          "Не удалось отменить заказ.",
        );
      }
    } finally {
      setCancellingId(null);
    }
  }

  if (authLoading) {
    return (
      <main className="min-h-screen bg-[#f1d7be] text-[#3B2F2F]">
        <Header variant="home" />

        <section className="mx-auto max-w-5xl px-6 py-12">
          <div className="rounded-[28px] bg-[#FFFDF9] p-8">
            Загружаем...
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f1d7be] text-[#3B2F2F]">
      <Header variant="home" />

      <section className="mx-auto max-w-5xl px-6 py-12">
        {/* Заголовок */}
        <div className="mb-8">
          <p className="text-sm font-medium text-[#C5686D]">
            SAVEAT
          </p>

          <h1 className="mt-1 text-3xl font-bold">
            Мои заказы
          </h1>

          <p className="mt-2 text-[#806E68]">
            Активные и прошлые
            бронирования.
          </p>
        </div>

        {/* Ошибка */}
        {error && (
          <div className="mb-5 rounded-2xl bg-[#FBE3E1] p-4 text-sm font-medium text-[#A64F55]">
            {error}
          </div>
        )}

        {/* Загрузка */}
        {loading && (
          <div className="rounded-[28px] border border-[#DFC2AA] bg-[#FFFDF9] p-8">
            Загружаем заказы...
          </div>
        )}

        {/* Нет заказов */}
        {!loading &&
          orders.length === 0 && (
            <div className="rounded-[28px] border border-[#DFC2AA] bg-[#FFFDF9] px-6 py-14 text-center">
              <div className="text-5xl">
                🛍️
              </div>

              <h2 className="mt-4 text-xl font-bold">
                Пока заказов нет
              </h2>

              <p className="mt-2 text-sm text-[#806E68]">
                Выберите предложение и
                забронируйте еду со
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

        {/* Заказы */}
        {!loading && (
          <div className="space-y-5">
            {orders.map((order) => {
              const totalPrice =
                Number(
                  order.total_price,
                );

              const isCancelled =
                order.status ===
                "cancelled";

              return (
                <article
                  key={order.id}
                  className={`overflow-hidden rounded-[28px] border bg-[#FFFDF9] shadow-[0_15px_45px_rgba(91,60,44,0.07)] ${
                    isCancelled
                      ? "border-[#DDD1C8] opacity-75"
                      : "border-[#DFC2AA]"
                  }`}
                >
                  <div className="grid md:grid-cols-[190px_1fr]">
                    {/* Фото */}
                    <div className="flex h-52 items-center justify-center overflow-hidden bg-[#F5E4E1] md:h-full md:min-h-[330px]">
                      {order.product_image_url ? (
                        <img
                          src={
                            order.product_image_url
                          }
                          alt={
                            order.product_name ??
                            order.offer_title
                          }
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-6xl">
                          🍰
                        </span>
                      )}
                    </div>

                    {/* Контент */}
                    <div className="p-6">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-[#A18C84]">
                            {
                              order.business_name
                            }
                          </p>

                          <h2 className="mt-1 text-xl font-bold">
                            {order.product_name ??
                              order.offer_title}
                          </h2>

                          <p className="mt-1 text-sm text-[#806E68]">
                            {
                              order.branch_name
                            }
                          </p>
                        </div>

                        <span
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                            isCancelled
                              ? "bg-[#EEE8E3] text-[#8C7C75]"
                              : "bg-[#F7DFDC] text-[#B85F68]"
                          }`}
                        >
                          {getStatus(
                            order.status,
                          )}
                        </span>
                      </div>

                      {/* Данные заказа */}
                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
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
                            Количество
                          </p>

                          <p className="mt-1 font-bold">
                            {
                              order.quantity
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
                            Код получения
                          </p>

                          <p className="mt-1 font-bold text-[#C5686D]">
                            {
                              order.pickup_code
                            }
                          </p>
                        </div>
                      </div>

                      {/* Адрес */}
                      <div className="mt-4">
                        <p className="text-sm text-[#806E68]">
                          📍{" "}
                          {order.address}
                        </p>

                        <p className="mt-1 text-xs text-[#A18C84]">
                          Заказ от{" "}
                          {formatDate(
                            order.created_at,
                          )}
                        </p>
                      </div>

                      {/* Отмена */}
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
                          className="mt-5 rounded-xl border border-[#D87979] px-5 py-2.5 text-sm font-semibold text-[#C96868] transition hover:bg-[#F7E7E1] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {cancellingId ===
                          order.id
                            ? "Отменяем..."
                            : "Отменить заказ"}
                        </button>
                      )}

                      {isCancelled && (
                        <p className="mt-5 text-sm font-medium text-[#8C7C75]">
                          Заказ отменён.
                          Количество возвращено
                          в предложение.
                        </p>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}