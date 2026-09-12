import { useState } from "react";
import { Image, Pressable, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { MAX_QUANTITY_PER_OFFER } from "@/constants/theme";
import { useCart } from "@/contexts/CartContext";
import {
  calculateDiscount,
  categoryEmoji,
  formatPickupWindow,
  formatPrice,
  toNumber,
} from "@/lib/format";
import { formatDistance } from "@/lib/geo";
import type { PublicOffer } from "@/types/api";

type OfferCardProps = {
  offer: PublicOffer;
  /** Расстояние от пользователя, если геопозиция разрешена. */
  distanceKm?: number | null;
  onOpenCart?: () => void;
};

function Stepper({
  quantity,
  max,
  onDecrease,
  onIncrease,
}: {
  quantity: number;
  max: number;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  return (
    <View className="flex-row items-center gap-3">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Уменьшить количество"
        onPress={onDecrease}
        disabled={quantity <= 1}
        className={
          "h-11 w-11 items-center justify-center rounded-xl " +
          `border border-border bg-card ${
            quantity <= 1 ? "opacity-40" : "active:bg-blush"
          }`
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
        onPress={onIncrease}
        disabled={quantity >= max}
        className={
          "h-11 w-11 items-center justify-center rounded-xl " +
          `border border-border bg-card ${
            quantity >= max ? "opacity-40" : "active:bg-blush"
          }`
        }
      >
        <Text className="text-xl font-semibold text-ink">+</Text>
      </Pressable>
    </View>
  );
}

export function OfferCard({
  offer,
  distanceKm,
  onOpenCart,
}: OfferCardProps) {
  const { addItem } = useCart();

  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const originalPrice = toNumber(offer.original_price);
  const salePrice = toNumber(offer.sale_price);
  const discount = calculateDiscount(originalPrice, salePrice);

  const maxQuantity = Math.min(
    offer.quantity_remaining,
    MAX_QUANTITY_PER_OFFER,
  );

  const soldOut = offer.quantity_remaining <= 0;

  // Витрина обновилась и остатка стало меньше — показываем
  // столько, сколько реально можно заказать.
  const quantity = Math.min(selectedQuantity, Math.max(1, maxQuantity));

  function handleAdd() {
    setMessage("");
    setError("");

    const result = addItem(offer, quantity);

    if (!result.success) {
      setError(result.message);
      return;
    }

    setMessage(result.message);
    setSelectedQuantity(1);
  }

  return (
    <View className="overflow-hidden rounded-3xl border border-line bg-card">
      <View className="h-48 items-center justify-center bg-blush">
        {offer.product_image_url ? (
          <Image
            source={{ uri: offer.product_image_url }}
            accessibilityLabel={offer.product_name ?? offer.title}
            resizeMode="cover"
            className="h-full w-full"
          />
        ) : (
          <Text className="text-6xl">
            {categoryEmoji(offer.category)}
          </Text>
        )}

        {discount > 0 ? (
          <View className="absolute right-4 top-4 rounded-full bg-primary px-3 py-1.5">
            <Text className="text-xs font-bold text-white">
              -{discount}%
            </Text>
          </View>
        ) : null}

        {typeof distanceKm === "number" ? (
          <View className="absolute left-4 top-4 rounded-full bg-card/90 px-3 py-1.5">
            <Text className="text-xs font-semibold text-ink">
              {formatDistance(distanceKm)}
            </Text>
          </View>
        ) : null}
      </View>

      <View className="gap-1 p-5">
        <Text className="text-sm font-medium text-subtle">
          {offer.business_name}
        </Text>

        <Text className="text-xl font-semibold text-ink">
          {offer.product_name ?? offer.title}
        </Text>

        <Text className="text-xs text-subtle">{offer.branch_name}</Text>

        <View className="mt-3 flex-row items-end gap-2">
          <Text className="text-2xl font-bold text-ink">
            {formatPrice(salePrice)}
          </Text>

          <Text className="pb-1 text-sm text-subtle line-through">
            {formatPrice(originalPrice)}
          </Text>
        </View>

        <View className="mt-4 gap-3 rounded-2xl bg-surface p-4">
          <View className="flex-row items-center justify-between gap-3">
            <Text className="text-sm text-muted">Забрать</Text>

            <Text className="text-sm font-medium text-ink">
              {formatPickupWindow(offer.pickup_start, offer.pickup_end)}
            </Text>
          </View>

          <View className="flex-row items-center justify-between gap-3">
            <Text className="text-sm text-muted">Осталось</Text>

            <Text className="text-sm font-semibold text-primary-dark">
              {offer.quantity_remaining} шт.
            </Text>
          </View>

          <View className="border-t border-line pt-3">
            <Text className="text-xs text-muted">📍 {offer.address}</Text>
          </View>
        </View>

        {!soldOut ? (
          <View className="mt-4 rounded-2xl border border-line bg-card p-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-medium text-muted">
                Количество
              </Text>

              <Stepper
                quantity={quantity}
                max={maxQuantity}
                onDecrease={() => {
                  setSelectedQuantity(Math.max(1, quantity - 1));
                  setMessage("");
                  setError("");
                }}
                onIncrease={() => {
                  setSelectedQuantity(
                    Math.min(maxQuantity, quantity + 1),
                  );
                  setMessage("");
                  setError("");
                }}
              />
            </View>

            <View className="mt-3 flex-row items-center justify-between border-t border-line pt-3">
              <Text className="text-sm text-muted">Итого</Text>

              <Text className="text-lg font-bold text-ink">
                {formatPrice(salePrice * quantity)}
              </Text>
            </View>
          </View>
        ) : null}

        {message ? (
          <Text className="mt-3 text-sm font-medium text-success">
            ✓ {message}
          </Text>
        ) : null}

        {error ? (
          <Text className="mt-3 text-sm font-medium text-danger">
            {error}
          </Text>
        ) : null}

        <View className="mt-4 gap-2">
          <Button
            label={soldOut ? "Распродано" : "Добавить в корзину"}
            onPress={handleAdd}
            disabled={soldOut}
          />

          {message && onOpenCart ? (
            <Button
              label="Перейти в корзину"
              onPress={onOpenCart}
              variant="secondary"
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}
