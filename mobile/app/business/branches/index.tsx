import { useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";

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
import { formatClockTime } from "@/lib/format";
import type { Branch } from "@/types/api";

function BranchesContent({ businessId }: { businessId: string }) {
  const router = useRouter();

  const load = useCallback(
    (signal: AbortSignal) => api.branches.byBusiness(businessId, signal),
    [businessId],
  );

  const { data, loading, error, refreshing, reload, refresh } =
    useApiResource<Branch[]>(load, { reloadOnFocus: true });

  const branches = useMemo(() => data ?? [], [data]);

  if (loading) {
    return (
      <Screen edges={["left", "right", "bottom"]}>
        <LoadingState label="Загружаем филиалы…" />
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
        data={branches}
        keyExtractor={(branch) => branch.id}
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
              emoji="🏬"
              title="Филиалов пока нет"
              description="Добавьте первый филиал — к нему будут привязаны предложения."
              actionLabel="Добавить филиал"
              onAction={() => router.push("/business/branches/new")}
            />
          </View>
        }
        renderItem={({ item }) => {
          const opening = formatClockTime(item.opening_time);
          const closing = formatClockTime(item.closing_time);

          const hasCoordinates =
            item.latitude !== null && item.longitude !== null;

          return (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push(`/business/branches/${item.id}`)
              }
              className="gap-2 rounded-3xl border border-line bg-card p-5 active:bg-surface"
            >
              <Text className="text-base font-semibold text-ink">
                {item.name}
              </Text>

              <Text className="text-sm text-muted">📍 {item.address}</Text>

              <View className="flex-row flex-wrap items-center gap-3">
                <Text className="text-xs text-subtle">
                  🕒{" "}
                  {opening && closing
                    ? `${opening}–${closing}`
                    : "часы не указаны"}
                </Text>

                <Text
                  className={
                    "text-xs " +
                    (hasCoordinates ? "text-success" : "text-danger")
                  }
                >
                  {hasCoordinates ? "на карте" : "нет координат"}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />

      <View className="border-t border-line bg-card px-4 pb-4 pt-4">
        <Button
          label="Добавить филиал"
          onPress={() => router.push("/business/branches/new")}
        />
      </View>
    </Screen>
  );
}

export default function BusinessBranchesScreen() {
  return (
    <BusinessGuard requireManage>
      {({ businessId }) => (
        <BranchesContent key={businessId} businessId={businessId} />
      )}
    </BusinessGuard>
  );
}
