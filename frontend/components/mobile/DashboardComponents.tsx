"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

/* ==========================================================================
   SAVEAT MOBILE DESIGN SYSTEM
   Переиспользуемые презентационные компоненты. Вся визуальная часть
   опирается на токены из app/globals.css, собственных цветов здесь нет.
   ========================================================================== */

type IconName =
  | "sales"
  | "stock"
  | "orders"
  | "sparkles"
  | "arrow"
  | "bell"
  | "store"
  | "trend"
  | "plus"
  | "check";

export function MobileIcon({
  name,
  className = "",
}: {
  name: IconName;
  className?: string;
}) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
  };

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={`h-5 w-5 ${className}`}>
      {name === "sales" && (
        <>
          <path d="M4 19.5V4.5" {...common} />
          <path d="M4 19.5h16" {...common} />
          <path d="m7 15 3.2-3.3 2.8 1.8 4.6-5" {...common} />
          <path d="M15.2 8.5h2.4v2.4" {...common} />
        </>
      )}
      {name === "stock" && (
        <>
          <path d="m4.2 7.4 7.8 4.3 7.8-4.3" {...common} />
          <path d="M4.2 7.4 12 3l7.8 4.4V17L12 21l-7.8-4V7.4Z" {...common} />
          <path d="M12 11.7V21" {...common} />
        </>
      )}
      {name === "orders" && (
        <>
          <path d="M5.8 8h12.4l-1 11a1.3 1.3 0 0 1-1.3 1.1H8.1A1.3 1.3 0 0 1 6.8 19L5.8 8Z" {...common} />
          <path d="M9.3 9.2V6.7a2.7 2.7 0 1 1 5.4 0v2.5" {...common} />
        </>
      )}
      {name === "sparkles" && (
        <>
          <path d="m12 2 1.2 5.1L18 8.3l-4.8 1.2L12 15l-1.2-5.5L6 8.3l4.8-1.2L12 2Z" {...common} />
          <path d="m18.2 15 .6 2.2L21 18l-2.2.6-.6 2.2-.6-2.2-2.2-.6 2.2-.8.6-2.2Z" {...common} />
        </>
      )}
      {name === "arrow" && <path d="m8.5 5 7 7-7 7M15.1 12H4" {...common} />}
      {name === "bell" && (
        <>
          <path d="M18 10.2c0-3.4-2.2-5.7-6-5.7s-6 2.3-6 5.7c0 5-2 5.3-2 6.7h16c0-1.4-2-1.7-2-6.7Z" {...common} />
          <path d="M9.5 20c.5.6 1.35 1 2.5 1s2-.4 2.5-1" {...common} />
        </>
      )}
      {name === "store" && (
        <>
          <path d="M4 10.2V20h16v-9.8" {...common} />
          <path d="M3 5h18l-1.3 5.2a2.5 2.5 0 0 1-4.7.2 2.8 2.8 0 0 1-5.9 0 2.5 2.5 0 0 1-4.7-.2L3 5Z" {...common} />
          <path d="M8 20v-5h8v5" {...common} />
        </>
      )}
      {name === "trend" && <path d="M5 15.5 10 10l3.2 3 5.8-6.4M14.4 6.6H19v4.6" {...common} />}
      {name === "plus" && <path d="M12 5v14M5 12h14" {...common} />}
      {name === "check" && <path d="m5 12.5 4.6 4.5L19 7.5" {...common} />}
    </svg>
  );
}

/* -------------------------------------------------------------------------
   MobilePage: тёплый фон с мягкими градиентными пятнами
   ------------------------------------------------------------------------- */

export function MobilePage({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <main className={`saveat-mobile-page ${className}`}>{children}</main>;
}

/* -------------------------------------------------------------------------
   AnimatedNumber: аккуратный счётчик для главных чисел
   ------------------------------------------------------------------------- */

export function AnimatedNumber({
  value,
  duration = 900,
}: {
  value: number;
  duration?: number;
}) {
  const [shown, setShown] = useState(value);
  const previous = useRef(value);

  useEffect(() => {
    const from = previous.current;
    const to = value;
    previous.current = value;

    if (from === to) {
      return;
    }

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // При reduce-motion длительность нулевая: значение доезжает
    // за один кадр, но код остаётся единым.
    const total = reduceMotion ? 0 : duration;

    let frame = 0;
    const started = performance.now();

    function step(now: number) {
      const progress = total === 0 ? 1 : Math.min(1, (now - started) / total);
      // easeOutCubic — быстро стартует, мягко замедляется
      const eased = 1 - Math.pow(1 - progress, 3);

      setShown(Math.round(from + (to - from) * eased));

      if (progress < 1) {
        frame = requestAnimationFrame(step);
      }
    }

    frame = requestAnimationFrame(step);

    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return <>{shown.toLocaleString("ru-RU")}</>;
}

/* -------------------------------------------------------------------------
   BarChart: столбцы по реальным данным
   ------------------------------------------------------------------------- */

export type ChartPoint = {
  label: string;
  value: number;
};

export function BarChart({ points }: { points: ChartPoint[] }) {
  const max = Math.max(...points.map((point) => point.value), 1);

  return (
    <div className="saveat-bars" aria-hidden="true">
      {points.map((point, index) => (
        <span key={`${point.label}-${index}`}>
          <i
            className={point.value === max && max > 0 ? "is-peak" : undefined}
            style={{
              height: `${Math.max(6, Math.round((point.value / max) * 100))}%`,
              animationDelay: `${index * 55}ms`,
            }}
          />
          <small>{point.label}</small>
        </span>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------
   Topbar: аватар, приветствие, действия
   ------------------------------------------------------------------------- */

export function Topbar({
  avatar,
  greeting,
  subline,
  actions,
}: {
  avatar: ReactNode;
  greeting: string;
  subline: string;
  actions?: ReactNode;
}) {
  return (
    <div className="saveat-topbar">
      <div className="saveat-topbar__identity">
        <div className="saveat-avatar" aria-hidden="true">
          {avatar}
        </div>
        <div className="saveat-topbar__copy">
          <p className="saveat-topbar__greeting">{greeting}</p>
          <p className="saveat-topbar__subline">{subline}</p>
        </div>
      </div>
      {actions ? <div className="saveat-topbar__actions">{actions}</div> : null}
    </div>
  );
}

export function IconButton({
  label,
  href,
  onClick,
  badge = false,
  children,
}: {
  label: string;
  href?: string;
  onClick?: () => void;
  badge?: boolean;
  children: ReactNode;
}) {
  const inner = (
    <>
      {children}
      {badge ? <span className="saveat-icon-button__dot" /> : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} aria-label={label} title={label} className="saveat-icon-button">
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="saveat-icon-button">
      {inner}
    </button>
  );
}

/* -------------------------------------------------------------------------
   HeroCard: главное число экрана
   ------------------------------------------------------------------------- */

export function HeroCard({
  label,
  value,
  unit,
  delta,
  note,
  chartCaption,
  points,
}: {
  label: string;
  value: number;
  unit: string;
  delta: number | null;
  note: string;
  chartCaption: string;
  points: ChartPoint[];
}) {
  const isDown = delta !== null && delta < 0;

  return (
    <section className="saveat-hero" aria-label={label}>
      <div>
        <p className="saveat-hero__label">{label}</p>
        <strong className="saveat-hero__value">
          <AnimatedNumber value={value} /> {unit}
        </strong>

        {delta !== null ? (
          <span className={`saveat-hero__delta ${isDown ? "is-down" : ""}`}>
            <MobileIcon name="trend" />
            {isDown ? "" : "+"}
            {delta}% к вчера
          </span>
        ) : null}

        <p className="saveat-hero__note">{note}</p>
      </div>

      <div className="saveat-hero__chart">
        <span className="saveat-hero__chart-caption">{chartCaption}</span>
        <BarChart points={points} />
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------
   SectionHeader
   ------------------------------------------------------------------------- */

export function SectionHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="saveat-section-header">
      <div className="min-w-0">
        {eyebrow ? <p className="saveat-section-header__eyebrow">{eyebrow}</p> : null}
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}

/* -------------------------------------------------------------------------
   Badge
   ------------------------------------------------------------------------- */

export type BadgeTone = "critical" | "low" | "healthy" | "neutral" | "primary";

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: BadgeTone;
  children: ReactNode;
}) {
  return <em className={`saveat-badge saveat-badge--${tone}`}>{children}</em>;
}

/* -------------------------------------------------------------------------
   PrimaryButton: работает и как ссылка, и как кнопка
   ------------------------------------------------------------------------- */

export function PrimaryButton({
  href,
  onClick,
  disabled = false,
  children,
  className = "",
}: {
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
}) {
  if (href && !disabled) {
    return (
      <Link href={href} className={`saveat-primary-button ${className}`}>
        <span>{children}</span>
        <MobileIcon name="arrow" />
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`saveat-primary-button ${className}`}
    >
      <span>{children}</span>
      <MobileIcon name="arrow" />
    </button>
  );
}

/* -------------------------------------------------------------------------
   StatCard
   ------------------------------------------------------------------------- */

export function StatCard({
  label,
  value,
  note,
  icon,
  href,
}: {
  label: string;
  value: string | number;
  note: string;
  icon: IconName;
  href: string;
}) {
  return (
    <Link href={href} className="saveat-stat-card">
      <span className="saveat-stat-card__icon">
        <MobileIcon name={icon} />
      </span>
      <span className="saveat-stat-card__label">{label}</span>
      <strong>{value}</strong>
      <span className="saveat-stat-card__note">{note}</span>
    </Link>
  );
}

/* -------------------------------------------------------------------------
   QuickActionCard: mini widget, а не маленькая кнопка
   ------------------------------------------------------------------------- */

export function QuickActionCard({
  icon,
  title,
  description,
  href,
  tone = "pink",
}: {
  icon: IconName;
  title: string;
  description: string;
  href: string;
  tone?: "pink" | "peach" | "cream" | "green";
}) {
  return (
    <Link href={href} className={`saveat-quick-action saveat-quick-action--${tone}`}>
      <span className="saveat-quick-action__icon">
        <MobileIcon name={icon} />
      </span>
      <span className="saveat-quick-action__copy">
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <MobileIcon name="arrow" className="saveat-quick-action__arrow h-4 w-4" />
    </Link>
  );
}

/* -------------------------------------------------------------------------
   ForecastCard: AI-прогноз на 7 дней
   ------------------------------------------------------------------------- */

export function ForecastCard({
  headline,
  title,
  value,
  hint,
  trend,
  href,
  cta,
}: {
  headline: string;
  title: string;
  value: string;
  hint: string;
  trend: number[];
  href: string;
  cta: string;
}) {
  const max = Math.max(...trend, 1);

  return (
    <section className="saveat-forecast" aria-label="Прогноз спроса">
      <div className="saveat-forecast__glow" />

      <div className="saveat-forecast__top">
        <span className="saveat-forecast__icon">
          <MobileIcon name="sparkles" />
        </span>
        <span>AI Forecast</span>
      </div>

      <div className="saveat-forecast__body">
        <div className="min-w-0">
          <p className="saveat-forecast__headline">{headline}</p>
          <h3>{title}</h3>
          <strong className="saveat-forecast__value">{value}</strong>
          <small className="saveat-forecast__hint">{hint}</small>
        </div>

        <div className="saveat-forecast__trend" aria-hidden="true">
          {trend.map((point, index) => (
            <i
              key={index}
              style={{
                height: `${Math.max(8, Math.round((point / max) * 100))}%`,
                animationDelay: `${index * 55}ms`,
              }}
            />
          ))}
        </div>
      </div>

      <Link href={href} className="saveat-forecast__cta">
        {cta}
        <MobileIcon name="arrow" />
      </Link>
    </section>
  );
}

/* -------------------------------------------------------------------------
   ProgressBar
   ------------------------------------------------------------------------- */

export function ProgressBar({
  value,
  tone = "pink",
}: {
  value: number;
  tone?: "pink" | "warning" | "success";
}) {
  return (
    <span className={`saveat-progress saveat-progress--${tone}`}>
      <i style={{ width: `${Math.max(6, Math.min(100, value))}%` }} />
    </span>
  );
}

/* -------------------------------------------------------------------------
   InventoryCard: остатки карточками, красный только для критичного
   ------------------------------------------------------------------------- */

export type StockStatus = "critical" | "low" | "healthy";

export function InventoryCard({
  name,
  remaining,
  unit = "шт.",
  status,
  percent,
  eta,
  href,
}: {
  name: string;
  remaining: number;
  unit?: string;
  status: StockStatus;
  percent: number;
  eta: string;
  href: string;
}) {
  const badgeLabel =
    status === "critical" ? "Критично" : status === "low" ? "Мало" : "В наличии";

  return (
    <Link href={href} className="saveat-inventory-card">
      <div className="saveat-inventory-card__line">
        <div>
          <strong>{name}</strong>
          <span>
            {remaining} {unit} осталось
          </span>
        </div>
        <Badge tone={status}>{badgeLabel}</Badge>
      </div>

      <ProgressBar
        value={percent}
        tone={status === "critical" ? "warning" : status === "low" ? "pink" : "success"}
      />

      <p className={`saveat-inventory-card__eta is-${status}`}>{eta}</p>
    </Link>
  );
}

/* -------------------------------------------------------------------------
   ProductRow: строка списка покупок
   ------------------------------------------------------------------------- */

export function ProductRow({
  name,
  value,
  meta,
}: {
  name: string;
  value: string;
  meta?: string;
}) {
  return (
    <div className="saveat-product-row">
      <div>
        <strong>{name}</strong>
        {meta ? <small>{meta}</small> : null}
      </div>
      <span className="saveat-product-row__value">{value}</span>
    </div>
  );
}

/* -------------------------------------------------------------------------
   BottomSheet
   ------------------------------------------------------------------------- */

export function BottomSheet({ children }: { children: ReactNode }) {
  return (
    <aside className="saveat-bottom-sheet">
      <span className="saveat-bottom-sheet__handle" />
      {children}
    </aside>
  );
}
