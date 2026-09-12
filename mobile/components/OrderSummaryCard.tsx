import { Pressable, Text, View } from "react-native";

import { OrderStatusBadge } from "@/components/Badge";
import {
  formatDateTime,
  formatPickupWindow,
  formatPrice,
  pluralizeItems,
} from "@/lib/format";
import type { Order } from "@/types/api";

type OrderSummaryCardProps = {
  order: Order;
  onPress?: () => void;
  /** Код выдачи нужен покупателю и сотруднику заведения. */
  showPickupCode?: boolean;
};

export function OrderSummaryCard({
  order,
  onPress,
  showPickupCode = true,
}: OrderSummaryCardProps) {
  const totalUnits = order.items.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );

  const content = (
    <View className="gap-3 rounded-3xl border border-line bg-card p-5">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="text-base font-semibold text-ink">
            {order.business_name}
          </Text>

          <Text className="text-xs text-subtle">{order.branch_name}</Text>
        </View>

        <OrderStatusBadge status={order.status} />
      </View>

      <View className="gap-1.5 rounded-2xl bg-surface p-4">
        {order.items.slice(0, 3).map((item) => (
          <View
            key={item.id}
            className="flex-row items-center justify-between gap-3"
          >
            <Text
              className="flex-1 text-sm text-muted"
              numberOfLines={1}
            >
              {item.product_name ?? item.offer_title}
            </Text>

            <Text className="text-sm font-medium text-ink">
              ×{item.quantity}
            </Text>
          </View>
        ))}

        {order.items.length > 3 ? (
          <Text className="text-xs text-subtle">
            и ещё {order.items.length - 3}…
          </Text>
        ) : null}
      </View>

      <View className="flex-row items-center justify-between gap-3">
        <Text className="text-xs text-muted">
          {pluralizeItems(order.items.length)} · {totalUnits} шт.
        </Text>

        <Text className="text-lg font-bold text-ink">
          {formatPrice(order.total_price)}
        </Text>
      </View>

      <View className="flex-row items-center justify-between gap-3 border-t border-line pt-3">
        <Text className="text-xs text-muted">
          Забрать{" "}
          {formatPickupWindow(order.pickup_start, order.pickup_end)}
        </Text>

        <Text className="text-xs text-subtle">
          {formatDateTime(order.created_at)}
        </Text>
      </View>

      {showPickupCode ? (
        <View className="rounded-2xl bg-blush px-4 py-3">
          <Text className="text-xs text-muted">Код получения</Text>

          <Text className="mt-0.5 text-base font-bold tracking-widest text-ink">
            {order.pickup_code}
          </Text>
        </View>
      ) : null}
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="active:opacity-80"
    >
      {content}
    </Pressable>
  );
}
