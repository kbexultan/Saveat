"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/AuthProvider";
import { useBusiness } from "@/components/BusinessProvider";
import {
  Badge,
  ForecastCard,
  HeroCard,
  IconButton,
  InventoryCard,
  MobileIcon,
  MobilePage,
  PrimaryButton,
  ProductRow,
  QuickActionCard,
  SectionHeader,
  StatCard,
  Topbar,
  type StockStatus,
} from "@/components/mobile/DashboardComponents";
import { MobileBottomNavigation } from "@/components/mobile/MobileBottomNavigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8001";

const TIME_ZONE = "Asia/Almaty";
const DAY_LABELS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const DAY_MS = 86_400_000;

type Branch = {
  id: string;
  name: string;
  address: string;
};

type Product = {
  id: string;
  name: string;
  category: string | null;
  base_price: string | number;
  is_active: boolean;
};

type Offer = {
  id: string;
  title: string;
  sale_price: string | number;
  quantity_remaining: number;
  status: string;
};

type OrderItem = {
  offer_id: string | null;
  offer_title: string;
  product_name: string | null;
  quantity: number;
};

type Order = {
  id: string;
  total_price: string | number;
  status: string;
  created_at: string;
  items: OrderItem[];
};

function roleName(role: string) {
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

/** Календарный день по времени Алматы в формате YYYY-MM-DD. */
function almatyDayKey(value: Date | string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

/** Последние семь календарных дней, от самого раннего к сегодняшнему. */
function lastSevenDays() {
  const todayKey = almatyDayKey(new Date());
  const anchor = new Date(`${todayKey}T00:00:00Z`);

  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(anchor.getTime() - (6 - index) * DAY_MS);

    return {
      key: day.toISOString().slice(0, 10),
      label: DAY_LABELS[day.getUTCDay()],
    };
  });
}

function money(value: number) {
  return `${Math.round(value).toLocaleString("ru-RU")} ₸`;
}

export default function BusinessDashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const {
    memberships,
    selectedMembership,
    loading: businessLoading,
    selectBusiness,
    clearBusinessState,
  } = useBusiness();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading || businessLoading) {
      return;
    }

    if (!user) {
      router.replace("/business/login");
      return;
    }

    if (memberships.length === 0) {
      router.replace("/business");
    }
  }, [authLoading, businessLoading, user, memberships.length, router]);

  useEffect(() => {
    if (!selectedMembership) {
      return;
    }

    const businessId = selectedMembership.business.id;

    async function loadData() {
      const token = localStorage.getItem("access_token");

      if (!token) {
        router.replace("/business/login");
        return;
      }

      try {
        setLoadingData(true);
        setError("");

        const headers = { Authorization: `Bearer ${token}` };
        const [branchesResponse, productsResponse, offersResponse] = await Promise.all([
          fetch(`${API_URL}/branches/business/${businessId}`, { headers }),
          fetch(`${API_URL}/products/business/${businessId}`, { headers }),
          fetch(`${API_URL}/offers/business/${businessId}`, { headers }),
        ]);

        if (
          branchesResponse.status === 401 ||
          productsResponse.status === 401 ||
          offersResponse.status === 401
        ) {
          logout();
          clearBusinessState();
          router.replace("/business/login");
          return;
        }

        if (!branchesResponse.ok || !productsResponse.ok || !offersResponse.ok) {
          throw new Error("Не удалось загрузить данные бизнеса.");
        }

        const [branchesData, productsData, offersData] = await Promise.all([
          branchesResponse.json(),
          productsResponse.json(),
          offersResponse.json(),
        ]);

        setBranches(branchesData);
        setProducts(productsData);
        setOffers(offersData);

        // Заказы нужны только для витрины показателей: если сотруднику
        // закрыт доступ к ним, дашборд всё равно должен открыться.
        try {
          const ordersResponse = await fetch(`${API_URL}/business-orders/${businessId}`, {
            headers,
          });

          setOrders(ordersResponse.ok ? await ordersResponse.json() : []);
        } catch {
          setOrders([]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Произошла ошибка.");
      } finally {
        setLoadingData(false);
      }
    }

    void loadData();
  }, [selectedMembership, router, logout, clearBusinessState]);

  function handleLogout() {
    logout();
    clearBusinessState();
    router.replace("/business");
  }

  /** Выручка по дням, тренд и прогноз — всё считается из реальных заказов. */
  const sales = useMemo(() => {
    const days = lastSevenDays();
    const revenueByDay = new Map<string, number>();
    const soldByOffer = new Map<string, number>();
    const soldByTitle = new Map<string, number>();

    const window = new Set(days.map((day) => day.key));

    for (const order of orders) {
      if (order.status === "cancelled") {
        continue;
      }

      const key = almatyDayKey(order.created_at);

      revenueByDay.set(key, (revenueByDay.get(key) ?? 0) + Number(order.total_price));

      if (!window.has(key)) {
        continue;
      }

      for (const item of order.items ?? []) {
        if (item.offer_id) {
          soldByOffer.set(item.offer_id, (soldByOffer.get(item.offer_id) ?? 0) + item.quantity);
        }

        const title = item.product_name ?? item.offer_title;
        soldByTitle.set(title, (soldByTitle.get(title) ?? 0) + item.quantity);
      }
    }

    const points = days.map((day) => ({
      label: day.label,
      value: revenueByDay.get(day.key) ?? 0,
    }));

    const today = points[6].value;
    const yesterday = points[5].value;
    const deltaToYesterday =
      yesterday > 0 ? Math.round(((today - yesterday) / yesterday) * 100) : null;

    // Наивный прогноз: среднее за последние 3 дня против предыдущих 4.
    const recent = points.slice(4).reduce((sum, point) => sum + point.value, 0) / 3;
    const earlier = points.slice(0, 4).reduce((sum, point) => sum + point.value, 0) / 4;
    const forecastChange =
      earlier > 0 ? Math.round(((recent - earlier) / earlier) * 100) : null;

    const topSeller =
      [...soldByTitle.entries()].sort((first, second) => second[1] - first[1])[0]?.[0] ?? null;

    return {
      points,
      today,
      deltaToYesterday,
      forecastChange,
      topSeller,
      soldByOffer,
      weekRevenue: points.reduce((sum, point) => sum + point.value, 0),
    };
  }, [orders]);

  const dashboard = useMemo(() => {
    const activeOffers = offers.filter((offer) => offer.status === "active");

    const inventory = [...activeOffers]
      .map((offer) => {
        const sold = sales.soldByOffer.get(offer.id) ?? 0;
        const perDay = sold / 7;
        const remaining = Math.max(0, offer.quantity_remaining);

        // Доля нераспроданного запаса: остаток относительно того,
        // что было в витрине за неделю.
        const percent = sold > 0 ? Math.round((remaining / (remaining + sold)) * 100) : 100;

        const daysLeft = perDay > 0 ? Math.floor(remaining / perDay) : null;

        const status: StockStatus =
          remaining <= 1 || (daysLeft !== null && daysLeft <= 1)
            ? "critical"
            : remaining <= 3 || (daysLeft !== null && daysLeft <= 3)
              ? "low"
              : "healthy";

        const eta =
          remaining === 0
            ? "Распродано"
            : daysLeft === null
              ? "Продаж за неделю не было"
              : daysLeft === 0
                ? "Закончится сегодня"
                : `Закончится через ${daysLeft} ${daysLeft === 1 ? "день" : daysLeft < 5 ? "дня" : "дней"}`;

        return { offer, remaining, percent, status, eta };
      })
      .sort((first, second) => first.remaining - second.remaining);

    const lowStock = inventory.filter((entry) => entry.status !== "healthy");

    // Рекомендуемый заказ — позиции каталога, которых сейчас нет в витрине.
    const offeredTitles = new Set(activeOffers.map((offer) => offer.title));
    const recommended = products
      .filter((product) => product.is_active && !offeredTitles.has(product.name))
      .slice(0, 5);

    return {
      activeOffers,
      inventory,
      lowStock,
      recommended,
      availableUnits: activeOffers.reduce(
        (total, offer) => total + Math.max(0, offer.quantity_remaining),
        0,
      ),
      activeProducts: products.filter((product) => product.is_active).length,
    };
  }, [offers, products, sales.soldByOffer]);

  if (authLoading || businessLoading || !selectedMembership) {
    return (
      <MobilePage className="grid place-items-center p-6">
        <div className="saveat-section-card text-body text-muted text-center">
          Загружаем кабинет…
        </div>
      </MobilePage>
    );
  }

  const business = selectedMembership.business;
  const greetingName = user?.full_name?.split(" ")[0] || business.name;
  const canManage = selectedMembership.role !== "staff";

  return (
    <MobilePage>
      {/* Десктопная шапка кабинета остаётся без изменений. */}
      <header className="hidden border-b border-sand-blush/70 bg-surface/85 backdrop-blur md:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-6 py-4">
          <Link href="/" className="text-2xl font-black tracking-[-0.05em] text-primary">
            SAVEAT
          </Link>

          <div className="flex items-center gap-3 text-sm font-semibold">
            <Link href="/business/pickup" className="rounded-chip bg-sand-deep px-4 py-2.5 text-primary-strong">
              Выдача
            </Link>
            <Link href="/business/orders" className="rounded-chip bg-primary px-4 py-2.5 text-white shadow-primary">
              Заказы
            </Link>
            <Link href="/" className="rounded-chip bg-sand px-4 py-2.5 text-muted">
              На сайт
            </Link>
            <button type="button" onClick={handleLogout} className="rounded-chip bg-ink px-4 py-2.5 text-white">
              Выйти
            </button>
          </div>
        </div>
      </header>

      <div className="saveat-shell">
        <Topbar
          avatar={
            business.logo_url ? (
              <img src={business.logo_url} alt="" />
            ) : (
              business.name.slice(0, 1).toUpperCase()
            )
          }
          greeting={`Привет, ${greetingName}!`}
          subline={`Хорошего дня и вкусных продаж 👋 · ${roleName(selectedMembership.role)}`}
          actions={
            <>
              {memberships.length > 1 ? (
                <select
                  value={business.id}
                  onChange={(event) => selectBusiness(event.target.value)}
                  className="saveat-business-select hidden md:block"
                  aria-label="Выбрать заведение"
                >
                  {memberships.map((membership) => (
                    <option key={membership.id} value={membership.business.id}>
                      {membership.business.name}
                    </option>
                  ))}
                </select>
              ) : null}

              <IconButton
                label="Заказы и уведомления"
                href="/business/orders"
                badge={dashboard.lowStock.length > 0}
              >
                <MobileIcon name="bell" />
              </IconButton>
            </>
          }
        />

        {memberships.length > 1 ? (
          <select
            value={business.id}
            onChange={(event) => selectBusiness(event.target.value)}
            className="saveat-business-select mt-4 w-full max-w-none md:hidden"
            aria-label="Выбрать заведение"
          >
            {memberships.map((membership) => (
              <option key={membership.id} value={membership.business.id}>
                {membership.business.name}
              </option>
            ))}
          </select>
        ) : null}

        {error ? <div className="saveat-alert">{error}</div> : null}

        <HeroCard
          label="Сегодняшние продажи"
          value={Math.round(sales.today)}
          unit="₸"
          delta={sales.deltaToYesterday}
          note={
            sales.weekRevenue > 0
              ? `${money(sales.weekRevenue)} за последние 7 дней · ${dashboard.activeOffers.length} активных предложений`
              : `Пока продаж нет. В витрине ${dashboard.availableUnits} шт. в ${dashboard.activeOffers.length} предложениях.`
          }
          chartCaption="Выручка · 7 дней"
          points={sales.points}
        />

        <section className="saveat-quick-grid" aria-label="Быстрые разделы">
          <QuickActionCard
            href="/business/orders"
            icon="sales"
            title="Продажи"
            description={sales.weekRevenue > 0 ? `${money(sales.weekRevenue)} за неделю` : "Заказы и выручка"}
            tone="pink"
          />
          <QuickActionCard
            href="/business/offers/new"
            icon="stock"
            title="Запасы"
            description={`${dashboard.availableUnits} шт. в витрине`}
            tone="peach"
          />
          <QuickActionCard
            href="/business/pickup"
            icon="orders"
            title="Заказы"
            description="Выдача по QR-коду"
            tone="cream"
          />
          <QuickActionCard
            href="#forecast"
            icon="sparkles"
            title="Прогноз AI"
            description="Спрос на 7 дней"
            tone="green"
          />
        </section>

        {loadingData ? (
          <div className="saveat-empty">Обновляем данные витрины…</div>
        ) : (
          <>
            <div className="saveat-columns">
              <div className="saveat-stack">
                <section className="saveat-section-card">
                  <SectionHeader
                    eyebrow="Остатки в витрине"
                    title="Что требует внимания"
                    action={
                      canManage ? (
                        <Link href="/business/offers/new" className="saveat-text-link">
                          Добавить
                          <MobileIcon name="plus" className="h-4 w-4" />
                        </Link>
                      ) : undefined
                    }
                  />

                  {dashboard.inventory.length > 0 ? (
                    <div className="saveat-inventory-list">
                      {dashboard.inventory.slice(0, 5).map((entry) => (
                        <InventoryCard
                          key={entry.offer.id}
                          href="/business/offers/new"
                          name={entry.offer.title}
                          remaining={entry.remaining}
                          status={entry.status}
                          percent={entry.percent}
                          eta={entry.eta}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="saveat-empty">
                      Добавьте первое предложение — тогда появятся остатки и подсказки по витрине.
                    </p>
                  )}
                </section>

                <section className="saveat-section-card">
                  <SectionHeader
                    eyebrow="Подсказка по закупке"
                    title="Рекомендуемый заказ"
                    action={<Badge tone="primary">до 15%</Badge>}
                  />

                  {dashboard.recommended.length > 0 ? (
                    <>
                      <div className="saveat-order-list">
                        {dashboard.recommended.map((product) => (
                          <ProductRow
                            key={product.id}
                            name={product.name}
                            value={money(Number(product.base_price))}
                            meta={product.category || "Нет в витрине"}
                          />
                        ))}
                      </div>

                      <p className="saveat-saving-note">
                        <MobileIcon name="check" className="h-4 w-4" />
                        Потенциальная экономия до 15% на списаниях
                      </p>

                      {canManage ? (
                        <PrimaryButton href="/business/offers/new">Подтвердить заказ</PrimaryButton>
                      ) : null}
                    </>
                  ) : (
                    <p className="saveat-empty">
                      Весь активный каталог уже в витрине — закупать нечего.
                    </p>
                  )}
                </section>
              </div>

              <div className="saveat-stack">
                <div id="forecast">
                  <ForecastCard
                    headline="Прогноз на 7 дней"
                    title={
                      sales.forecastChange === null
                        ? "Собираем данные"
                        : sales.forecastChange > 0
                          ? "Спрос вырастет"
                          : sales.forecastChange < 0
                            ? "Спрос снизится"
                            : "Спрос стабилен"
                    }
                    value={
                      sales.forecastChange === null
                        ? "—"
                        : `${sales.forecastChange > 0 ? "+" : ""}${sales.forecastChange}%`
                    }
                    hint={
                      sales.topSeller
                        ? `Лидер недели — «${sales.topSeller}». Держите позицию в витрине.`
                        : "Нужна неделя продаж, чтобы прогноз стал точным."
                    }
                    trend={sales.points.map((point) => point.value)}
                    href="/business/orders"
                    cta="Посмотреть продажи"
                  />
                </div>

                <section className="saveat-section-card">
                  <SectionHeader
                    eyebrow="Команда и точки"
                    title="Ваши филиалы"
                    action={
                      canManage ? (
                        <Link href="/business/branches/new" className="saveat-text-link">
                          Добавить
                          <MobileIcon name="plus" className="h-4 w-4" />
                        </Link>
                      ) : undefined
                    }
                  />

                  {branches.length > 0 ? (
                    <div className="saveat-order-list">
                      {branches.map((branch) => (
                        <ProductRow
                          key={branch.id}
                          name={branch.name}
                          value="Точка"
                          meta={branch.address}
                        />
                      ))}
                    </div>
                  ) : canManage ? (
                    <PrimaryButton href="/business/branches/new">Добавить филиал</PrimaryButton>
                  ) : (
                    <p className="saveat-empty">Филиалы пока не добавлены.</p>
                  )}
                </section>
              </div>
            </div>

            <section className="saveat-stat-grid" aria-label="Показатели бизнеса">
              <StatCard
                href="/business/branches/new"
                icon="store"
                label="Филиалы"
                value={branches.length}
                note="Ваши точки"
              />
              <StatCard
                href="/business/products/new"
                icon="stock"
                label="Товары"
                value={dashboard.activeProducts}
                note="Активно в каталоге"
              />
              <StatCard
                href="/business/offers/new"
                icon="sales"
                label="Витрина"
                value={dashboard.activeOffers.length}
                note="Предложений сейчас"
              />
            </section>
          </>
        )}
      </div>

      <MobileBottomNavigation mode="business" />
    </MobilePage>
  );
}
