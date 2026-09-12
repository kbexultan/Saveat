import { useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";

import { Badge } from "@/components/Badge";
import { BusinessGuard } from "@/components/BusinessGuard";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/StateViews";
import { colors } from "@/constants/theme";
import { useApiResource } from "@/hooks/useApiResource";
import { api } from "@/lib/api";
import { categoryEmoji, formatPrice } from "@/lib/format";
import type { Product } from "@/types/api";

function ProductsContent({ businessId }: { businessId: string }) {
  const router = useRouter();

  const load = useCallback(
    (signal: AbortSignal) => api.products.byBusiness(businessId, signal),
    [businessId],
  );

  const { data, loading, error, refreshing, reload, refresh } =
    useApiResource<Product[]>(load, { reloadOnFocus: true });

  const products = useMemo(() => data ?? [], [data]);

  if (loading) {
    return (
      <Screen edges={["left", "right", "bottom"]}>
        <LoadingState label="Загружаем товары…" />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen edges={["left", "right", "bottom"]}>
        <ErrorState message={error} onRetry={reload} />
      </Screen>
    );
  }

  return (
    <Screen edges={["left", "right", "bottom"]}>
      <FlatList
        data={products}
        keyExtractor={(product) => product.id}
        contentContainerClassName="gap-3 px-4 pb-6 pt-4"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          <View className="pt-16">
            <EmptyState
              emoji="🍞"
              title="Каталог пуст"
              description="Добавьте товары — из них собираются предложения со скидкой."
              actionLabel="Добавить товар"
              onAction={() => router.push("/business/products/new")}
            />
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/business/products/${item.id}`)}
            className="flex-row items-center gap-4 rounded-3xl border border-line bg-card p-4 active:bg-surface"
          >
            <View className="h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-blush">
              {item.image_url ? (
                <Image
                  source={{ uri: item.image_url }}
                  accessibilityLabel={item.name}
                  resizeMode="cover"
                  className="h-full w-full"
                />
              ) : (
                <Text className="text-2xl">
                  {categoryEmoji(item.category)}
                </Text>
              )}
            </View>

            <View className="flex-1 gap-1">
              <Text className="text-base font-semibold text-ink">
                {item.name}
              </Text>

              <Text className="text-sm text-muted">
                {formatPrice(item.base_price)}
                {item.category ? ` · ${item.category}` : ""}
              </Text>

              {!item.is_active ? (
                <Badge label="Неактивен" tone="neutral" />
              ) : null}
            </View>

            <Text className="text-xl text-subtle">›</Text>
          </Pressable>
        )}
      />

      <View className="border-t border-line bg-card px-4 pb-4 pt-4">
        <Button
          label="Добавить товар"
          onPress={() => router.push("/business/products/new")}
        />
      </View>
    </Screen>
  );
}

export default function BusinessProductsScreen() {
  return (
    <BusinessGuard requireManage>
      {({ businessId }) => (
        <ProductsContent key={businessId} businessId={businessId} />
      )}
    </BusinessGuard>
  );
}
