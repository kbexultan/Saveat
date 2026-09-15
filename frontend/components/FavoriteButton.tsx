"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/components/AuthProvider";
import { useFavorites } from "@/components/FavoritesProvider";
import type { Offer } from "@/components/OfferCard";

export function FavoriteButton({ offer }: { offer: Offer }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const { user, loading: authLoading } = useAuth();
  const {
    isFavorite,
    loading: favoritesLoading,
    pendingIds,
    toggleFavorite,
  } = useFavorites();

  const favorite = isFavorite(offer.id);
  const pending = pendingIds.has(offer.id);
  const label = favorite ? "Убрать из избранного" : "Добавить в избранное";

  async function handleClick() {
    if (authLoading || favoritesLoading || pending) {
      return;
    }

    if (!user) {
      const params = new URLSearchParams({
        next: "/favorites",
        favorite: offer.id,
      });

      router.push(`/login?${params.toString()}`);
      return;
    }

    setError("");

    try {
      await toggleFavorite(offer);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Не удалось обновить избранное.",
      );
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={authLoading || favoritesLoading || pending}
        aria-label={label}
        aria-pressed={favorite}
        title={label}
        className={`absolute left-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-chip shadow-soft backdrop-blur transition disabled:cursor-wait disabled:opacity-70 ${
          favorite
            ? "bg-primary text-white"
            : "bg-surface/90 text-primary-strong hover:bg-primary-tint"
        }`}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill={favorite ? "currentColor" : "none"}
          aria-hidden="true"
        >
          <path
            d="M20.8 5.8a5.2 5.2 0 0 0-7.4 0L12 7.2l-1.4-1.4a5.2 5.2 0 1 0-7.4 7.4L12 22l8.8-8.8a5.2 5.2 0 0 0 0-7.4Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {error ? (
        <span
          role="alert"
          className="absolute left-3 top-16 z-10 max-w-52 rounded-chip bg-danger-tint px-3 py-2 text-meta font-bold text-danger-ink shadow-soft"
        >
          {error}
        </span>
      ) : null}
    </>
  );
}
