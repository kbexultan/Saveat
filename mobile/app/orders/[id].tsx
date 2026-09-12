import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";

import { AuthRequired } from "@/components/AuthRequired";
import { OrderStatusBadge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import {
  ErrorState,
  InlineError,
  LoadingState,
} from "@/components/StateViews";
import { colors } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import { api, toErrorMessage } from "@/lib/api";
import {
  formatDateTime,
  formatPickupWindow,
  formatPrice,
  paymentMethodLabel,
} from "@/lib/format";
import { openDirections } from "@/lib/geo";
import type { Branch, Order } from "@/types/api";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-start justify-between gap-4">
      <Text className="text-sm text-muted">{label}</Text>

      <Text className="flex-1 text-right text-sm font-medium text-ink">
        {value}
      </Text>
    </View>
  );
}

export default function OrderDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { isAuthenticated, loading: authLoading } = useAuth();

  const [cancelling, setCancelling] = useState(false);
  const [actionError, setActionError] = useState("");

  const loadOrder = useCallback(
    (signal: AbortSignal) => api.orders.getOne(id, signal),
    [id],
  );

  const { data: order, loading, error, reload, setData } =
    useApiResource<Order>(loadOrder, {
      enabled: isAuthenticated && Boolean(id),
    });

  // Координаты филиала нужны только для кнопки маршрута.
  const branchId = order?.branch_id ?? "";

  const loadBranch = useCallback(
    (signal: AbortSignal) => api.branches.getOne(branchId, signal),
    [branchId],
  );

  const { data: branch } = useApiResource<Branch>(loadBranch, {
    enabled: branchId.length > 0,
  });

  function handleCancel() {
    if (!order) {
      return;
    }

    Alert.alert(
      "Отменить заказ?",
      "Позиции вернутся в продажу, бронь пропадёт.",
      [
        { text: "Не отменять", style: "cancel" },
        {
          text: "Отменить заказ",
          style: "destructive",
          onPress: () => {
            setCancelling(true);
            setActionError("");

            api.orders
              .cancel(order.id)
              .then(setData)
              .catch((caught: unknown) => {
                setActionError(toErrorMessage(caught));
              })
              .finally(() => setCancelling(false));
          },
        },
      ],
    );
  }

  if (authLoading) {
    return (
      <Screen edges={["left", "right", "bottom"]}>
        <LoadingState />
      </Screen>
    );
  }

  if (!isAuthenticated) {
    return (
      <Screen edges={["left", "right", "bottom"]}>
        <AuthRequired
          description="Заказ виден только владельцу аккаунта."
          redirectTo={`/orders/${id}`}
        />
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen edges={["left", "right", "bottom"]}>
        <LoadingState label="Загружаем заказ…" />
      </Screen>
    );
  }

  if (error || !order) {
    return (
      <Screen edges={["left", "right", "bottom"]}>
        <ErrorState
          message={error ?? "Заказ не найден."}
          onRetry={reload}
        />
      </Screen>
    );
  }

  const isReserved = order.status === "reserved";
  const isPickedUp = order.status === "picked_up";
  const isCancelled = order.status === "cancelled";

  const canCancel = ["reserved", "paid", "ready"].includes(order.status);

  const branchCoordinates =
    branch && branch.latitude !== null && branch.longitude !== null
      ? { latitude: branch.latitude, longitude: branch.longitude }
      : null;

  return (
    <Screen edges={["left", "right", "bottom"]}>
      <ScrollView
        contentContainerClassName="gap-4 px-4 pb-10 pt-4"
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-2 rounded-3xl border border-line bg-card p-5">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Text className="text-xs font-semibold uppercase text-subtle">
                Заказ
              </Text>

              <Text className="mt-1 text-lg font-bold text-ink">
                № {order.id.slice(0, 8).toUpperCase()}
              </Text>
            </View>

            <OrderStatusBadge status={order.status} />
          </View>

          <Text className="text-xs text-muted">
            Создан {formatDateTime(order.created_at)}
          </Text>
        </View>

        {/* Код получения */}
        <View className="items-center gap-4 rounded-3xl border border-line bg-card p-6">
          <Text className="text-xs font-semibold uppercase text-subtle">
            Код получения
          </Text>

          <Text className="text-center text-3xl font-extrabold tracking-[3px] text-ink">
            {order.pickup_code}
          </Text>

          {!isCancelled ? (
            <View className="rounded-3xl bg-white p-4">
              {/* В QR попадает только код выдачи —
                  ни токена, ни персональных данных. */}
              <QRCode
                value={order.pickup_code}
                size={192}
                color={colors.ink}
                backgroundColor={colors.white}
              />
            </View>
          ) : null}

          {isReserved ? (
            <Text className="text-center text-sm text-muted">
              Покажите этот код сотруднику при получении
            </Text>
          ) : null}

          {isPickedUp ? (
            <Text className="text-center text-sm font-semibold text-success">
              ✓ Заказ получен
              {order.picked_up_at
                ? ` · ${formatDateTime(order.picked_up_at)}`
                : ""}
            </Text>
          ) : null}

          {isCancelled ? (
            <Text className="text-center text-sm font-semibold text-danger">
              Заказ отменён
            </Text>
          ) : null}

          {!isReserved && !isPickedUp && !isCancelled ? (
            <Text className="text-center text-sm text-muted">
              Покажите этот код сотруднику при получении
            </Text>
          ) : null}
        </View>

        {/* Состав */}
        <View className="gap-3 rounded-3xl border border-line bg-card p-5">
          <Text className="text-base font-semibold text-ink">
            Состав заказа
          </Text>

          <View className="gap-3">
            {order.items.map((item) => (
              <View
                key={item.id}
                className="flex-row items-start justify-between gap-3 rounded-2xl bg-surface p-4"
              >
                <View className="flex-1">
                  <Text className="text-sm font-medium text-ink">
                    {item.product_name ?? item.offer_title}
                  </Text>

                  <Text className="mt-0.5 text-xs text-muted">
                    {formatPrice(item.unit_price)} × {item.quantity}
                  </Text>
                </View>

                <Text className="text-sm font-bold text-ink">
                  {formatPrice(item.total_price)}
                </Text>
              </View>
            ))}
          </View>

          <View className="flex-row items-center justify-between border-t border-line pt-3">
            <Text className="text-sm text-muted">Итого</Text>

            <Text className="text-xl font-bold text-ink">
              {formatPrice(order.total_price)}
            </Text>
          </View>
        </View>

        {/* Где забрать */}
        <View className="gap-3 rounded-3xl border border-line bg-card p-5">
          <Text className="text-base font-semibold text-ink">
            Где забрать
          </Text>

          <View className="gap-2">
            <InfoRow label="Заведение" value={order.business_name} />
            <InfoRow label="Филиал" value={order.branch_name} />
            <InfoRow label="Адрес" value={order.address} />
            <InfoRow
              label="Время"
              value={formatPickupWindow(
                order.pickup_start,
                order.pickup_end,
              )}
            />
            <InfoRow
              label="Оплата"
              value={paymentMethodLabel(order.payment_method)}
            />
          </View>

          {branchCoordinates ? (
            <Button
              label="Построить маршрут"
              variant="secondary"
              onPress={() => {
                void openDirections(
                  branchCoordinates,
                  `${order.business_name}, ${order.branch_name}`,
                );
              }}
            />
          ) : null}
        </View>

        {actionError ? <InlineError message={actionError} /> : null}

        <View className="gap-3">
          {canCancel ? (
            <Button
              label="Отменить заказ"
              variant="danger"
              loading={cancelling}
              onPress={handleCancel}
            />
          ) : null}

          <Button
            label="Ко всем заказам"
            variant="ghost"
            onPress={() => router.replace("/orders")}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}
