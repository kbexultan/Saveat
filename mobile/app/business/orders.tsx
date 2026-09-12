import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";

import { BusinessGuard } from "@/components/BusinessGuard";
import { OrderSummaryCard } from "@/components/OrderSummaryCard";
import { Screen } from "@/components/Screen";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/StateViews";
import { colors } from "@/constants/theme";
import { useApiResource } from "@/hooks/useApiResource";
import { api } from "@/lib/api";
import type { Order } from "@/types/api";

type Filter = "all" | "reserved" | "picked_up" | "cancelled";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "reserved", label: "Ждут выдачи" },
  { key: "picked_up", label: "Получены" },
  { key: "cancelled", label: "Отменены" },
];

function BusinessOrdersContent({ businessId }: { businessId: string }) {
  const router = useRouter();

  const [filter, setFilter] = useState<Filter>("all");

  // Запрашиваем только заказы своего бизнеса:
  // backend проверяет членство и отдаёт исключительно их.
  const load = useCallback(
    (signal: AbortSignal) => api.businessOrders.list(businessId, signal),
    [businessId],
  );

  const { data, loading, error, refreshing, reload, refresh } =
    useApiResource<Order[]>(load, { reloadOnFocus: true });

  const orders = useMemo(() => data ?? [], [data]);

  const visibleOrders = useMemo(() => {
    if (filter === "all") {
      return orders;
    }

    if (filter === "reserved") {
      return orders.filter((order) =>
        ["reserved", "paid", "ready"].includes(order.status),
      );
    }

    return orders.filter((order) => order.status === filter);
  }, [orders, filter]);

  if (loading) {
    return (
      <Screen edges={["left", "right", "bottom"]}>
        <LoadingState label="Загружаем заказы заведения…" />
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
        data={visibleOrders}
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
        ListHeaderComponent={
          <View className="flex-row flex-wrap gap-2 pb-1">
            {FILTERS.map((item) => {
              const active = item.key === filter;

              return (
                <Pressable
                  key={item.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setFilter(item.key)}
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
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        }
        ListEmptyComponent={
          <View className="pt-16">
            <EmptyState
              emoji="🧾"
              title={
                orders.length === 0
                  ? "Заказов пока нет"
                  : "В этом фильтре пусто"
              }
              description={
                orders.length === 0
                  ? "Как только покупатель забронирует предложение, заказ появится здесь."
                  : "Попробуйте выбрать другой статус."
              }
              actionLabel={orders.length === 0 ? "Обновить" : "Показать все"}
              onAction={
                orders.length === 0 ? reload : () => setFilter("all")
              }
            />
          </View>
        }
        renderItem={({ item }) => (
          <OrderSummaryCard
            order={item}
            onPress={
              ["reserved", "paid", "ready"].includes(item.status)
                ? () =>
                    router.push(
                      `/business/pickup?code=${encodeURIComponent(
                        item.pickup_code,
                      )}`,
                    )
                : undefined
            }
          />
        )}
      />
    </Screen>
  );
}

export default function BusinessOrdersScreen() {
  return (
    <BusinessGuard>
      {({ businessId }) => (
        <BusinessOrdersContent key={businessId} businessId={businessId} />
      )}
    </BusinessGuard>
  );
}
