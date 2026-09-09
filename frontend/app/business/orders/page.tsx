"use client";

import Link from "next/link";

import {
  useEffect,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  useAuth,
} from "@/components/AuthProvider";

import {
  useBusiness,
} from "@/components/BusinessProvider";


const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:8001";


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


function formatTime(
  value: string,
) {
  return new Intl.DateTimeFormat(
    "ru-RU",
    {
      timeZone:
        "Asia/Almaty",

      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(
    new Date(value),
  );
}


function formatDate(
  value: string,
) {
  return new Intl.DateTimeFormat(
    "ru-RU",
    {
      timeZone:
        "Asia/Almaty",

      day: "2-digit",
      month: "long",

      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(
    new Date(value),
  );
}


function statusName(
  status: string,
) {
  switch (status) {
    case "reserved":
      return "Ожидает получения";

    case "ready":
      return "Готов";

    case "picked_up":
      return "Выдан";

    case "cancelled":
      return "Отменён";

    case "paid":
      return "Оплачен";

    default:
      return status;
  }
}


export default function BusinessOrdersPage() {
  const router =
    useRouter();

  const {
    user,
    loading: authLoading,
  } = useAuth();

  const {
    selectedMembership,
    loading: businessLoading,
  } = useBusiness();

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


  useEffect(() => {
    if (
      authLoading ||
      businessLoading
    ) {
      return;
    }

    if (!user) {
      router.replace(
        "/business/login",
      );

      return;
    }

    if (
      !selectedMembership
    ) {
      router.replace(
        "/business",
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
          "/business/login",
        );

        return;
      }

      try {
        setLoading(true);
        setError("");

        const businessId =
          selectedMembership!
            .business.id;

        const response =
          await fetch(
            `${API_URL}/business-orders/${businessId}`,
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
            "/business/login",
          );

          return;
        }

        if (
          response.status ===
          403
        ) {
          throw new Error(
            "У вас нет доступа к заказам этого бизнеса.",
          );
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
        setError(
          err instanceof Error
            ? err.message
            : "Произошла ошибка.",
        );
      } finally {
        setLoading(false);
      }
    }

    void loadOrders();

  }, [
    authLoading,
    businessLoading,
    user,
    selectedMembership,
    router,
  ]);


  if (
    authLoading ||
    businessLoading ||
    !selectedMembership
  ) {
    return (
      <main className="min-h-screen bg-[#F5ECE4] p-10 text-center text-[#3B2F2F]">
        Загружаем...
      </main>
    );
  }


  const business =
    selectedMembership.business;


  return (
    <main className="min-h-screen bg-[#F5ECE4] text-[#3B2F2F]">
      <header className="border-b border-[#E4D5CB] bg-[#FFFDF9]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div>
            <Link
              href="/business/dashboard"
              className="text-2xl font-black text-[#D87979]"
            >
              SAVEAT
            </Link>

            <p className="text-xs text-[#947D73]">
              Business
            </p>
          </div>

          <Link
            href="/business/dashboard"
            className="rounded-xl border border-[#D9C5B7] px-4 py-2.5 text-sm font-semibold transition hover:bg-[#F8EEE6]"
          >
            ← Кабинет
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <div>
          <p className="text-sm font-semibold text-[#C5686D]">
            {business.name}
          </p>

          <h1 className="mt-1 text-3xl font-black">
            Заказы
          </h1>

          <p className="mt-2 text-sm text-[#806E68]">
            Бронирования покупателей
            во всех филиалах бизнеса.
          </p>
        </div>

        {error && (
          <div className="mt-6 rounded-2xl bg-[#FBE3E1] p-4 text-sm font-medium text-[#A64F55]">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-8 rounded-[28px] bg-[#FFFDF9] p-8">
            Загружаем заказы...
          </div>
        ) : orders.length ===
            0 ? (
          <div className="mt-8 rounded-[28px] border border-[#DFC2AA] bg-[#FFFDF9] p-10 text-center">
            <div className="text-4xl">
              📦
            </div>

            <h2 className="mt-4 text-xl font-bold">
              Заказов пока нет
            </h2>

            <p className="mt-2 text-sm text-[#806E68]">
              Когда покупатель
              забронирует предложение,
              заказ появится здесь.
            </p>
          </div>
        ) : (
          <div className="mt-8 space-y-5">
            {orders.map(
              (order) => {
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

                return (
                  <article
                    key={
                      order.id
                    }
                    className="rounded-[28px] border border-[#E4D5CB] bg-[#FFFDF9] p-6 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-5">
                      <div>
                        <p className="text-sm text-[#947D73]">
                          {
                            order.branch_name
                          }
                        </p>

                        <h2 className="mt-1 text-xl font-bold">
                          Заказ №
                          {order.id
                            .slice(
                              0,
                              8,
                            )
                            .toUpperCase()}
                        </h2>

                        <p className="mt-1 text-xs text-[#A18C84]">
                          {formatDate(
                            order.created_at,
                          )}
                        </p>
                      </div>

                      <span className="rounded-full bg-[#F7DFDC] px-3 py-1.5 text-xs font-semibold text-[#B85F68]">
                        {statusName(
                          order.status,
                        )}
                      </span>
                    </div>

                    <div className="mt-5 overflow-hidden rounded-2xl border border-[#EADFD6]">
                      {order.items.map(
                        (
                          item,
                          index,
                        ) => (
                          <div
                            key={
                              item.id
                            }
                            className={`flex items-center justify-between gap-4 p-4 ${
                              index !==
                              order.items
                                .length -
                                1
                                ? "border-b border-[#EADFD6]"
                                : ""
                            }`}
                          >
                            <div>
                              <p className="font-semibold">
                                {item.product_name ??
                                  item.offer_title}
                              </p>

                              <p className="mt-1 text-sm text-[#806E68]">
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

                    <div className="mt-5 grid gap-3 sm:grid-cols-4">
                      <div className="rounded-2xl bg-[#FAF1E8] p-4">
                        <p className="text-xs text-[#927B71]">
                          Сумма
                        </p>

                        <p className="mt-1 font-bold">
                          {Number(
                            order.total_price,
                          ).toLocaleString(
                            "ru-RU",
                          )}{" "}
                          ₸
                        </p>
                      </div>

                      <div className="rounded-2xl bg-[#FAF1E8] p-4">
                        <p className="text-xs text-[#927B71]">
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
                        <p className="text-xs text-[#927B71]">
                          Получение
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

                      <div className="rounded-2xl bg-[#FFF2EF] p-4">
                        <p className="text-xs text-[#A77973]">
                          Код
                        </p>

                        <p className="mt-1 font-black text-[#C5686D]">
                          {
                            order.pickup_code
                          }
                        </p>
                      </div>
                    </div>

                    <p className="mt-4 text-sm text-[#806E68]">
                      📍{" "}
                      {
                        order.address
                      }
                    </p>
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