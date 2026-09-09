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
  process.env
    .NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:8001";


export default function NewBranchPage() {
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
    name,
    setName,
  ] = useState("");

  const [
    address,
    setAddress,
  ] = useState("");

  const [
    latitude,
    setLatitude,
  ] = useState("");

  const [
    longitude,
    setLongitude,
  ] = useState("");

  const [
    openingTime,
    setOpeningTime,
  ] = useState("08:00");

  const [
    closingTime,
    setClosingTime,
  ] = useState("22:00");

  const [
    error,
    setError,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);


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
    }

  }, [
    authLoading,
    businessLoading,
    user,
    selectedMembership,
    router,
  ]);


  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !selectedMembership
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

    setError("");

    try {
      setLoading(true);

      const body = {
        business_id:
          selectedMembership
            .business.id,

        name:
          name.trim(),

        address:
          address.trim(),

        latitude:
          latitude.trim()
            ? Number(
                latitude,
              )
            : null,

        longitude:
          longitude.trim()
            ? Number(
                longitude,
              )
            : null,

        opening_time:
          openingTime
            ? `${openingTime}:00`
            : null,

        closing_time:
          closingTime
            ? `${closingTime}:00`
            : null,
      };

      if (!body.name) {
        throw new Error(
          "Введите название филиала.",
        );
      }

      if (!body.address) {
        throw new Error(
          "Введите адрес филиала.",
        );
      }

      if (
        latitude.trim() &&
        !Number.isFinite(
          body.latitude,
        )
      ) {
        throw new Error(
          "Некорректная широта.",
        );
      }

      if (
        longitude.trim() &&
        !Number.isFinite(
          body.longitude,
        )
      ) {
        throw new Error(
          "Некорректная долгота.",
        );
      }

      const response =
        await fetch(
          `${API_URL}/branches`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${token}`,
            },

            body:
              JSON.stringify(
                body,
              ),
          },
        );

      const data =
        await response.json();

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
          "У вас нет прав для создания филиала в этом бизнесе.",
        );
      }

      if (!response.ok) {
        throw new Error(
          typeof data.detail ===
            "string"
            ? data.detail
            : "Не удалось создать филиал.",
        );
      }

      router.replace(
        "/business/dashboard",
      );

      router.refresh();

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

          <Link
            href="/business/dashboard"
            className="rounded-xl border border-[#D9C5B7] px-4 py-2.5 text-sm font-semibold transition hover:bg-[#F8EEE6]"
          >
            ← Назад
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-2xl px-6 py-10">
        <div className="mb-7">
          <p className="text-sm font-semibold text-[#C5686D]">
            {business.name}
          </p>

          <h1 className="mt-1 text-3xl font-black">
            Добавить филиал
          </h1>

          <p className="mt-2 text-sm text-[#806E68]">
            Укажите основные данные точки,
            где покупатели будут забирать
            заказы SAVEAT.
          </p>
        </div>

        <form
          onSubmit={
            handleSubmit
          }
          className="rounded-[28px] border border-[#DFC2AA] bg-[#FFFDF9] p-7 shadow-sm"
        >
          <div className="space-y-5">
            <div>
              <label
                htmlFor="name"
                className="mb-2 block text-sm font-semibold"
              >
                Название филиала
              </label>

              <input
                id="name"
                type="text"
                value={name}
                onChange={(event) =>
                  setName(
                    event.target.value,
                  )
                }
                placeholder="Daily Coffee Dostyk"
                required
                className="w-full rounded-2xl border border-[#E3CFC0] bg-white px-4 py-3.5 outline-none transition focus:border-[#D87979] focus:ring-4 focus:ring-[#D87979]/10"
              />
            </div>

            <div>
              <label
                htmlFor="address"
                className="mb-2 block text-sm font-semibold"
              >
                Адрес
              </label>

              <input
                id="address"
                type="text"
                value={address}
                onChange={(event) =>
                  setAddress(
                    event.target.value,
                  )
                }
                placeholder="проспект Достык, 120"
                required
                className="w-full rounded-2xl border border-[#E3CFC0] bg-white px-4 py-3.5 outline-none transition focus:border-[#D87979] focus:ring-4 focus:ring-[#D87979]/10"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="latitude"
                  className="mb-2 block text-sm font-semibold"
                >
                  Широта
                </label>

                <input
                  id="latitude"
                  type="number"
                  step="any"
                  value={latitude}
                  onChange={(event) =>
                    setLatitude(
                      event.target.value,
                    )
                  }
                  placeholder="43.238"
                  className="w-full rounded-2xl border border-[#E3CFC0] bg-white px-4 py-3.5 outline-none transition focus:border-[#D87979] focus:ring-4 focus:ring-[#D87979]/10"
                />
              </div>

              <div>
                <label
                  htmlFor="longitude"
                  className="mb-2 block text-sm font-semibold"
                >
                  Долгота
                </label>

                <input
                  id="longitude"
                  type="number"
                  step="any"
                  value={longitude}
                  onChange={(event) =>
                    setLongitude(
                      event.target.value,
                    )
                  }
                  placeholder="76.956"
                  className="w-full rounded-2xl border border-[#E3CFC0] bg-white px-4 py-3.5 outline-none transition focus:border-[#D87979] focus:ring-4 focus:ring-[#D87979]/10"
                />
              </div>
            </div>

            <p className="text-xs leading-5 text-[#927B71]">
              Координаты пока можно
              оставить пустыми. Позже
              сделаем выбор точки прямо
              на карте.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="openingTime"
                  className="mb-2 block text-sm font-semibold"
                >
                  Открытие
                </label>

                <input
                  id="openingTime"
                  type="time"
                  value={openingTime}
                  onChange={(event) =>
                    setOpeningTime(
                      event.target.value,
                    )
                  }
                  className="w-full rounded-2xl border border-[#E3CFC0] bg-white px-4 py-3.5 outline-none transition focus:border-[#D87979] focus:ring-4 focus:ring-[#D87979]/10"
                />
              </div>

              <div>
                <label
                  htmlFor="closingTime"
                  className="mb-2 block text-sm font-semibold"
                >
                  Закрытие
                </label>

                <input
                  id="closingTime"
                  type="time"
                  value={closingTime}
                  onChange={(event) =>
                    setClosingTime(
                      event.target.value,
                    )
                  }
                  className="w-full rounded-2xl border border-[#E3CFC0] bg-white px-4 py-3.5 outline-none transition focus:border-[#D87979] focus:ring-4 focus:ring-[#D87979]/10"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-2xl bg-[#FBE3E1] px-4 py-3 text-sm font-medium text-[#A64F55]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-[#D87979] py-3.5 font-semibold text-white transition hover:bg-[#C96868] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? "Создаём..."
                : "Создать филиал"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}