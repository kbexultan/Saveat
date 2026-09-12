import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";

import { OfferStatusBadge } from "@/components/Badge";
import { BusinessGuard } from "@/components/BusinessGuard";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import {
  EmptyState,
  ErrorState,
  InlineError,
  LoadingState,
} from "@/components/StateViews";
import { colors } from "@/constants/theme";
import { useApiResource } from "@/hooks/useApiResource";
import { api, toErrorMessage } from "@/lib/api";
import {
  calculateDiscount,
  formatPickupWindow,
  formatPrice,
} from "@/lib/format";
import type { Branch, Offer } from "@/types/api";

type OffersData = {
  offers: Offer[];
  branchNames: Map<string, string>;
};

function OffersContent({ businessId }: { businessId: string }) {
  const router = useRouter();

  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  const load = useCallback(
    async (signal: AbortSignal): Promise<OffersData> => {
      const [offers, branches] = await Promise.all([
        api.offers.byBusiness(businessId, signal),
        api.branches.byBusiness(businessId, signal),
      ]);

      return {
        offers,
        branchNames: new Map(
          branches.map((branch: Branch) => [branch.id, branch.name]),
        ),
      };
    },
    [businessId],
  );

  const { data, loading, error, refreshing, reload, refresh, setData } =
    useApiResource<OffersData>(load, { reloadOnFocus: true });

  const offers = useMemo(() => data?.offers ?? [], [data]);

  function handleToggle(offer: Offer) {
    if (!data || togglingId) {
      return;
    }

    const nextStatus = offer.status === "active" ? "paused" : "active";

    setTogglingId(offer.id);
    setActionError("");

    api.offers
      .update(offer.id, { status: nextStatus })
      .then((updated) => {
        setData({
          ...data,
          offers: data.offers.map((item) =>
            item.id === updated.id ? updated : item,
          ),
        });
      })
      .catch((caught: unknown) => {
        setActionError(toErrorMessage(caught));
      })
      .finally(() => setTogglingId(null));
  }

  if (loading) {
    return (
      <Screen edges={["left", "right", "bottom"]}>
        <LoadingState label="Загружаем предложения…" />
      </Screen>
    );
  }

  if (error || !data) {
    return (
      <Screen edges={["left", "right", "bottom"]}>
        <ErrorState
          message={error ?? "Не удалось загрузить предложения."}
          onRetry={reload}
        />
      </Screen>
    );
  }

  return (
    <Screen edges={["left", "right", "bottom"]}>
      <FlatList
        data={offers}
        keyExtractor={(offer) => offer.id}
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
        ListHeaderComponent={
          actionError ? (
            <View className="pb-1">
              <InlineError message={actionError} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View className="pt-16">
            <EmptyState
              emoji="🏷️"
              title="Предложений пока нет"
              description="Создайте предложение — покупатели увидят его на витрине и на карте."
              actionLabel="Создать предложение"
              onAction={() => router.push("/business/offers/new")}
            />
          </View>
        }
        renderItem={({ item }) => {
          const discount = calculateDiscount(
            item.original_price,
            item.sale_price,
          );

          const reserved = item.quantity_total - item.quantity_remaining;

          return (
            <View className="gap-3 rounded-3xl border border-line bg-card p-5">
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push(`/business/offers/${item.id}`)}
                className="gap-2 active:opacity-80"
              >
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-ink">
                      {item.title}
                    </Text>

                    <Text className="text-xs text-subtle">
                      {data.branchNames.get(item.branch_id) ?? "Филиал"}
                    </Text>
                  </View>

                  <OfferStatusBadge status={item.status} />
                </View>

                <View className="flex-row items-end gap-2">
                  <Text className="text-lg font-bold text-ink">
                    {formatPrice(item.sale_price)}
                  </Text>

                  <Text className="pb-0.5 text-xs text-subtle line-through">
                    {formatPrice(item.original_price)}
                  </Text>

                  {discount > 0 ? (
                    <Text className="pb-0.5 text-xs font-semibold text-primary-dark">
                      -{discount}%
                    </Text>
                  ) : null}
                </View>

                <View className="gap-1.5 rounded-2xl bg-surface p-4">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs text-muted">Осталось</Text>

                    <Text className="text-xs font-semibold text-ink">
                      {item.quantity_remaining} из {item.quantity_total}
                    </Text>
                  </View>

                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs text-muted">Заказано</Text>

                    <Text className="text-xs font-semibold text-ink">
                      {reserved} шт.
                    </Text>
                  </View>

                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs text-muted">Выдача</Text>

                    <Text className="text-xs font-semibold text-ink">
                      {formatPickupWindow(
                        item.pickup_start,
                        item.pickup_end,
                      )}
                    </Text>
                  </View>
                </View>
              </Pressable>

              <View className="flex-row gap-3">
                <Button
                  label={
                    item.status === "active" ? "Отключить" : "Включить"
                  }
                  variant="secondary"
                  className="flex-1"
                  loading={togglingId === item.id}
                  disabled={
                    togglingId !== null && togglingId !== item.id
                  }
                  onPress={() => handleToggle(item)}
                />

                <Button
                  label="Изменить"
                  variant="ghost"
                  className="flex-1"
                  onPress={() =>
                    router.push(`/business/offers/${item.id}`)
                  }
                />
              </View>
            </View>
          );
        }}
      />

      <View className="border-t border-line bg-card px-4 pb-4 pt-4">
        <Button
          label="Создать предложение"
          onPress={() => router.push("/business/offers/new")}
        />
      </View>
    </Screen>
  );
}

export default function BusinessOffersScreen() {
  return (
    <BusinessGuard requireManage>
      {({ businessId }) => (
        <OffersContent key={businessId} businessId={businessId} />
      )}
    </BusinessGuard>
  );
}
