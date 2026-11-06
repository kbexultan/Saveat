import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Alert, Image, Pressable, ScrollView, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import {
  EmptyState,
  InlineError,
  LoadingState,
} from "@/components/StateViews";
import { canCheckout, maxQuantityFor } from "@/lib/cartAvailability";
import { checkoutAttempt, type CheckoutAttempt } from "@/lib/checkoutAttempt";
import { readJson, removeKey, STORAGE_KEYS, writeJson } from "@/lib/storage";
import { useAuth } from "@/contexts/AuthContext";
import { useCart, type CartItem } from "@/contexts/CartContext";
import { ApiError, NetworkError, api } from "@/lib/api";
import {
  CHECKOUT_NETWORK_ERROR_MESSAGE,
  describeCheckoutError,
  describeCheckoutFailure,
} from "@/lib/checkoutErrors";
import {
  categoryEmoji,
  formatPickupWindow,
  formatPrice,
  toNumber,
} from "@/lib/format";

/**
 * Russian message for a failed checkout. The raw backend text (e.g.
 * "Круассан is unavailable") only goes to the dev console.
 */
function describeCheckoutCaught(caught: unknown): string {
  if (__DEV__) {
    console.warn("[checkout] failed", caught);
  }

  if (caught instanceof ApiError) {
    // For string details ApiError.message is the backend `detail`.
    return describeCheckoutError(caught.status, caught.message).message;
  }

  if (caught instanceof NetworkError) {
    return CHECKOUT_NETWORK_ERROR_MESSAGE;
  }

  return describeCheckoutFailure(caught).message;
}

function CartRow({
  item,
  onIncrement,
  onDecrement,
  onRemove,
  disabled,
}: {
  item: CartItem;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
  disabled: boolean;
}) {
  const { offer, quantity } = item;

  const maxQuantity = maxQuantityFor(offer);

  const lineTotal = toNumber(offer.sale_price) * quantity;

  return (
    <View className="gap-4 rounded-3xl border border-line bg-card p-4">
      <View className="flex-row gap-4">
        <View className="h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-blush">
          {offer.product_image_url ? (
            <Image
              source={{ uri: offer.product_image_url }}
              accessibilityLabel={offer.product_name ?? offer.title}
              resizeMode="cover"
              className="h-full w-full"
            />
          ) : (
            <Text className="text-3xl">
              {categoryEmoji(offer.category)}
            </Text>
          )}
        </View>

        <View className="flex-1">
          <Text className="text-base font-semibold text-ink">
            {offer.product_name ?? offer.title}
          </Text>

          <Text className="mt-0.5 text-xs text-subtle">
            {offer.business_name} · {offer.branch_name}
          </Text>

          <Text className="mt-2 text-sm font-medium text-ink">
            {formatPrice(offer.sale_price)}{" "}
            <Text className="text-xs text-subtle line-through">
              {formatPrice(offer.original_price)}
            </Text>
          </Text>
        </View>
      </View>

      <View className="flex-row items-center justify-between gap-3 border-t border-line pt-3">
        <View className="flex-row items-center gap-3">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Уменьшить количество"
            onPress={onDecrement}
            disabled={disabled || quantity <= 1}
            className={
              "h-11 w-11 items-center justify-center rounded-xl border border-border bg-card " +
              (disabled || quantity <= 1 ? "opacity-40" : "active:bg-blush")
            }
          >
            <Text className="text-xl font-semibold text-ink">−</Text>
          </Pressable>

          <Text className="min-w-8 text-center text-base font-bold text-ink">
            {quantity}
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Увеличить количество"
            onPress={onIncrement}
            disabled={disabled || quantity >= maxQuantity}
            className={
              "h-11 w-11 items-center justify-center rounded-xl border border-border bg-card " +
              (disabled || quantity >= maxQuantity
                ? "opacity-40"
                : "active:bg-blush")
            }
          >
            <Text className="text-xl font-semibold text-ink">+</Text>
          </Pressable>
        </View>

        <Text className="text-base font-bold text-ink">
          {formatPrice(lineTotal)}
        </Text>
      </View>

      <View className="flex-row items-center justify-between gap-3">
        <Text className="text-xs text-muted">
          {maxQuantity > 0 ? `Осталось ${maxQuantity} шт.` : "Нет в наличии"}
        </Text>

        <Pressable
          accessibilityRole="button"
          onPress={onRemove}
          disabled={disabled}
          className={
            "min-h-[36px] justify-center rounded-xl px-3 " +
            (disabled ? "opacity-40" : "active:bg-blush")
          }
        >
          <Text className="text-sm font-medium text-danger">Удалить</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function CartScreen() {
  const router = useRouter();

  const { user, isAuthenticated, loading: authLoading } = useAuth();

  const {
    items,
    loading,
    totalItems,
    totalPrice,
    businessName,
    branchName,
    address,
    increment,
    decrement,
    removeItem,
    clearCart,
    syncWithOffers,
  } = useCart();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  // `submitting` in this closure can be stale on a fast double tap;
  // the ref stops the second request synchronously.
  const submittingRef = useRef(false);
  const attemptRef = useRef<CheckoutAttempt | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const hasItems = items.length > 0;

  useFocusEffect(useCallback(() => {
    if (loading || !hasItems) return;
    const controller = new AbortController();
    setCheckingAvailability(true);
    void api.offers.publicList(controller.signal).then(syncWithOffers).catch(() => {
      if (!controller.signal.aborted) {
        syncWithOffers([]);
        setError("Не удалось проверить наличие. Обновите остатки и попробуйте снова.");
      }
    }).finally(() => {
      if (!controller.signal.aborted) setCheckingAvailability(false);
    });
    return () => controller.abort();
  }, [loading, hasItems, syncWithOffers]));

  const pickupStart = items.reduce<string | null>((latest, item) => {
    if (!latest || item.offer.pickup_start > latest) {
      return item.offer.pickup_start;
    }

    return latest;
  }, null);

  const pickupEnd = items.reduce<string | null>((earliest, item) => {
    if (!earliest || item.offer.pickup_end < earliest) {
      return item.offer.pickup_end;
    }

    return earliest;
  }, null);

  async function handleCheckout() {
    if (submittingRef.current || checkingAvailability || !canCheckout(items)) {
      return;
    }

    if (!isAuthenticated) {
      router.push("/login?redirect=%2Fcart");
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setError("");

    try {
      const checkoutItems = items.map((item) => ({ offer_id: item.offer.id, quantity: item.quantity }));
      const previous = attemptRef.current ?? await readJson<CheckoutAttempt>(STORAGE_KEYS.checkoutAttempt);
      const attempt = checkoutAttempt(previous, user!.id, checkoutItems,
        () => `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`);
      attemptRef.current = attempt;
      await writeJson(STORAGE_KEYS.checkoutAttempt, attempt);
      // Заказ целиком создаёт backend: он же проверяет остатки,
      // считает сумму и выдаёт pickup_code.
      const order = await api.orders.checkout({
        idempotency_key: attempt.key,
        items: items.map((item) => ({
          offer_id: item.offer.id,
          quantity: item.quantity,
        })),
        payment_method: "pay_on_pickup",
      });

      clearCart();
      attemptRef.current = null;
      await removeKey(STORAGE_KEYS.checkoutAttempt);

      router.replace(`/orders/${order.id}`);
    } catch (caught) {
      // Cart items are kept so the customer can adjust and retry.
      setError(describeCheckoutCaught(caught));
      if (caught instanceof ApiError && [409, 404].includes(caught.status)) {
        try {
          syncWithOffers(await api.offers.publicList());
        } catch {
          // Availability is unknown; fail closed while retaining all cart rows.
          syncWithOffers([]);
        }
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  function handleClear() {
    Alert.alert("Очистить корзину?", "Все позиции будут удалены.", [
      { text: "Отмена", style: "cancel" },
      { text: "Очистить", style: "destructive", onPress: clearCart },
    ]);
  }

  if (loading || authLoading) {
    return (
      <Screen edges={["left", "right", "bottom"]}>
        <LoadingState />
      </Screen>
    );
  }

  if (items.length === 0) {
    return (
      <Screen edges={["left", "right", "bottom"]}>
        <EmptyState
          emoji="🛒"
          title="Корзина пуста"
          description="Добавьте предложение с главной — и оно появится здесь."
          actionLabel="К предложениям"
          onAction={() => router.replace("/")}
        />
      </Screen>
    );
  }

  return (
    <Screen edges={["left", "right", "bottom"]}>
      <ScrollView
        contentContainerClassName="gap-4 px-4 pb-6 pt-4"
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-1 rounded-3xl border border-line bg-card p-5">
          <Text className="text-xs font-semibold uppercase text-subtle">
            Забрать здесь
          </Text>

          <Text className="mt-1 text-base font-semibold text-ink">
            {businessName}
          </Text>

          <Text className="text-sm text-muted">{branchName}</Text>

          <Text className="mt-1 text-xs text-muted">📍 {address}</Text>

          {pickupStart && pickupEnd ? (
            <Text className="mt-2 text-xs text-muted">
              🕒 {formatPickupWindow(pickupStart, pickupEnd)}
            </Text>
          ) : null}

          <Text className="mt-3 text-xs text-subtle">
            В одном заказе — товары одного филиала.
          </Text>
        </View>

        {items.map((item) => (
          <CartRow
            key={item.offer.id}
            item={item}
            disabled={submitting}
            onIncrement={() => increment(item.offer.id)}
            onDecrement={() => decrement(item.offer.id)}
            onRemove={() => removeItem(item.offer.id)}
          />
        ))}

        {error ? <InlineError message={error} /> : null}
        {!canCheckout(items) ? <InlineError message="Некоторые товары недоступны. Измените количество или удалите их." /> : null}

        <Button label="Обновить остатки" variant="ghost" disabled={submitting || checkingAvailability}
          onPress={() => {
            setCheckingAvailability(true);
            void api.offers.publicList().then(syncWithOffers).catch(() => {
              syncWithOffers([]);
              setError("Не удалось проверить наличие. Попробуйте позже.");
            }).finally(() => setCheckingAvailability(false));
          }} />

        <Button
          label="Очистить корзину"
          variant="ghost"
          onPress={handleClear}
          disabled={submitting}
        />
      </ScrollView>

      <View className="gap-3 border-t border-line bg-card px-4 pb-4 pt-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-muted">
            Итого · {totalItems} шт.
          </Text>

          <Text className="text-2xl font-bold text-ink">
            {formatPrice(totalPrice)}
          </Text>
        </View>

        <Text className="text-xs text-muted">
          Оплата при получении в заведении.
        </Text>

        <Button
          label={
            isAuthenticated ? "Оформить заказ" : "Войти и оформить заказ"
          }
          onPress={() => void handleCheckout()}
          loading={submitting}
          disabled={checkingAvailability || !canCheckout(items)}
        />
      </View>
    </Screen>
  );
}
