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


export default function NewProductPage() {
  const router = useRouter();

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
    description,
    setDescription,
  ] = useState("");

  const [
    category,
    setCategory,
  ] = useState("");

  const [
    imageUrl,
    setImageUrl,
  ] = useState("");

  const [
    basePrice,
    setBasePrice,
  ] = useState("");

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

    if (!selectedMembership) {
      router.replace(
        "/business",
      );

      return;
    }

    if (
      selectedMembership.role ===
      "staff"
    ) {
      router.replace(
        "/business/dashboard",
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

    setError("");

    const cleanName =
      name.trim();

    const cleanPrice =
      basePrice.trim();

    if (!cleanName) {
      setError(
        "Введите название товара.",
      );

      return;
    }

    if (!cleanPrice) {
      setError(
        "Введите обычную цену товара.",
      );

      return;
    }

    const numericPrice =
      Number(cleanPrice);

    if (
      !Number.isFinite(
        numericPrice,
      ) ||
      numericPrice <= 0
    ) {
      setError(
        "Цена должна быть больше 0.",
      );

      return;
    }

    try {
      setLoading(true);

      const response =
        await fetch(
          `${API_URL}/products`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${token}`,
            },

            body: JSON.stringify({
              business_id:
                selectedMembership
                  .business.id,

              name: cleanName,

              description:
                description.trim() ||
                null,

              category:
                category.trim() ||
                null,

              image_url:
                imageUrl.trim() ||
                null,

              base_price:
                cleanPrice,
            }),
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
          "У вас нет прав для добавления товаров.",
        );
      }

      if (!response.ok) {
        throw new Error(
          data?.detail ??
            "Не удалось создать товар.",
        );
      }

      router.replace(
        "/business/dashboard",
      );

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
    selectedMembership.business;


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
            Добавить товар
          </h1>

          <p className="mt-2 text-sm leading-6 text-[#806E68]">
            Создайте товар, который
            позже можно будет добавить
            в SAVEAT-предложение со
            скидкой.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-[28px] border border-[#DFC2AA] bg-[#FFFDF9] p-7 shadow-sm"
        >
          <div className="space-y-5">
            <div>
              <label
                htmlFor="name"
                className="mb-2 block text-sm font-semibold"
              >
                Название товара
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
                placeholder="Круассан с миндалём"
                required
                className="w-full rounded-2xl border border-[#E3CFC0] bg-white px-4 py-3.5 outline-none transition focus:border-[#D87979] focus:ring-4 focus:ring-[#D87979]/10"
              />
            </div>

            <div>
              <label
                htmlFor="category"
                className="mb-2 block text-sm font-semibold"
              >
                Категория
              </label>

              <select
                id="category"
                value={category}
                onChange={(event) =>
                  setCategory(
                    event.target.value,
                  )
                }
                className="w-full rounded-2xl border border-[#E3CFC0] bg-white px-4 py-3.5 outline-none transition focus:border-[#D87979] focus:ring-4 focus:ring-[#D87979]/10"
              >
                <option value="">
                  Не выбрано
                </option>

                <option value="desserts">
                  Десерты
                </option>

                <option value="bakery">
                  Выпечка
                </option>

                <option value="cakes">
                  Торты
                </option>

                <option value="sandwiches">
                  Сэндвичи
                </option>

                <option value="ready_meals">
                  Готовая еда
                </option>

                <option value="other">
                  Другое
                </option>
              </select>
            </div>

            <div>
              <label
                htmlFor="basePrice"
                className="mb-2 block text-sm font-semibold"
              >
                Обычная цена, ₸
              </label>

              <input
                id="basePrice"
                type="number"
                min="1"
                step="0.01"
                value={basePrice}
                onChange={(event) =>
                  setBasePrice(
                    event.target.value,
                  )
                }
                placeholder="2500"
                required
                className="w-full rounded-2xl border border-[#E3CFC0] bg-white px-4 py-3.5 outline-none transition focus:border-[#D87979] focus:ring-4 focus:ring-[#D87979]/10"
              />

              <p className="mt-2 text-xs text-[#927B71]">
                Это обычная цена товара.
                SAVEAT-цену со скидкой
                укажем при создании
                предложения.
              </p>
            </div>

            <div>
              <label
                htmlFor="description"
                className="mb-2 block text-sm font-semibold"
              >
                Описание
              </label>

              <textarea
                id="description"
                value={description}
                onChange={(event) =>
                  setDescription(
                    event.target.value,
                  )
                }
                rows={4}
                placeholder="Свежий миндальный круассан..."
                className="w-full resize-none rounded-2xl border border-[#E3CFC0] bg-white px-4 py-3.5 outline-none transition focus:border-[#D87979] focus:ring-4 focus:ring-[#D87979]/10"
              />
            </div>

            <div>
              <label
                htmlFor="imageUrl"
                className="mb-2 block text-sm font-semibold"
              >
                Ссылка на фото
              </label>

              <input
                id="imageUrl"
                type="url"
                value={imageUrl}
                onChange={(event) =>
                  setImageUrl(
                    event.target.value,
                  )
                }
                placeholder="https://..."
                className="w-full rounded-2xl border border-[#E3CFC0] bg-white px-4 py-3.5 outline-none transition focus:border-[#D87979] focus:ring-4 focus:ring-[#D87979]/10"
              />

              <p className="mt-2 text-xs text-[#927B71]">
                Пока используем URL.
                Позже подключим нормальную
                загрузку фотографий в
                Supabase Storage.
              </p>
            </div>

            {imageUrl.trim() && (
              <div>
                <p className="mb-2 text-sm font-semibold">
                  Превью
                </p>

                <div className="flex h-52 items-center justify-center overflow-hidden rounded-2xl bg-[#F5E4E1]">
                  <img
                    src={imageUrl}
                    alt="Превью товара"
                    className="h-full w-full object-cover"
                    onError={(event) => {
                      event.currentTarget.style.display =
                        "none";
                    }}
                  />
                </div>
              </div>
            )}

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
                : "Добавить товар"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}