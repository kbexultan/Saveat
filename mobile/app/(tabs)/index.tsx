import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";

import { OfferCard } from "@/components/OfferCard";
import { Screen } from "@/components/Screen";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/StateViews";
import { colors } from "@/constants/theme";
import { useCart } from "@/contexts/CartContext";
import { useApiResource } from "@/hooks/useApiResource";
import { useUserLocation } from "@/hooks/useUserLocation";
import { api } from "@/lib/api";
import { distanceInKm } from "@/lib/geo";
import type { PublicOffer } from "@/types/api";

const ALL_CATEGORIES = "Все";

export default function HomeScreen() {
  const router = useRouter();
  const { syncWithOffers } = useCart();
  const { coordinates } = useUserLocation();

  const [category, setCategory] = useState(ALL_CATEGORIES);

  const loadOffers = useCallback(
    (signal: AbortSignal) => api.offers.publicList(signal),
    [],
  );

  const { data, loading, error, refreshing, reload, refresh } =
    useApiResource<PublicOffer[]>(loadOffers, { reloadOnFocus: true });

  const offers = useMemo(() => data ?? [], [data]);

  // Цены и остатки в корзине держим в актуальном состоянии.
  useEffect(() => {
    if (offers.length > 0) {
      syncWithOffers(offers);
    }
  }, [offers, syncWithOffers]);

  const categories = useMemo(() => {
    const found = new Set<string>();

    for (const offer of offers) {
      if (offer.category) {
        found.add(offer.category);
      }
    }

    return [ALL_CATEGORIES, ...Array.from(found).sort()];
  }, [offers]);

  const visibleOffers = useMemo(() => {
    if (category === ALL_CATEGORIES) {
      return offers;
    }

    return offers.filter((offer) => offer.category === category);
  }, [offers, category]);

  const distances = useMemo(() => {
    if (!coordinates) {
      return new Map<string, number>();
    }

    const result = new Map<string, number>();

    for (const offer of offers) {
      if (offer.latitude === null || offer.longitude === null) {
        continue;
      }

      result.set(
        offer.id,
        distanceInKm(coordinates, {
          latitude: offer.latitude,
          longitude: offer.longitude,
        }),
      );
    }

    return result;
  }, [offers, coordinates]);

  if (loading) {
    return (
      <Screen edges={["left", "right"]}>
        <LoadingState label="Ищем предложения рядом…" />
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

  return (
    <Screen edges={["left", "right"]}>
      <FlatList
        data={visibleOffers}
        keyExtractor={(offer) => offer.id}
        contentContainerClassName="gap-4 px-4 pb-8 pt-4"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListHeaderComponent={
          <View className="gap-4 pb-1">
            <View>
              <Text className="text-2xl font-bold text-ink">
                Спасите еду сегодня
              </Text>

              <Text className="mt-1 text-sm text-muted">
                Свежие остатки из кафе и пекарен Алматы со скидкой.
              </Text>
            </View>

            {categories.length > 1 ? (
              <View className="flex-row flex-wrap gap-2">
                {categories.map((item) => {
                  const active = item === category;

                  return (
                    <Pressable
                      key={item}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      onPress={() => setCategory(item)}
                      className={
                        "min-h-[40px] justify-center rounded-full border px-4 " +
                        (active
                          ? "border-primary bg-primary"
                          : "border-border bg-card active:bg-blush")
                      }
                    >
                      <Text
                        className={
                          "text-sm font-semibold " +
                          (active ? "text-white" : "text-muted")
                        }
                      >
                        {item}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <View className="pt-16">
            <EmptyState
              emoji="🥐"
              title={
                offers.length === 0
                  ? "Пока нет доступных предложений"
                  : "В этой категории пусто"
              }
              description={
                offers.length === 0
                  ? "Заведения ещё не выложили остатки. Загляните позже — обычно они появляются ближе к вечеру."
                  : "Попробуйте выбрать другую категорию."
              }
              actionLabel={
                offers.length === 0 ? "Обновить" : "Показать все"
              }
              onAction={
                offers.length === 0
                  ? reload
                  : () => setCategory(ALL_CATEGORIES)
              }
            />
          </View>
        }
        renderItem={({ item }) => (
          <OfferCard
            offer={item}
            distanceKm={distances.get(item.id) ?? null}
            onOpenCart={() => router.push("/cart")}
          />
        )}
      />
    </Screen>
  );
}
