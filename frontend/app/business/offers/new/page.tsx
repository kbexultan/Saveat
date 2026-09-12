"use client";

import Link from "next/link";

import {
  FormEvent,
  useEffect,
  useMemo,
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


type Branch = {
  id: string;
  business_id: string;

  name: string;
  address: string;
};


type Product = {
  id: string;
  business_id: string;

  name: string;
  description: string | null;
  category: string | null;

  base_price:
    | string
    | number;

  image_url: string | null;

  is_active: boolean;
};


function toAlmatyIso(
  value: string,
) {
  if (!value) {
    return "";
  }

  return `${value}:00+05:00`;
}


export default function NewOfferPage() {
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
    branches,
    setBranches,
  ] = useState<Branch[]>([]);

  const [
    products,
    setProducts,
  ] = useState<Product[]>([]);

  const [
    branchId,
    setBranchId,
  ] = useState("");

  const [
    productId,
    setProductId,
  ] = useState("");

  const [
    title,
    setTitle,
  ] = useState("");

  const [
    description,
    setDescription,
  ] = useState("");

  const [
    salePrice,
    setSalePrice,
  ] = useState("");

  const [
    quantity,
    setQuantity,
  ] = useState("1");

  const [
    pickupStart,
    setPickupStart,
  ] = useState("");

  const [
    pickupEnd,
    setPickupEnd,
  ] = useState("");

  const [
    loadingData,
    setLoadingData,
  ] = useState(true);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");


  const selectedProduct =
    useMemo(
      () =>
        products.find(
          (product) =>
            product.id ===
            productId,
        ) ?? null,
      [
        products,
        productId,
      ],
    );


  const originalPrice =
    selectedProduct
      ? Number(
          selectedProduct
            .base_price,
        )
      : 0;


  const discountPercent =
    useMemo(() => {
      const sale =
        Number(
          salePrice,
        );

      if (
        !originalPrice ||
        !Number.isFinite(
          sale,
        ) ||
        sale <= 0 ||
        sale >=
          originalPrice
      ) {
        return 0;
      }

      return Math.round(
        (
          1 -
          sale /
            originalPrice
        ) *
          100,
      );
    }, [
      salePrice,
      originalPrice,
    ]);


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


  useEffect(() => {
    if (
      !selectedMembership
    ) {
      return;
    }

    const businessId =
      selectedMembership
        .business.id;

    async function loadData() {
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
        setLoadingData(
          true,
        );

        setError("");

        const headers = {
          Authorization:
            `Bearer ${token}`,
        };

        const [
          branchesResponse,
          productsResponse,
        ] =
          await Promise.all([
            fetch(
              `${API_URL}/branches/business/${businessId}`,
              {
                headers,
              },
            ),

            fetch(
              `${API_URL}/products/business/${businessId}`,
              {
                headers,
              },
            ),
          ]);

        if (
          branchesResponse
            .status ===
            401 ||
          productsResponse
            .status ===
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
          !branchesResponse.ok ||
          !productsResponse.ok
        ) {
          throw new Error(
            "Не удалось загрузить филиалы и товары.",
          );
        }

        const branchesData:
          Branch[] =
          await branchesResponse.json();

        const productsData:
          Product[] =
          await productsResponse.json();

        setBranches(
          branchesData,
        );

        setProducts(
          productsData.filter(
            (product) =>
              product.is_active,
          ),
        );

        if (
          branchesData.length >
          0
        ) {
          setBranchId(
            branchesData[0].id,
          );
        }

        const firstProduct =
          productsData.find(
            (product) =>
              product.is_active,
          );

        if (firstProduct) {
          setProductId(
            firstProduct.id,
          );

          setTitle(
            firstProduct.name,
          );
        }

      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Произошла ошибка.",
        );
      } finally {
        setLoadingData(
          false,
        );
      }
    }

    void loadData();

  }, [
    selectedMembership,
    router,
  ]);


  function handleProductChange(
    nextProductId: string,
  ) {
    setProductId(
      nextProductId,
    );

    const product =
      products.find(
        (item) =>
          item.id ===
          nextProductId,
      );

    if (!product) {
      return;
    }

    setTitle(
      product.name,
    );

    setDescription(
      product.description ??
        "",
    );
  }


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

    if (!branchId) {
      setError(
        "Выберите филиал.",
      );

      return;
    }

    if (!productId) {
      setError(
        "Выберите товар.",
      );

      return;
    }

    if (
      !selectedProduct
    ) {
      setError(
        "Товар не найден.",
      );

      return;
    }

    const cleanTitle =
      title.trim();

    if (!cleanTitle) {
      setError(
        "Введите название предложения.",
      );

      return;
    }

    const numericSalePrice =
      Number(
        salePrice,
      );

    if (
      !Number.isFinite(
        numericSalePrice,
      ) ||
      numericSalePrice <= 0
    ) {
      setError(
        "SAVEAT-цена должна быть больше 0.",
      );

      return;
    }

    if (
      numericSalePrice >
      originalPrice
    ) {
      setError(
        "SAVEAT-цена не может быть выше обычной цены.",
      );

      return;
    }

    const numericQuantity =
      Number(
        quantity,
      );

    if (
      !Number.isInteger(
        numericQuantity,
      ) ||
      numericQuantity <= 0
    ) {
      setError(
        "Количество должно быть целым числом больше 0.",
      );

      return;
    }

    if (
      !pickupStart ||
      !pickupEnd
    ) {
      setError(
        "Укажите время начала и окончания получения.",
      );

      return;
    }

    const start =
      new Date(
        toAlmatyIso(
          pickupStart,
        ),
      );

    const end =
      new Date(
        toAlmatyIso(
          pickupEnd,
        ),
      );

    if (
      Number.isNaN(
        start.getTime(),
      ) ||
      Number.isNaN(
        end.getTime(),
      )
    ) {
      setError(
        "Некорректное время получения.",
      );

      return;
    }

    if (
      end.getTime() <=
      start.getTime()
    ) {
      setError(
        "Окончание получения должно быть позже начала.",
      );

      return;
    }

    if (
      end.getTime() <=
      Date.now()
    ) {
      setError(
        "Время окончания получения уже прошло.",
      );

      return;
    }

    try {
      setLoading(true);

      const response =
        await fetch(
          `${API_URL}/offers`,
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
                branch_id:
                  branchId,

                product_id:
                  productId,

                type:
                  "product",

                title:
                  cleanTitle,

                description:
                  description.trim() ||
                  null,

                original_price:
                  String(
                    originalPrice,
                  ),

                sale_price:
                  salePrice,

                quantity_total:
                  numericQuantity,

                pickup_start:
                  toAlmatyIso(
                    pickupStart,
                  ),

                pickup_end:
                  toAlmatyIso(
                    pickupEnd,
                  ),
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
          "У вас нет прав для создания предложения.",
        );
      }

      if (!response.ok) {
        throw new Error(
          data?.detail ??
            "Не удалось создать предложение.",
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
            Создать предложение
          </h1>

          <p className="mt-2 text-sm leading-6 text-[#806E68]">
            Укажите товар, филиал,
            SAVEAT-цену и время,
            когда покупатель сможет
            забрать заказ.
          </p>
        </div>

        {loadingData ? (
          <div className="rounded-[28px] bg-[#FFFDF9] p-8">
            Загружаем товары и
            филиалы...
          </div>
        ) : branches.length ===
            0 ? (
          <div className="rounded-[28px] border border-[#DFC2AA] bg-[#FFFDF9] p-7">
            <h2 className="text-xl font-bold">
              Сначала добавьте филиал
            </h2>

            <p className="mt-2 text-sm text-[#806E68]">
              Предложение должно быть
              привязано к месту
              получения.
            </p>

            <Link
              href="/business/branches/new"
              className="mt-5 inline-block rounded-xl bg-[#D87979] px-5 py-3 font-semibold text-white"
            >
              Добавить филиал
            </Link>
          </div>
        ) : products.length ===
            0 ? (
          <div className="rounded-[28px] border border-[#DFC2AA] bg-[#FFFDF9] p-7">
            <h2 className="text-xl font-bold">
              Сначала добавьте товар
            </h2>

            <p className="mt-2 text-sm text-[#806E68]">
              Создайте товар, который
              хотите продавать через
              SAVEAT.
            </p>

            <Link
              href="/business/products/new"
              className="mt-5 inline-block rounded-xl bg-[#D87979] px-5 py-3 font-semibold text-white"
            >
              Добавить товар
            </Link>
          </div>
        ) : (
          <form
            onSubmit={
              handleSubmit
            }
            className="rounded-[28px] border border-[#DFC2AA] bg-[#FFFDF9] p-7 shadow-sm"
          >
            <div className="space-y-5">
              <div>
                <label
                  htmlFor="branch"
                  className="mb-2 block text-sm font-semibold"
                >
                  Филиал
                </label>

                <select
                  id="branch"
                  value={branchId}
                  onChange={(event) =>
                    setBranchId(
                      event.target
                        .value,
                    )
                  }
                  required
                  className="w-full rounded-2xl border border-[#E3CFC0] bg-white px-4 py-3.5 outline-none focus:border-[#D87979]"
                >
                  {branches.map(
                    (branch) => (
                      <option
                        key={
                          branch.id
                        }
                        value={
                          branch.id
                        }
                      >
                        {branch.name} —{" "}
                        {branch.address}
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div>
                <label
                  htmlFor="product"
                  className="mb-2 block text-sm font-semibold"
                >
                  Товар
                </label>

                <select
                  id="product"
                  value={productId}
                  onChange={(event) =>
                    handleProductChange(
                      event.target
                        .value,
                    )
                  }
                  required
                  className="w-full rounded-2xl border border-[#E3CFC0] bg-white px-4 py-3.5 outline-none focus:border-[#D87979]"
                >
                  {products.map(
                    (product) => (
                      <option
                        key={
                          product.id
                        }
                        value={
                          product.id
                        }
                      >
                        {
                          product.name
                        }{" "}
                        —{" "}
                        {Number(
                          product.base_price,
                        ).toLocaleString(
                          "ru-RU",
                        )}{" "}
                        ₸
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div>
                <label
                  htmlFor="title"
                  className="mb-2 block text-sm font-semibold"
                >
                  Название предложения
                </label>

                <input
                  id="title"
                  type="text"
                  value={title}
                  onChange={(event) =>
                    setTitle(
                      event.target
                        .value,
                    )
                  }
                  required
                  className="w-full rounded-2xl border border-[#E3CFC0] bg-white px-4 py-3.5 outline-none focus:border-[#D87979]"
                />
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
                      event.target
                        .value,
                    )
                  }
                  rows={3}
                  placeholder="Например: свежая выпечка сегодняшнего дня"
                  className="w-full resize-none rounded-2xl border border-[#E3CFC0] bg-white px-4 py-3.5 outline-none focus:border-[#D87979]"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-sm font-semibold">
                    Обычная цена
                  </p>

                  <div className="rounded-2xl bg-[#F5ECE4] px-4 py-3.5 font-bold">
                    {originalPrice.toLocaleString(
                      "ru-RU",
                    )}{" "}
                    ₸
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="salePrice"
                    className="mb-2 block text-sm font-semibold"
                  >
                    SAVEAT-цена
                  </label>

                  <input
                    id="salePrice"
                    type="number"
                    min="1"
                    step="0.01"
                    value={
                      salePrice
                    }
                    onChange={(event) =>
                      setSalePrice(
                        event.target
                          .value,
                      )
                    }
                    placeholder="1100"
                    required
                    className="w-full rounded-2xl border border-[#E3CFC0] bg-white px-4 py-3.5 outline-none focus:border-[#D87979]"
                  />
                </div>
              </div>

              {discountPercent >
                0 && (
                <div className="rounded-2xl bg-[#F7DFDC] px-4 py-3 text-sm font-semibold text-[#B85F68]">
                  Скидка для
                  покупателя:{" "}
                  {discountPercent}%
                </div>
              )}

              <div>
                <label
                  htmlFor="quantity"
                  className="mb-2 block text-sm font-semibold"
                >
                  Количество
                </label>

                <input
                  id="quantity"
                  type="number"
                  min="1"
                  step="1"
                  value={quantity}
                  onChange={(event) =>
                    setQuantity(
                      event.target
                        .value,
                    )
                  }
                  required
                  className="w-full rounded-2xl border border-[#E3CFC0] bg-white px-4 py-3.5 outline-none focus:border-[#D87979]"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="pickupStart"
                    className="mb-2 block text-sm font-semibold"
                  >
                    Получение с
                  </label>

                  <input
                    id="pickupStart"
                    type="datetime-local"
                    value={
                      pickupStart
                    }
                    onChange={(event) =>
                      setPickupStart(
                        event.target
                          .value,
                      )
                    }
                    required
                    className="w-full rounded-2xl border border-[#E3CFC0] bg-white px-4 py-3.5 outline-none focus:border-[#D87979]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="pickupEnd"
                    className="mb-2 block text-sm font-semibold"
                  >
                    Получение до
                  </label>

                  <input
                    id="pickupEnd"
                    type="datetime-local"
                    value={
                      pickupEnd
                    }
                    onChange={(event) =>
                      setPickupEnd(
                        event.target
                          .value,
                      )
                    }
                    required
                    className="w-full rounded-2xl border border-[#E3CFC0] bg-white px-4 py-3.5 outline-none focus:border-[#D87979]"
                  />
                </div>
              </div>

              <p className="text-xs leading-5 text-[#927B71]">
                Покупатель должен
                прийти именно в этот
                временной промежуток.
              </p>

              {error && (
                <div className="rounded-2xl bg-[#FBE3E1] px-4 py-3 text-sm font-medium text-[#A64F55]">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-[#D87979] py-3.5 font-semibold text-white transition hover:bg-[#C96868] disabled:opacity-60"
              >
                {loading
                  ? "Публикуем..."
                  : "Опубликовать предложение"}
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}