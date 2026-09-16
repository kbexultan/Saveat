"use client";

import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/components/AuthProvider";
import { useSubscriptions } from "@/components/SubscriptionsProvider";

/**
 * Подписка на заведение прямо с карточки предложения.
 *
 * Отличается от сердечка на предложении: то избранное исчезает, когда
 * предложение разобрали. Подписка держится на заведении и приносит
 * уведомления о каждой новой скидке.
 */
export function SubscribeButton({
  businessId,
  businessName,
  size = "compact",
}: {
  businessId: string;
  businessName: string;
  size?: "compact" | "full";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading: authLoading } = useAuth();

  const {
    isSubscribed,
    pendingIds,
    toggleSubscription,
  } = useSubscriptions();

  const subscribed = isSubscribed(businessId);
  const pending = pendingIds.has(businessId);

  function handleClick() {
    if (authLoading || pending) {
      return;
    }

    if (!user) {
      // Возвращаем на ту же страницу, а не на главную: кнопка живёт
      // и на карточке предложения, и на странице заведения, и после
      // входа человек ожидает оказаться там, где нажал.
      const params = new URLSearchParams({
        next: pathname || "/",
      });

      router.push(`/login?${params.toString()}`);
      return;
    }

    void toggleSubscription(businessId, businessName);
  }

  const label = subscribed
    ? `Отписаться от «${businessName}»`
    : `Подписаться на «${businessName}» и получать новые скидки`;

  if (size === "full") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={authLoading || pending}
        aria-pressed={subscribed}
        aria-label={label}
        className={`min-h-11 rounded-chip px-5 text-body font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${
          subscribed
            ? "bg-surface-blush text-primary-strong shadow-soft hover:bg-primary-tint"
            : "bg-primary text-white shadow-primary hover:bg-primary-strong"
        }`}
      >
        {pending
          ? "Минуту…"
          : subscribed
            ? "Вы подписаны"
            : "Подписаться"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={authLoading || pending}
      aria-pressed={subscribed}
      aria-label={label}
      title={label}
      className={`inline-flex min-h-8 shrink-0 items-center gap-1 rounded-pill px-2.5 text-caption font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${
        subscribed
          ? "bg-primary-tint text-primary-strong"
          : "bg-surface-blush text-subtle hover:bg-primary-tint hover:text-primary-strong"
      }`}
    >
      <span aria-hidden="true">
        {subscribed ? "★" : "☆"}
      </span>

      {subscribed ? "Подписка" : "Подписаться"}
    </button>
  );
}
