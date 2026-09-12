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
    process.env
        .NEXT_PUBLIC_API_URL ??
    "http://127.0.0.1:8001";


type Branch = {
    id: string;
    name: string;
    address: string;
};


type Product = {
    id: string;
    name: string;
    category: string | null;
    base_price:
    | string
    | number;
    is_active: boolean;
};


type Offer = {
    id: string;
    title: string;

    sale_price:
    | string
    | number;

    quantity_remaining:
    number;

    status: string;
};


function roleName(
    role: string,
) {
    switch (role) {
        case "owner":
            return "Владелец";

        case "manager":
            return "Менеджер";

        case "staff":
            return "Сотрудник";

        default:
            return role;
    }
}


export default function BusinessDashboardPage() {
    const router =
        useRouter();

    const {
        user,
        loading: authLoading,
        logout,
    } = useAuth();

    const {
        memberships,
        selectedMembership,
        loading: businessLoading,
        selectBusiness,
        clearBusinessState,
    } = useBusiness();

    const [
        branches,
        setBranches,
    ] = useState<
        Branch[]
    >([]);

    const [
        products,
        setProducts,
    ] = useState<
        Product[]
    >([]);

    const [
        offers,
        setOffers,
    ] = useState<
        Offer[]
    >([]);

    const [
        loadingData,
        setLoadingData,
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
            memberships.length ===
            0
        ) {
            router.replace(
                "/business",
            );
        }

    }, [
        authLoading,
        businessLoading,
        user,
        memberships.length,
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
                setLoadingData(true);
                setError("");

                const headers = {
                    Authorization:
                        `Bearer ${token}`,
                };

                const [
                    branchesResponse,
                    productsResponse,
                    offersResponse,
                ] =
                    await Promise.all([
                        fetch(
                            `${API_URL}/branches/business/${businessId}`,
                            { headers },
                        ),

                        fetch(
                            `${API_URL}/products/business/${businessId}`,
                            { headers },
                        ),

                        fetch(
                            `${API_URL}/offers/business/${businessId}`,
                            { headers },
                        ),
                    ]);

                if (
                    branchesResponse.status ===
                    401 ||
                    productsResponse.status ===
                    401 ||
                    offersResponse.status ===
                    401
                ) {
                    logout();
                    clearBusinessState();

                    router.replace(
                        "/business/login",
                    );

                    return;
                }

                if (
                    !branchesResponse.ok ||
                    !productsResponse.ok ||
                    !offersResponse.ok
                ) {
                    throw new Error(
                        "Не удалось загрузить данные бизнеса.",
                    );
                }

                const [
                    branchesData,
                    productsData,
                    offersData,
                ] =
                    await Promise.all([
                        branchesResponse.json(),
                        productsResponse.json(),
                        offersResponse.json(),
                    ]);

                setBranches(
                    branchesData,
                );

                setProducts(
                    productsData,
                );

                setOffers(
                    offersData,
                );
            } catch (err) {
                setError(
                    err instanceof Error
                        ? err.message
                        : "Произошла ошибка.",
                );
            } finally {
                setLoadingData(false);
            }
        }

        void loadData();

    }, [
        selectedMembership,
        router,
        logout,
        clearBusinessState,
    ]);


    function handleLogout() {
        logout();
        clearBusinessState();

        router.replace(
            "/business",
        );
    }


    if (
        authLoading ||
        businessLoading ||
        !selectedMembership
    ) {
        return (
            <main className="min-h-screen bg-[#f1d7be] p-10 text-center text-[#3B2F2F]">
                Загружаем кабинет...
            </main>
        );
    }


    const business =
        selectedMembership
            .business;


    return (
        <main className="min-h-screen bg-[#f1d7be] text-[#3B2F2F]">
            <header className="border-b border-[#E4D5CB] bg-[#FFFDF9]">
                <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-6 py-5">
                    <div>
                        <Link
                            href="/"
                            className="text-2xl font-black text-[#D87979]"
                        >
                            SAVEAT
                        </Link>

                        <p className="text-xs text-[#947D73]">
                            Business
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <Link
                            href="/business/pickup"
                            className="rounded-xl bg-[#F7DFDC] px-4 py-2.5 text-sm font-semibold text-[#B85F68] transition hover:bg-[#F1CECB]"
                        >
                            Выдача
                        </Link>

                        <Link
                            href="/business/orders"
                            className="rounded-xl bg-[#D87979] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#C96868]"
                        >
                            Заказы
                        </Link>

                        <Link
                            href="/"
                            className="rounded-xl border border-[#D9C5B7] px-4 py-2.5 text-sm font-semibold transition hover:bg-[#F8EEE6]"
                        >
                            На сайт
                        </Link>

                        <button
                            type="button"
                            onClick={handleLogout}
                            className="rounded-xl bg-[#3B2F2F] px-4 py-2.5 text-sm font-semibold text-white"
                        >
                            Выйти
                        </button>
                    </div>
                </div>
            </header>

            <section className="mx-auto max-w-7xl px-6 py-10">
                <div className="flex flex-wrap items-end justify-between gap-5">
                    <div>
                        <p className="text-sm font-semibold text-[#C5686D]">
                            Панель управления
                        </p>

                        <h1 className="mt-1 text-3xl font-black">
                            {business.name}
                        </h1>

                        <p className="mt-2 text-sm text-[#806E68]">
                            {user?.full_name} ·{" "}
                            {roleName(
                                selectedMembership.role,
                            )}
                        </p>
                    </div>

                    {memberships.length >
                        1 && (
                            <select
                                value={
                                    business.id
                                }
                                onChange={(
                                    event,
                                ) =>
                                    selectBusiness(
                                        event.target
                                            .value,
                                    )
                                }
                                className="rounded-xl border border-[#D8C7BA] bg-white px-4 py-3 outline-none"
                            >
                                {memberships.map(
                                    (membership) => (
                                        <option
                                            key={
                                                membership.id
                                            }
                                            value={
                                                membership
                                                    .business.id
                                            }
                                        >
                                            {
                                                membership
                                                    .business.name
                                            }
                                        </option>
                                    ),
                                )}
                            </select>
                        )}
                </div>

                {error && (
                    <div className="mt-6 rounded-2xl bg-[#FBE3E1] p-4 text-sm text-[#A64F55]">
                        {error}
                    </div>
                )}

                <div className="mt-8 grid gap-4 sm:grid-cols-3">
                    <div className="rounded-[24px] bg-[#FFFDF9] p-6 shadow-sm">
                        <p className="text-sm text-[#927B71]">
                            Филиалы
                        </p>

                        <p className="mt-2 text-3xl font-black">
                            {branches.length}
                        </p>
                    </div>

                    <div className="rounded-[24px] bg-[#FFFDF9] p-6 shadow-sm">
                        <p className="text-sm text-[#927B71]">
                            Товары
                        </p>

                        <p className="mt-2 text-3xl font-black">
                            {products.length}
                        </p>
                    </div>

                    <div className="rounded-[24px] bg-[#FFFDF9] p-6 shadow-sm">
                        <p className="text-sm text-[#927B71]">
                            Предложения
                        </p>

                        <p className="mt-2 text-3xl font-black">
                            {offers.length}
                        </p>
                    </div>
                </div>

                {loadingData ? (
                    <div className="mt-8 rounded-[28px] bg-[#FFFDF9] p-8">
                        Загружаем данные...
                    </div>
                ) : (
                    <div className="mt-8 grid gap-6 lg:grid-cols-3">
                        <section className="rounded-[28px] bg-[#FFFDF9] p-6">
                            <div className="flex items-center justify-between gap-3">
                                <h2 className="text-xl font-bold">
                                    Филиалы
                                </h2>

                                {selectedMembership.role !==
                                    "staff" && (
                                        <Link
                                            href="/business/branches/new"
                                            className="rounded-xl bg-[#D87979] px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-[#C96868]"
                                        >
                                            + Добавить
                                        </Link>
                                    )}
                            </div>

                            <div className="mt-5 space-y-3">
                                {branches.length ===
                                    0 ? (
                                    <p className="text-sm text-[#927B71]">
                                        Филиалов пока нет.
                                    </p>
                                ) : (
                                    branches.map(
                                        (branch) => (
                                            <div
                                                key={
                                                    branch.id
                                                }
                                                className="rounded-2xl border border-[#EADFD6] p-4"
                                            >
                                                <p className="font-semibold">
                                                    {
                                                        branch.name
                                                    }
                                                </p>

                                                <p className="mt-1 text-sm text-[#806E68]">
                                                    {
                                                        branch.address
                                                    }
                                                </p>
                                            </div>
                                        ),
                                    )
                                )}
                            </div>
                        </section>

                        <section className="rounded-[28px] bg-[#FFFDF9] p-6">
                            <div className="flex items-center justify-between gap-3">
                                <h2 className="text-xl font-bold">
                                    Товары
                                </h2>

                                {selectedMembership.role !==
                                    "staff" && (
                                        <Link
                                            href="/business/products/new"
                                            className="rounded-xl bg-[#D87979] px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-[#C96868]"
                                        >
                                            + Добавить
                                        </Link>
                                    )}
                            </div>

                            <div className="mt-5 space-y-3">
                                {products.length ===
                                    0 ? (
                                    <p className="text-sm text-[#927B71]">
                                        Товаров пока нет.
                                    </p>
                                ) : (
                                    products.map(
                                        (product) => (
                                            <div
                                                key={
                                                    product.id
                                                }
                                                className="rounded-2xl border border-[#EADFD6] p-4"
                                            >
                                                <p className="font-semibold">
                                                    {
                                                        product.name
                                                    }
                                                </p>

                                                <p className="mt-1 text-sm text-[#806E68]">
                                                    {Number(
                                                        product.base_price,
                                                    ).toLocaleString(
                                                        "ru-RU",
                                                    )}{" "}
                                                    ₸
                                                </p>
                                            </div>
                                        ),
                                    )
                                )}
                            </div>
                        </section>

                        <section className="rounded-[28px] bg-[#FFFDF9] p-6">
                            <div className="flex items-center justify-between gap-3">
                                <h2 className="text-xl font-bold">
                                    Предложения
                                </h2>

                                {selectedMembership.role !==
                                    "staff" && (
                                        <Link
                                            href="/business/offers/new"
                                            className="rounded-xl bg-[#D87979] px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-[#C96868]"
                                        >
                                            + Создать
                                        </Link>
                                    )}
                            </div>

                            <div className="mt-5 space-y-3">
                                {offers.length ===
                                    0 ? (
                                    <p className="text-sm text-[#927B71]">
                                        Предложений пока нет.
                                    </p>
                                ) : (
                                    offers.map(
                                        (offer) => (
                                            <div
                                                key={
                                                    offer.id
                                                }
                                                className="rounded-2xl border border-[#EADFD6] p-4"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <p className="font-semibold">
                                                        {
                                                            offer.title
                                                        }
                                                    </p>

                                                    <span className="rounded-full bg-[#F7DFDC] px-2.5 py-1 text-xs font-semibold text-[#B85F68]">
                                                        {
                                                            offer.status
                                                        }
                                                    </span>
                                                </div>

                                                <p className="mt-2 text-sm text-[#806E68]">
                                                    {Number(
                                                        offer.sale_price,
                                                    ).toLocaleString(
                                                        "ru-RU",
                                                    )}{" "}
                                                    ₸ · осталось{" "}
                                                    {
                                                        offer.quantity_remaining
                                                    }
                                                </p>
                                            </div>
                                        ),
                                    )
                                )}
                            </div>
                        </section>
                    </div>
                )}
            </section>
        </main>
    );
}