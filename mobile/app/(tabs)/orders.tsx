import { useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import { FlatList, RefreshControl, View } from "react-native";

import { AuthRequired } from "@/components/AuthRequired";
import { OrderSummaryCard } from "@/components/OrderSummaryCard";
import { Screen } from "@/components/Screen";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/StateViews";
import { colors } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import { api } from "@/lib/api";
import type { Order } from "@/types/api";

export default function OrdersScreen() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();

  const loadOrders = useCallback(
    (signal: AbortSignal) => api.orders.list(signal),
    [],
  );

  const { data, loading, error, refreshing, reload, refresh } =
    useApiResource<Order[]>(loadOrders, {
      enabled: isAuthenticated,
      reloadOnFocus: true,
    });

  const orders = useMemo(() => data ?? [], [data]);

  if (authLoading) {
    return (
      <Screen edges={["left", "right"]}>
        <LoadingState />
      </Screen>
    );
  }

  if (!isAuthenticated) {
    return (
      <Screen edges={["left", "right"]}>
        <AuthRequired
          description="Здесь появятся ваши брони и коды получения."
          redirectTo="/orders"
        />
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen edges={["left", "right"]}>
        <LoadingState label="Загружаем заказы…" />
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
        data={orders}
        keyExtractor={(order) => order.id}
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
        ListEmptyComponent={
          <View className="pt-16">
            <EmptyState
              emoji="🧺"
              title="Заказов пока нет"
              description="Выберите предложение на главной — бронь появится здесь вместе с кодом получения."
              actionLabel="К предложениям"
              onAction={() => router.push("/")}
            />
          </View>
        }
        renderItem={({ item }) => (
          <OrderSummaryCard
            order={item}
            onPress={() => router.push(`/orders/${item.id}`)}
          />
        )}
      />
    </Screen>
  );
}
