import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import MapView, { Marker, type Region } from "react-native-maps";

import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/StateViews";
import { ALMATY_REGION } from "@/constants/theme";
import { useCart } from "@/contexts/CartContext";
import { useApiResource } from "@/hooks/useApiResource";
import { useUserLocation } from "@/hooks/useUserLocation";
import { api } from "@/lib/api";
import { calculateDiscount, formatPickupWindow, formatPrice } from "@/lib/format";
import { distanceInKm, formatDistance, openDirections } from "@/lib/geo";
import type { PublicOffer } from "@/types/api";

type BranchPoint = {
  branchId: string;
  branchName: string;
  businessName: string;
  address: string;
  latitude: number;
  longitude: number;
  offers: PublicOffer[];
};

function groupByBranch(offers: PublicOffer[]): BranchPoint[] {
  const points = new Map<string, BranchPoint>();

  for (const offer of offers) {
    if (offer.latitude === null || offer.longitude === null) {
      // У филиала не заполнены координаты — на карте показать нечего.
      continue;
    }

    const existing = points.get(offer.branch_id);

    if (existing) {
      existing.offers.push(offer);
      continue;
    }

    points.set(offer.branch_id, {
      branchId: offer.branch_id,
      branchName: offer.branch_name,
      businessName: offer.business_name,
      address: offer.address,
      latitude: offer.latitude,
      longitude: offer.longitude,
      offers: [offer],
    });
  }

  return Array.from(points.values());
}

export default function MapScreen() {
  const router = useRouter();
  const { addItem } = useCart();
  const { permission, coordinates, request } = useUserLocation();

  const mapRef = useRef<MapView | null>(null);

  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(
    null,
  );

  const [feedback, setFeedback] = useState<{
    text: string;
    ok: boolean;
  } | null>(null);

  const loadOffers = useCallback(
    (signal: AbortSignal) => api.offers.publicList(signal),
    [],
  );

  const { data, loading, error, reload } = useApiResource<PublicOffer[]>(
    loadOffers,
    { reloadOnFocus: true },
  );

  const points = useMemo(() => groupByBranch(data ?? []), [data]);

  const selected = useMemo(
    () =>
      points.find((point) => point.branchId === selectedBranchId) ?? null,
    [points, selectedBranchId],
  );

  const initialRegion: Region = useMemo(() => {
    if (coordinates) {
      return {
        ...coordinates,
        latitudeDelta: 0.06,
        longitudeDelta: 0.06,
      };
    }

    return ALMATY_REGION;
  }, [coordinates]);

  // Как только появилась геопозиция — центрируем карту на пользователе.
  useEffect(() => {
    if (!coordinates || !mapRef.current) {
      return;
    }

    mapRef.current.animateToRegion(
      { ...coordinates, latitudeDelta: 0.06, longitudeDelta: 0.06 },
      600,
    );
  }, [coordinates]);

  const selectedDistance = useMemo(() => {
    if (!coordinates || !selected) {
      return null;
    }

    return distanceInKm(coordinates, {
      latitude: selected.latitude,
      longitude: selected.longitude,
    });
  }, [coordinates, selected]);

  function handleAdd(offer: PublicOffer) {
    const result = addItem(offer, 1);

    setFeedback({ text: result.message, ok: result.success });
  }

  if (Platform.OS === "web") {
    return (
      <Screen edges={["left", "right"]}>
        <EmptyState
          emoji="🗺️"
          title="Карта доступна в мобильном приложении"
          description="Откройте SAVEAT на iOS или Android, чтобы увидеть заведения на карте."
          actionLabel="К предложениям"
          onAction={() => router.push("/")}
        />
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen edges={["left", "right"]}>
        <LoadingState label="Загружаем карту заведений…" />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen edges={["left", "right"]}>
        <ErrorState message={error} onRetry={reload} />
      </Screen>
    );
  }

  if (points.length === 0) {
    return (
      <Screen edges={["left", "right"]}>
        <EmptyState
          emoji="📍"
          title="На карте пока пусто"
          description="Ни у одного активного предложения нет координат филиала."
          actionLabel="Обновить"
          onAction={reload}
        />
      </Screen>
    );
  }

  return (
    <Screen edges={["left", "right"]}>
      <View className="flex-1">
        <MapView
          ref={mapRef}
          style={{ flex: 1 }}
          initialRegion={initialRegion}
          showsUserLocation={permission === "granted"}
          showsMyLocationButton={permission === "granted"}
          onPress={() => {
            setSelectedBranchId(null);
            setFeedback(null);
          }}
        >
          {points.map((point) => {
            const active = point.branchId === selectedBranchId;

            return (
              <Marker
                key={point.branchId}
                coordinate={{
                  latitude: point.latitude,
                  longitude: point.longitude,
                }}
                onPress={() => {
                  setSelectedBranchId(point.branchId);
                  setFeedback(null);
                }}
              >
                <View
                  className={
                    "items-center justify-center rounded-full border-2 px-3 py-1.5 " +
                    (active
                      ? "border-white bg-primary-dark"
                      : "border-white bg-primary")
                  }
                >
                  <Text className="text-xs font-bold text-white">
                    {point.offers.length}
                  </Text>
                </View>
              </Marker>
            );
          })}
        </MapView>

        {permission === "denied" || permission === "unavailable" ? (
          <View className="absolute left-4 right-4 top-4 rounded-2xl border border-line bg-card p-4">
            <Text className="text-sm font-medium text-ink">
              {permission === "denied"
                ? "Доступ к геопозиции отключён"
                : "Геолокация недоступна на устройстве"}
            </Text>

            <Text className="mt-1 text-xs text-muted">
              Карта работает и без неё — вы просто не увидите своё
              местоположение и расстояние до заведений.
            </Text>

            {permission === "denied" ? (
              <Pressable
                accessibilityRole="button"
                onPress={request}
                className="mt-3 min-h-[40px] justify-center self-start rounded-xl border border-primary px-4 active:bg-blush"
              >
                <Text className="text-sm font-semibold text-primary-dark">
                  Разрешить доступ
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {selected ? (
          <View className="absolute bottom-4 left-4 right-4 max-h-[62%] rounded-3xl border border-line bg-card p-5">
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1">
                <Text className="text-lg font-semibold text-ink">
                  {selected.businessName}
                </Text>

                <Text className="text-xs text-subtle">
                  {selected.branchName}
                </Text>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Закрыть карточку"
                onPress={() => {
                  setSelectedBranchId(null);
                  setFeedback(null);
                }}
                className="h-9 w-9 items-center justify-center rounded-full border border-border active:bg-blush"
              >
                <Text className="text-base text-muted">✕</Text>
              </Pressable>
            </View>

            <Text className="mt-2 text-xs text-muted">
              📍 {selected.address}
              {selectedDistance !== null
                ? ` · ${formatDistance(selectedDistance)}`
                : ""}
            </Text>

            <ScrollView
              className="mt-4"
              showsVerticalScrollIndicator={false}
            >
              <View className="gap-3">
                {selected.offers.map((offer) => {
                  const discount = calculateDiscount(
                    offer.original_price,
                    offer.sale_price,
                  );

                  return (
                    <View
                      key={offer.id}
                      className="flex-row items-center justify-between gap-3 rounded-2xl bg-surface p-3"
                    >
                      <View className="flex-1">
                        <Text
                          className="text-sm font-semibold text-ink"
                          numberOfLines={1}
                        >
                          {offer.product_name ?? offer.title}
                        </Text>

                        <Text className="mt-0.5 text-xs text-muted">
                          {formatPickupWindow(
                            offer.pickup_start,
                            offer.pickup_end,
                          )}{" "}
                          · осталось {offer.quantity_remaining}
                        </Text>

                        <View className="mt-1 flex-row items-center gap-2">
                          <Text className="text-sm font-bold text-ink">
                            {formatPrice(offer.sale_price)}
                          </Text>

                          {discount > 0 ? (
                            <Text className="text-xs font-semibold text-primary-dark">
                              -{discount}%
                            </Text>
                          ) : null}
                        </View>
                      </View>

                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Добавить ${
                          offer.product_name ?? offer.title
                        } в корзину`}
                        onPress={() => handleAdd(offer)}
                        className="h-11 w-11 items-center justify-center rounded-xl bg-primary active:opacity-80"
                      >
                        <Text className="text-xl font-bold text-white">
                          +
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </ScrollView>

            {feedback ? (
              <Text
                className={
                  "mt-3 text-sm font-medium " +
                  (feedback.ok ? "text-success" : "text-danger")
                }
              >
                {feedback.ok ? `✓ ${feedback.text}` : feedback.text}
              </Text>
            ) : null}

            <View className="mt-4 flex-row gap-3">
              <Button
                label="Маршрут"
                variant="secondary"
                className="flex-1"
                onPress={() => {
                  void openDirections(
                    {
                      latitude: selected.latitude,
                      longitude: selected.longitude,
                    },
                    `${selected.businessName}, ${selected.branchName}`,
                  );
                }}
              />

              <Button
                label="В корзину"
                className="flex-1"
                onPress={() => router.push("/cart")}
              />
            </View>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}
