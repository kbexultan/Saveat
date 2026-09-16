"use client";

import Link from "next/link";

import { SubscribeButton } from "@/components/SubscribeButton";
import {
  formatBranchCount,
  formatOfferCount,
} from "@/lib/plural";

export type BusinessCardData = {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  active_offers: number;
  /** Каталог отдаёт число филиалов, список подписок — нет. */
  branches?: number;
};

/**
 * Карточка заведения: каталог поиска и подписки в профиле
 * показывают одно и то же, отличаясь только тем, откуда
 * пришли данные.
 */
export default function BusinessCard({
  business,
}: {
  business: BusinessCardData;
}) {
  const initial =
    business.name.trim().charAt(0).toUpperCase() || "?";

  const hasOffers = business.active_offers > 0;

  return (
    <div className="flex flex-col justify-between gap-4 rounded-card-lg bg-surface p-5 shadow-soft">
      <div className="min-w-0">
        <div className="flex items-start gap-3">
          {business.logo_url ? (
            // Логотипы приходят с чужих доменов, next/image
            // потребовал бы прописывать каждый в remotePatterns.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={business.logo_url}
              alt=""
              className="h-12 w-12 shrink-0 rounded-tile object-cover"
            />
          ) : (
            <div
              aria-hidden="true"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-tile bg-primary-tint text-lead font-bold text-primary-strong"
            >
              {initial}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h3 className="truncate text-body font-bold">
              <Link
                href={`/businesses/${business.id}`}
                className="transition hover:text-primary-strong"
              >
                {business.name}
              </Link>
            </h3>

            {typeof business.branches === "number" ? (
              <p className="mt-0.5 text-caption text-subtle">
                {formatBranchCount(business.branches)}
              </p>
            ) : null}
          </div>
        </div>

        {business.description ? (
          <p className="mt-3 line-clamp-2 text-caption leading-5 text-muted">
            {business.description}
          </p>
        ) : null}

        <p
          className={`mt-3 text-caption font-semibold ${
            hasOffers ? "text-primary-strong" : "text-subtle"
          }`}
        >
          {hasOffers
            ? `Сейчас доступно: ${formatOfferCount(
                business.active_offers,
              )}`
            : "Сейчас предложений нет"}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SubscribeButton
          businessId={business.id}
          businessName={business.name}
          size="full"
        />

        <Link
          href={`/businesses/${business.id}`}
          className="inline-flex min-h-11 items-center rounded-chip bg-surface-blush px-5 text-body font-bold text-muted transition hover:bg-primary-tint hover:text-primary-strong"
        >
          Открыть
        </Link>
      </div>
    </div>
  );
}
