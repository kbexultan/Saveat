"use client";

import Link from "next/link";

import {
  FormEvent,
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

  offer_id:
    | string
    | null;

  offer_title: string;

  product_name:
    | string
    | null;

  product_image_url:
    | string
    | null;

  quantity: number;

  unit_price:
    | string
    | number;

  total_price:
    | string
    | number;
};


type Order = {
  id: string;

  branch_id: string;

  business_name: string;
  branch_name: string;
  address: string;

  pickup_start: string;
  pickup_end: string;

  total_price:
    | string
    | number;

  payment_method: string;

  status: string;

  pickup_code: string;

  created_at: string;

  picked_up_at:
    | string
    | null;

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


function normalizeCode(
  value: string,
) {
  return value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}


export default function BusinessPickupPage() {
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
    code,
    setCode,
  ] = useState("");

  const [
    order,
    setOrder,
  ] = useState<
    Order | null
  >(null);

  const [
    searching,
    setSearching,
  ] = useState(false);

  const [
    confirming,
    setConfirming,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
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

    if (!selectedMembership) {
      router.replace(
        "/business",
      );
    }

  }, [
    authLoading,
    businessLoading,
    user,
    selectedMembership,
    router,
  ]);


  async function findOrder(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!selectedMembership) {
      return;
    }

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

    const normalized =
      normalizeCode(code);

    if (!normalized) {
      setError(
        "Введите код получения.",
      );

      return;
    }

    try {
      setSearching(true);
      setError("");
      setSuccess("");
      setOrder(null);

      const businessId =
        selectedMembership
          .business.id;

      const response =
        await fetch(
          `${API_URL}/business-orders/${businessId}/pickup/${encodeURIComponent(
            normalized,
          )}`,
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          },
        );

      let data:
        | Order
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
        404
      ) {
        throw new Error(
          "Заказ с таким кодом не найден.",
        );
      }

      if (!response.ok) {
        throw new Error(
          data &&
          "detail" in data &&
          typeof data.detail ===
            "string"
            ? data.detail
            : "Не удалось найти заказ.",
        );
      }

      setOrder(
        data as Order,
      );

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Произошла ошибка.",
      );
    } finally {
      setSearching(false);
    }
  }


  async function confirmPickup() {
    if (
      !selectedMembership ||
      !order
    ) {
      return;
    }

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
      setConfirming(true);
      setError("");
      setSuccess("");

      const businessId =
        selectedMembership
          .business.id;

      const response =
        await fetch(
          `${API_URL}/business-orders/${businessId}/pickup/${encodeURIComponent(
            order.pickup_code,
          )}/confirm`,
          {
            method: "POST",

            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          },
        );

      let data:
        | Order
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
        response.status ===
        409
      ) {
        throw new Error(
          data &&
          "detail" in data &&
          typeof data.detail ===
            "string"
            ? data.detail
            : "Заказ нельзя выдать.",
        );
      }

      if (!response.ok) {
        throw new Error(
          data &&
          "detail" in data &&
          typeof data.detail ===
            "string"
            ? data.detail
            : "Не удалось выдать заказ.",
        );
      }

      setOrder(
        data as Order,
      );

      setSuccess(
        "Заказ успешно выдан.",
      );

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Произошла ошибка.",
      );
    } finally {
      setConfirming(false);
    }
  }


  function reset() {
    setCode("");
    setOrder(null);
    setError("");
    setSuccess("");
  }


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
    selectedMembership
      .business;


  return (
    <main className="min-h-screen bg-[#F5ECE4] text-[#3B2F2F]">
      <header className="border-b border-[#E4D5CB] bg-[#FFFDF9]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
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

          <div className="flex gap-3">
            <Link
              href="/business/orders"
              className="rounded-xl border border-[#D9C5B7] px-4 py-2.5 text-sm font-semibold"
            >
              Заказы
            </Link>

            <Link
              href="/business/dashboard"
              className="rounded-xl border border-[#D9C5B7] px-4 py-2.5 text-sm font-semibold"
            >
              Кабинет
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-10">
        <div className="text-center">
          <p className="text-sm font-semibold text-[#C5686D]">
            {business.name}
          </p>

          <h1 className="mt-2 text-3xl font-black">
            Выдача заказа
          </h1>

          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[#806E68]">
            Введите код, который
            покупатель показывает
            при получении.
          </p>
        </div>

        <form
          onSubmit={findOrder}
          className="mx-auto mt-8 max-w-xl rounded-[28px] border border-[#DFC2AA] bg-[#FFFDF9] p-6"
        >
          <label
            htmlFor="pickupCode"
            className="mb-2 block text-sm font-semibold"
          >
            Код получения
          </label>

          <div className="flex gap-3">
            <input
              id="pickupCode"
              type="text"
              value={code}
              onChange={(event) =>
                setCode(
                  event.target.value
                    .toUpperCase(),
                )
              }
              placeholder="SVT-XXXXXXXXXX"
              autoComplete="off"
              className="min-w-0 flex-1 rounded-2xl border border-[#E3CFC0] bg-white px-4 py-3.5 font-bold tracking-wider outline-none focus:border-[#D87979]"
            />

            <button
              type="submit"
              disabled={searching}
              className="rounded-2xl bg-[#D87979] px-6 font-semibold text-white transition hover:bg-[#C96868] disabled:opacity-60"
            >
              {searching
                ? "Ищем..."
                : "Найти"}
            </button>
          </div>
        </form>

        {error && (
          <div className="mx-auto mt-5 max-w-xl rounded-2xl bg-[#FBE3E1] p-4 text-sm font-medium text-[#A64F55]">
            {error}
          </div>
        )}

        {success && (
          <div className="mx-auto mt-5 max-w-xl rounded-2xl bg-[#E6F3E2] p-4 text-center font-semibold text-[#527150]">
            ✓ {success}
          </div>
        )}

        {order && (
          <article className="mt-7 rounded-[30px] border border-[#DFC2AA] bg-[#FFFDF9] p-7 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm text-[#927B71]">
                  {order.branch_name}
                </p>

                <h2 className="mt-1 text-xl font-black">
                  Заказ №
                  {order.id
                    .slice(
                      0,
                      8,
                    )
                    .toUpperCase()}
                </h2>
              </div>

              <span
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  order.status ===
                  "picked_up"
                    ? "bg-[#E6F3E2] text-[#527150]"
                    : order.status ===
                        "cancelled"
                      ? "bg-[#EEE8E3] text-[#7C6D67]"
                      : "bg-[#F7DFDC] text-[#B85F68]"
                }`}
              >
                {order.status ===
                "picked_up"
                  ? "Выдан"
                  : order.status ===
                      "cancelled"
                    ? "Отменён"
                    : "Ожидает получения"}
              </span>
            </div>

            <div className="mt-6 rounded-2xl bg-[#FFF2EF] p-5 text-center">
              <p className="text-xs text-[#A77973]">
                Код покупателя
              </p>

              <p className="mt-2 text-2xl font-black tracking-wider text-[#C5686D]">
                {order.pickup_code}
              </p>
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl border border-[#EADFD6]">
              {order.items.map(
                (
                  item,
                  index,
                ) => (
                  <div
                    key={item.id}
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

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-[#FAF1E8] p-4">
                <p className="text-xs text-[#927B71]">
                  Итого
                </p>

                <p className="mt-1 text-xl font-black">
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
            </div>

            <p className="mt-5 text-sm text-[#806E68]">
              📍 {order.address}
            </p>

            {order.status ===
              "reserved" && (
              <button
                type="button"
                onClick={
                  confirmPickup
                }
                disabled={
                  confirming
                }
                className="mt-6 w-full rounded-2xl bg-[#D87979] py-4 text-lg font-bold text-white transition hover:bg-[#C96868] disabled:opacity-60"
              >
                {confirming
                  ? "Подтверждаем..."
                  : "Выдать заказ"}
              </button>
            )}

            {order.status ===
              "picked_up" && (
              <button
                type="button"
                onClick={reset}
                className="mt-6 w-full rounded-2xl border border-[#D9C5B7] py-3.5 font-semibold transition hover:bg-[#F8EEE6]"
              >
                Выдать следующий заказ
              </button>
            )}
          </article>
        )}
      </section>
    </main>
  );
}