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
import {
  NETWORK_ERROR_MESSAGE,
  isNetworkError,
} from "@/lib/apiErrors";
import {
  type Order,
  describeCancelError,
  describeOrderLoadError,
  formatOrderNumber,
  formatPickupDateWindow,
  getOrderStatusLabel,
  getPaymentMethodLabel,
  getTotalQuantity,
} from "@/lib/orders";


const API_URL =
  process.env
    .NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:8001";


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

        if (!response.ok) {
          // 403 means the order belongs to another customer. The
          // backend sends no order data with it, and neither do we.
          setOrder(null);
          setError(
            describeOrderLoadError(
              response.status,
            ),
          );

          return;
        }

        const data: Order =
          await response.json();

        setOrder(data);
      } catch (err) {
        setError(
          isNetworkError(err)
            ? NETWORK_ERROR_MESSAGE
            : "Не удалось загрузить заказ.",
        );
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

      let data: unknown = null;

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
        setError(
          describeCancelError(
            response.status,
            (
              data as {
                detail?: unknown;
              } | null
            )?.detail,
          ),
        );

        return;
      }

      setOrder(data as Order);
    } catch (err) {
      setError(
        isNetworkError(err)
          ? NETWORK_ERROR_MESSAGE
          : "Не удалось отменить заказ.",
      );
    } finally {
      setCancelling(false);
    }
  }


  const totalQuantity =
    order
      ? getTotalQuantity(order)
      : 0;


  return (
    <main className="saveat-mobile-page min-h-screen bg-sand text-ink">
      <Header variant="home" />

      <section className="saveat-screen mx-auto max-w-4xl px-6 py-12">
        <button
          type="button"
          onClick={() =>
            router.push(
              "/orders",
            )
          }
          className="mb-6 text-sm font-semibold text-[#A45F62] transition hover:text-primary-strong"
        >
          ← Мои заказы
        </button>

        {(loading ||
          authLoading) && (
          <div className="saveat-surface rounded-[28px] bg-[#FFFDF9] p-8">
            Загружаем заказ...
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mb-5 rounded-2xl bg-[#FBE3E1] p-4 text-sm font-medium text-[#A64F55]"
          >
            {error}
          </div>
        )}

        {!loading &&
          order && (
            <>
              {/* Success */}
              {order.status ===
                "reserved" && (
                <div className="mb-6 saveat-surface rounded-[28px] border border-[#CFE1C9] bg-[#F4FAF2] p-6">
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
                        {formatOrderNumber(
                          order.id,
                        )}
                      </p>
                    </div>

                    <span className="rounded-full bg-[#F7DFDC] px-4 py-2 text-sm font-semibold text-[#B85F68]">
                      {getOrderStatusLabel(
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
                        {formatPickupDateWindow(
                          order.pickup_start,
                          order.pickup_end,
                        )}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-[#FAF1E8] p-4">
                      <p className="text-xs text-[#A2877C]">
                        Оплата
                      </p>

                      <p className="mt-1 font-bold">
                        {getPaymentMethodLabel(
                          order.payment_method,
                        )}
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
                      className="mt-6 w-full rounded-2xl border border-[#D87979] py-3.5 font-semibold text-primary-strong transition hover:bg-[#F7E7E1] disabled:opacity-50"
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