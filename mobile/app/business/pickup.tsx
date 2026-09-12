import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from "expo-camera";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { OrderStatusBadge } from "@/components/Badge";
import { BusinessGuard } from "@/components/BusinessGuard";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { Screen } from "@/components/Screen";
import { InlineError, InlineSuccess } from "@/components/StateViews";
import { useApiResource } from "@/hooks/useApiResource";
import { api, toErrorMessage } from "@/lib/api";
import {
  formatPickupWindow,
  formatPrice,
  normalizePickupCode,
} from "@/lib/format";
import type { Order } from "@/types/api";

function OrderPreview({ order }: { order: Order }) {
  const totalUnits = order.items.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );

  return (
    <View className="gap-4 rounded-3xl border border-line bg-card p-5">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="text-xs font-semibold uppercase text-subtle">
            Заказ
          </Text>

          <Text className="mt-1 text-lg font-bold tracking-widest text-ink">
            {order.pickup_code}
          </Text>
        </View>

        <OrderStatusBadge status={order.status} />
      </View>

      <View className="gap-2 rounded-2xl bg-surface p-4">
        {order.items.map((item) => (
          <View
            key={item.id}
            className="flex-row items-start justify-between gap-3"
          >
            <Text className="flex-1 text-sm text-ink">
              {item.product_name ?? item.offer_title}
            </Text>

            <Text className="text-sm font-bold text-ink">
              ×{item.quantity}
            </Text>
          </View>
        ))}
      </View>

      <View className="gap-2">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-muted">Позиций</Text>

          <Text className="text-sm font-medium text-ink">
            {order.items.length} · {totalUnits} шт.
          </Text>
        </View>

        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-muted">Филиал</Text>

          <Text className="flex-1 text-right text-sm font-medium text-ink">
            {order.branch_name}
          </Text>
        </View>

        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-muted">Окно выдачи</Text>

          <Text className="text-sm font-medium text-ink">
            {formatPickupWindow(order.pickup_start, order.pickup_end)}
          </Text>
        </View>

        <View className="flex-row items-center justify-between border-t border-line pt-2">
          <Text className="text-sm text-muted">К оплате</Text>

          <Text className="text-xl font-bold text-ink">
            {formatPrice(order.total_price)}
          </Text>
        </View>
      </View>
    </View>
  );
}

function Scanner({
  onScanned,
  onClose,
}: {
  onScanned: (value: string) => void;
  onClose: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();

  // Камера успевает отдать один и тот же код несколько раз подряд.
  const handledRef = useRef(false);

  const handleScan = useCallback(
    (result: BarcodeScanningResult) => {
      if (handledRef.current) {
        return;
      }

      handledRef.current = true;

      onScanned(result.data);
    },
    [onScanned],
  );

  if (!permission) {
    return (
      <View className="gap-3 rounded-3xl border border-line bg-card p-5">
        <Text className="text-sm text-muted">
          Проверяем доступ к камере…
        </Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View className="gap-3 rounded-3xl border border-line bg-card p-5">
        <Text className="text-sm font-medium text-ink">
          Нужен доступ к камере
        </Text>

        <Text className="text-xs text-muted">
          Камера используется только для сканирования QR-кода заказа.
          Код можно ввести и вручную.
        </Text>

        <Button
          label={
            permission.canAskAgain
              ? "Разрешить камеру"
              : "Разрешение отключено в настройках"
          }
          variant="secondary"
          disabled={!permission.canAskAgain}
          onPress={() => void requestPermission()}
        />

        <Button label="Закрыть" variant="ghost" onPress={onClose} />
      </View>
    );
  }

  return (
    <View className="gap-3">
      <View className="h-80 overflow-hidden rounded-3xl border border-line bg-ink">
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={handleScan}
        />
      </View>

      <Text className="text-center text-xs text-muted">
        Наведите камеру на QR-код в приложении покупателя
      </Text>

      <Button label="Отменить сканирование" variant="ghost" onPress={onClose} />
    </View>
  );
}

function PickupContent({ businessId }: { businessId: string }) {
  const { code: codeParam } = useLocalSearchParams<{ code?: string }>();

  const [code, setCode] = useState(
    codeParam ? normalizePickupCode(codeParam) : "",
  );

  /** Код, по которому уже выполнен поиск. */
  const [submittedCode, setSubmittedCode] = useState(
    codeParam ? normalizePickupCode(codeParam) : "",
  );

  const [scanning, setScanning] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [actionError, setActionError] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const load = useCallback(
    (signal: AbortSignal) =>
      api.businessOrders.findByPickupCode(
        businessId,
        submittedCode,
        signal,
      ),
    [businessId, submittedCode],
  );

  const { data: order, loading, error, setData } = useApiResource<Order>(
    load,
    { enabled: submittedCode.length > 0 },
  );

  function handleSearch(value: string) {
    const normalized = normalizePickupCode(value);

    if (!normalized) {
      return;
    }

    setActionError("");
    setConfirmed(false);
    setCode(normalized);
    setSubmittedCode(normalized);
  }

  function handleScanned(value: string) {
    setScanning(false);
    handleSearch(value);
  }

  function handleReset() {
    setCode("");
    setSubmittedCode("");
    setActionError("");
    setConfirmed(false);
  }

  async function handleConfirm() {
    if (!order || confirming) {
      return;
    }

    setConfirming(true);
    setActionError("");

    try {
      // Подтверждает выдачу backend: он же проверяет,
      // что заказ принадлежит этому бизнесу, и не даёт
      // выдать повторно или отменённый заказ.
      const updated = await api.businessOrders.confirmPickup(
        businessId,
        order.pickup_code,
      );

      setData(updated);
      setConfirmed(true);
    } catch (caught) {
      setActionError(toErrorMessage(caught));
    } finally {
      setConfirming(false);
    }
  }

  const canIssue =
    order !== null &&
    ["reserved", "paid", "ready"].includes(order.status);

  return (
    <Screen edges={["left", "right", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerClassName="gap-4 px-4 pb-10 pt-4"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {scanning ? (
            <Scanner
              onScanned={handleScanned}
              onClose={() => setScanning(false)}
            />
          ) : (
            <View className="gap-4 rounded-3xl border border-line bg-card p-5">
              <Text className="text-base font-semibold text-ink">
                Выдача заказа
              </Text>

              <Field
                label="Код получения"
                value={code}
                onChangeText={(value) =>
                  setCode(value.toUpperCase().replace(/\s+/g, ""))
                }
                placeholder="SVT-XXXXXXXXXX"
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="search"
                onSubmitEditing={() => handleSearch(code)}
                hint="Введите код из приложения покупателя или отсканируйте QR."
              />

              <Button
                label="Найти заказ"
                onPress={() => handleSearch(code)}
                loading={loading}
                disabled={normalizePickupCode(code).length === 0}
              />

              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setActionError("");
                  setScanning(true);
                }}
                className="min-h-[52px] flex-row items-center justify-center gap-2 rounded-2xl border border-border bg-card active:bg-blush"
              >
                <Text className="text-lg">📷</Text>

                <Text className="text-base font-semibold text-ink">
                  Сканировать QR
                </Text>
              </Pressable>
            </View>
          )}

          {error ? <InlineError message={error} /> : null}

          {order ? (
            <>
              <OrderPreview order={order} />

              {confirmed ? (
                <InlineSuccess message="Заказ выдан. Статус — «Получен»." />
              ) : null}

              {actionError ? <InlineError message={actionError} /> : null}

              {canIssue ? (
                <Button
                  label="Выдать заказ"
                  onPress={() => void handleConfirm()}
                  loading={confirming}
                />
              ) : (
                <View className="rounded-2xl border border-line bg-card p-4">
                  <Text className="text-sm text-muted">
                    {order.status === "picked_up"
                      ? "Этот заказ уже выдан."
                      : order.status === "cancelled"
                        ? "Заказ отменён покупателем — выдавать его нельзя."
                        : "Заказ в статусе, который не допускает выдачу."}
                  </Text>
                </View>
              )}

              <Button
                label="Следующий заказ"
                variant="ghost"
                onPress={handleReset}
              />
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

export default function BusinessPickupScreen() {
  return (
    <BusinessGuard>
      {({ businessId }) => (
        <PickupContent key={businessId} businessId={businessId} />
      )}
    </BusinessGuard>
  );
}
