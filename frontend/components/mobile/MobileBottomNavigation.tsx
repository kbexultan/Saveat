"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useCart } from "@/components/CartProvider";

type NavigationMode = "customer" | "business";

type IconName = "home" | "map" | "bag" | "user" | "plus" | "chart" | "scan";

function NavigationIcon({ name }: { name: IconName }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
  };

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
      {name === "home" && (
        <>
          <path d="m3.5 10.3 8.5-7 8.5 7" {...common} />
          <path d="M5.5 9.7V19a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.7" {...common} />
          <path d="M9.6 20v-5.3h4.8V20" {...common} />
        </>
      )}
      {name === "map" && (
        <>
          <path d="m8.7 3.8-5.1 2.3v13.7l5.1-2.3 6.6 2.6 5.1-2.3V4.1l-5.1 2.3-6.6-2.6Z" {...common} />
          <path d="M8.7 3.8v13.7M15.3 6.4v13.7" {...common} />
        </>
      )}
      {name === "bag" && (
        <>
          <path d="M5.8 8h12.4l-1 11a1.3 1.3 0 0 1-1.3 1.1H8.1A1.3 1.3 0 0 1 6.8 19L5.8 8Z" {...common} />
          <path d="M9.3 9.2V6.7a2.7 2.7 0 1 1 5.4 0v2.5" {...common} />
        </>
      )}
      {name === "user" && (
        <>
          <circle cx="12" cy="8" r="3.8" {...common} />
          <path d="M4.5 20.4c0-3.8 3.35-6.3 7.5-6.3s7.5 2.5 7.5 6.3" {...common} />
        </>
      )}
      {name === "chart" && (
        <>
          <path d="M4 19.5V4.5" {...common} />
          <path d="M4 19.5h16" {...common} />
          <path d="m7 15 3.2-3.3 2.8 1.8 4.6-5" {...common} />
          <path d="M15.2 8.5h2.4v2.4" {...common} />
        </>
      )}
      {name === "scan" && (
        <>
          <path d="M4 8.5V6a2 2 0 0 1 2-2h2.5M15.5 4H18a2 2 0 0 1 2 2v2.5M20 15.5V18a2 2 0 0 1-2 2h-2.5M8.5 20H6a2 2 0 0 1-2-2v-2.5" {...common} />
          <path d="M4 12h16" {...common} />
        </>
      )}
      {name === "plus" && <path d="M12 5v14M5 12h14" {...common} />}
    </svg>
  );
}

type NavigationItem = {
  href: string;
  label: string;
  icon: IconName;
  match: string;
  accent?: boolean;
  /** Показывать число товаров в корзине поверх иконки. */
  cartCount?: boolean;
};

const customerItems: NavigationItem[] = [
  { href: "/", label: "Главная", icon: "home", match: "/" },
  { href: "/map", label: "Карта", icon: "map", match: "/map" },
  { href: "/cart", label: "Корзина", icon: "bag", match: "/cart", accent: true, cartCount: true },
  { href: "/orders", label: "Заказы", icon: "chart", match: "/orders" },
  { href: "/profile", label: "Профиль", icon: "user", match: "/profile" },
];

const businessItems: NavigationItem[] = [
  { href: "/business/dashboard", label: "Главная", icon: "home", match: "/business/dashboard" },
  { href: "/business/orders", label: "Продажи", icon: "chart", match: "/business/orders" },
  { href: "/business/offers/new", label: "Добавить", icon: "plus", match: "/business/offers/new", accent: true },
  { href: "/business/pickup", label: "Выдача", icon: "scan", match: "/business/pickup" },
  { href: "/profile", label: "Профиль", icon: "user", match: "/profile" },
];

function isCurrentPath(pathname: string, item: NavigationItem) {
  if (item.match === "/") {
    return pathname === "/";
  }

  return pathname === item.match || pathname.startsWith(`${item.match}/`);
}

/**
 * Плавающая нижняя навигация. Видна только на мобильном брейкпоинте —
 * десктопная шапка продолжает работать как раньше.
 *
 * Компонент сам рендерит распорку под себя, поэтому страницы без
 * навигации не получают лишнего отступа снизу.
 */
export function MobileBottomNavigation({ mode = "customer" }: { mode?: NavigationMode }) {
  const pathname = usePathname();
  const { totalItems } = useCart();
  const items = mode === "business" ? businessItems : customerItems;

  return (
    <nav aria-label="Основная навигация" className="saveat-nav">
      {items.map((item) => {
        const active = isCurrentPath(pathname, item);
        const showCount = item.cartCount && totalItems > 0;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
            className={`saveat-nav__item ${active ? "is-active" : ""} ${item.accent ? "is-accent" : ""}`}
          >
            <span className="saveat-nav__icon">
              <NavigationIcon name={item.icon} />
              {showCount ? (
                <span className="saveat-nav__count">
                  {totalItems > 99 ? "99+" : totalItems}
                </span>
              ) : null}
            </span>
            {!item.accent && <span>{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

/** Короткий псевдоним для дизайн-системы. */
export { MobileBottomNavigation as BottomNavigation };
