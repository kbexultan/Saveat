import { useRouter } from "expo-router";
import { useCallback } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";

import { Badge } from "@/components/Badge";
import { BusinessGuard } from "@/components/BusinessGuard";
import { Button } from "@/components/Button";
import { MenuRow } from "@/components/MenuRow";
import { Screen } from "@/components/Screen";
import { ErrorState, LoadingState } from "@/components/StateViews";
import { colors } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { useBusiness } from "@/contexts/BusinessContext";
import { useApiResource } from "@/hooks/useApiResource";
import { api } from "@/lib/api";
import { businessRoleLabel } from "@/lib/format";
import type { BusinessMembership } from "@/types/api";

type DashboardData = {
  branches: number;
  products: number;
  offers: number;
  activeOffers: number;
  openOrders: number;
};

function StatTile({ value, label }: { value: number; label: string }) {
  return (
    <View className="min-w-[30%] flex-1 rounded-2xl bg-surface p-4">
      <Text className="text-2xl font-bold text-ink">{value}</Text>

      <Text className="mt-1 text-xs text-muted">{label}</Text>
    </View>
  );
}

function BusinessSwitcher({
  memberships,
  selectedId,
  onSelect,
}: {
  memberships: BusinessMembership[];
  selectedId: string;
  onSelect: (businessId: string) => void;
}) {
  return (
    <View className="gap-3 rounded-3xl border border-line bg-card p-5">
      <Text className="text-sm font-semibold text-ink">
        Текущее заведение
      </Text>

      <View className="gap-2">
        {memberships.map((membership) => {
          const active = membership.business.id === selectedId;

          return (
            <Pressable
              key={membership.id}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => onSelect(membership.business.id)}
              className={
                "min-h-[56px] flex-row items-center justify-between gap-3 rounded-2xl border px-4 py-3 " +
                (active
                  ? "border-primary bg-blush"
                  : "border-border bg-card active:bg-surface")
              }
            >
              <View className="flex-1">
                <Text className="text-sm font-semibold text-ink">
                  {membership.business.name}
                </Text>

                <Text className="text-xs text-muted">
                  {businessRoleLabel(membership.role)}
                </Text>
              </View>

              {active ? (
                <Text className="text-base font-bold text-primary-dark">
                  ✓
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function DashboardContent({
  membership,
  businessId,
}: {
  membership: BusinessMembership;
  businessId: string;
}) {
  const router = useRouter();

  const { logout } = useAuth();
  const { memberships, selectBusiness, canManage } = useBusiness();

  const load = useCallback(
    async (signal: AbortSignal): Promise<DashboardData> => {
      const [branches, products, offers, orders] = await Promise.all([
        api.branches.byBusiness(businessId, signal),
        api.products.byBusiness(businessId, signal),
        api.offers.byBusiness(businessId, signal),
        api.businessOrders.list(businessId, signal),
      ]);

      return {
        branches: branches.length,
        products: products.length,
        offers: offers.length,
        activeOffers: offers.filter((offer) => offer.status === "active")
          .length,
        openOrders: orders.filter((order) => order.status === "reserved")
          .length,
      };
    },
    [businessId],
  );

  const { data, loading, error, refreshing, reload, refresh } =
    useApiResource<DashboardData>(load, { reloadOnFocus: true });

  if (loading) {
    return (
      <Screen edges={["left", "right", "bottom"]}>
        <LoadingState label="Собираем данные кабинета…" />
      </Screen>
    );
  }

  if (error || !data) {
    return (
      <Screen edges={["left", "right", "bottom"]}>
        <ErrorState
          message={error ?? "Не удалось загрузить кабинет."}
          onRetry={reload}
        />
      </Screen>
    );
  }

  return (
    <Screen edges={["left", "right", "bottom"]}>
      <ScrollView
        contentContainerClassName="gap-4 px-4 pb-10 pt-4"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <View className="gap-2 rounded-3xl border border-line bg-card p-5">
          <Text className="text-xs font-semibold uppercase text-subtle">
            Кабинет заведения
          </Text>

          <Text className="text-2xl font-bold text-ink">
            {membership.business.name}
          </Text>

          <Badge label={businessRoleLabel(membership.role)} tone="warning" />

          {membership.business.description ? (
            <Text className="mt-1 text-sm text-muted">
              {membership.business.description}
            </Text>
          ) : null}
        </View>

        <View className="flex-row flex-wrap gap-3">
          <StatTile value={data.branches} label="Филиалов" />
          <StatTile value={data.products} label="Товаров" />
          <StatTile value={data.offers} label="Предложений" />
          <StatTile value={data.activeOffers} label="Активных" />
          <StatTile value={data.openOrders} label="Ждут выдачи" />
        </View>

        <View className="gap-3">
          <MenuRow
            icon="📷"
            label="Выдача"
            description="Скан QR или ввод SVT-кода"
            badge={data.openOrders > 0 ? String(data.openOrders) : undefined}
            onPress={() => router.push("/business/pickup")}
          />

          <MenuRow
            icon="🧾"
            label="Заказы"
            description="Все брони вашего заведения"
            onPress={() => router.push("/business/orders")}
          />

          {canManage ? (
            <>
              <MenuRow
                icon="🏬"
                label="Филиалы"
                description="Адреса, координаты, часы работы"
                onPress={() => router.push("/business/branches")}
              />

              <MenuRow
                icon="🍞"
                label="Товары"
                description="Каталог и базовые цены"
                onPress={() => router.push("/business/products")}
              />

              <MenuRow
                icon="🏷️"
                label="Предложения"
                description="Скидки, количество и окна выдачи"
                onPress={() => router.push("/business/offers")}
              />
            </>
          ) : (
            <View className="rounded-2xl border border-line bg-card p-4">
              <Text className="text-sm text-muted">
                Управление филиалами, товарами и предложениями доступно
                владельцу и менеджеру.
              </Text>
            </View>
          )}
        </View>

        {memberships.length > 1 ? (
          <BusinessSwitcher
            memberships={memberships}
            selectedId={businessId}
            onSelect={selectBusiness}
          />
        ) : null}

        <View className="gap-3">
          <Button
            label="Вернуться к покупкам"
            variant="secondary"
            onPress={() => router.replace("/")}
          />

          <Button
            label="Выйти из аккаунта"
            variant="ghost"
            onPress={() => {
              void logout().then(() => router.replace("/business/login"));
            }}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

export default function BusinessDashboardScreen() {
  return (
    <BusinessGuard>
      {({ membership, businessId }) => (
        <DashboardContent
          key={businessId}
          membership={membership}
          businessId={businessId}
        />
      )}
    </BusinessGuard>
  );
}
