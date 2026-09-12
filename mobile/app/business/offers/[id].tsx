import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { OfferStatusBadge } from "@/components/Badge";
import { BusinessGuard } from "@/components/BusinessGuard";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { KeyboardScreen } from "@/components/KeyboardScreen";
import { Screen } from "@/components/Screen";
import {
  ErrorState,
  InlineError,
  InlineSuccess,
  LoadingState,
} from "@/components/StateViews";
import { useApiResource } from "@/hooks/useApiResource";
import { api, toErrorMessage } from "@/lib/api";
import { calculateDiscount, formatPrice, toNumber } from "@/lib/format";
import {
  parseDecimalInput,
  splitAlmatyDateTime,
  toAlmatyIso,
} from "@/lib/validation";
import type { Branch, Offer, OfferUpdatePayload } from "@/types/api";

function EditOfferForm({
  offer,
  branch,
  onSaved,
}: {
  offer: Offer;
  branch: Branch | null;
  onSaved: (offer: Offer) => void;
}) {
  const router = useRouter();

  const start = splitAlmatyDateTime(offer.pickup_start);
  const end = splitAlmatyDateTime(offer.pickup_end);

  const [title, setTitle] = useState(offer.title);
  const [description, setDescription] = useState(offer.description ?? "");

  const [originalPrice, setOriginalPrice] = useState(
    String(toNumber(offer.original_price)),
  );

  const [salePrice, setSalePrice] = useState(
    String(toNumber(offer.sale_price)),
  );

  const [quantity, setQuantity] = useState(String(offer.quantity_total));

  const [pickupDate, setPickupDate] = useState(start.date);
  const [pickupStartTime, setPickupStartTime] = useState(start.time);
  const [pickupEndTime, setPickupEndTime] = useState(end.time);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  /** Уже заказанное покупателями количество нельзя «отнять». */
  const reserved = offer.quantity_total - offer.quantity_remaining;

  const parsedOriginal = parseDecimalInput(originalPrice) ?? 0;
  const parsedSale = parseDecimalInput(salePrice) ?? 0;

  const discount =
    parsedOriginal > 0 && parsedSale > 0
      ? calculateDiscount(parsedOriginal, parsedSale)
      : 0;

  function clearFeedback() {
    setError("");
    setSaved(false);
  }

  function submit(payload: OfferUpdatePayload, successMessage: boolean) {
    setSubmitting(true);
    setError("");
    setSaved(false);

    api.offers
      .update(offer.id, payload)
      .then((updated) => {
        onSaved(updated);

        if (successMessage) {
          setSaved(true);
        }
      })
      .catch((caught: unknown) => {
        setError(toErrorMessage(caught));
      })
      .finally(() => setSubmitting(false));
  }

  function handleSave() {
    if (submitting) {
      return;
    }

    if (title.trim().length < 2) {
      setError("Укажите название предложения.");
      return;
    }

    if (parsedOriginal <= 0) {
      setError("Обычная цена должна быть больше нуля.");
      return;
    }

    if (parsedSale <= 0) {
      setError("Цена SAVEAT должна быть больше нуля.");
      return;
    }

    if (parsedSale > parsedOriginal) {
      setError("Цена SAVEAT не может быть выше обычной цены.");
      return;
    }

    const quantityTotal = parseDecimalInput(quantity);

    if (
      quantityTotal === null ||
      !Number.isInteger(quantityTotal) ||
      quantityTotal < 1
    ) {
      setError("Количество должно быть целым числом от 1.");
      return;
    }

    if (quantityTotal < reserved) {
      setError(
        `Нельзя поставить меньше, чем уже заказали: ${reserved} шт.`,
      );
      return;
    }

    const pickupStart = toAlmatyIso(pickupDate, pickupStartTime);
    const pickupEnd = toAlmatyIso(pickupDate, pickupEndTime);

    if (!pickupStart || !pickupEnd) {
      setError("Проверьте дату (ДД.ММ.ГГГГ) и время (ЧЧ:ММ).");
      return;
    }

    if (pickupEnd <= pickupStart) {
      setError("Конец окна выдачи должен быть позже начала.");
      return;
    }

    submit(
      {
        title: title.trim(),
        description: description.trim() || null,
        original_price: parsedOriginal.toFixed(2),
        sale_price: parsedSale.toFixed(2),
        quantity_total: quantityTotal,
        pickup_start: pickupStart,
        pickup_end: pickupEnd,
      },
      true,
    );
  }

  return (
    <KeyboardScreen>
      <View className="gap-3 rounded-3xl border border-line bg-card p-5">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="text-xl font-bold text-ink">{offer.title}</Text>

            <Text className="text-xs text-subtle">
              {branch ? branch.name : "Филиал"}
            </Text>
          </View>

          <OfferStatusBadge status={offer.status} />
        </View>

        <View className="gap-1.5 rounded-2xl bg-surface p-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-xs text-muted">Осталось</Text>

            <Text className="text-xs font-semibold text-ink">
              {offer.quantity_remaining} из {offer.quantity_total}
            </Text>
          </View>

          <View className="flex-row items-center justify-between">
            <Text className="text-xs text-muted">Уже заказано</Text>

            <Text className="text-xs font-semibold text-ink">
              {reserved} шт.
            </Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: offer.status === "active" }}
          onPress={() =>
            submit(
              {
                status: offer.status === "active" ? "paused" : "active",
              },
              false,
            )
          }
          disabled={submitting}
          className={
            "min-h-[52px] flex-row items-center justify-between gap-3 rounded-2xl border border-border px-4 py-3 " +
            (submitting ? "opacity-50" : "active:bg-surface")
          }
        >
          <Text className="flex-1 text-sm font-medium text-ink">
            {offer.status === "active"
              ? "Предложение видно покупателям"
              : "Предложение скрыто с витрины"}
          </Text>

          <View
            className={
              "h-8 w-14 justify-center rounded-full px-1 " +
              (offer.status === "active" ? "bg-primary" : "bg-border")
            }
          >
            <View
              className={
                "h-6 w-6 rounded-full bg-white " +
                (offer.status === "active" ? "self-end" : "self-start")
              }
            />
          </View>
        </Pressable>
      </View>

      <View className="gap-4 rounded-3xl border border-line bg-card p-5">
        <Field
          label="Название"
          value={title}
          onChangeText={(value) => {
            setTitle(value);
            clearFeedback();
          }}
          editable={!submitting}
        />

        <Field
          label="Описание"
          value={description}
          onChangeText={(value) => {
            setDescription(value);
            clearFeedback();
          }}
          placeholder="Необязательно"
          multiline
          numberOfLines={3}
          editable={!submitting}
        />
      </View>

      <View className="gap-4 rounded-3xl border border-line bg-card p-5">
        <Field
          label="Обычная цена, ₸"
          value={originalPrice}
          onChangeText={(value) => {
            setOriginalPrice(value);
            clearFeedback();
          }}
          keyboardType="decimal-pad"
          editable={!submitting}
        />

        <Field
          label="Цена SAVEAT, ₸"
          value={salePrice}
          onChangeText={(value) => {
            setSalePrice(value);
            clearFeedback();
          }}
          keyboardType="decimal-pad"
          editable={!submitting}
        />

        {discount > 0 ? (
          <View className="rounded-2xl bg-blush px-4 py-3">
            <Text className="text-sm font-semibold text-primary-dark">
              Скидка −{discount}% · {formatPrice(parsedSale)}
            </Text>
          </View>
        ) : null}

        <Field
          label="Всего порций"
          value={quantity}
          onChangeText={(value) => {
            setQuantity(value.replace(/[^0-9]/g, ""));
            clearFeedback();
          }}
          keyboardType="number-pad"
          hint={
            reserved > 0
              ? `Не меньше ${reserved} — столько уже заказали.`
              : "Общее количество порций."
          }
          editable={!submitting}
        />
      </View>

      <View className="gap-4 rounded-3xl border border-line bg-card p-5">
        <Text className="text-sm font-semibold text-ink">Окно выдачи</Text>

        <Field
          label="Дата"
          value={pickupDate}
          onChangeText={(value) => {
            setPickupDate(value);
            clearFeedback();
          }}
          placeholder="ДД.ММ.ГГГГ"
          keyboardType="numbers-and-punctuation"
          editable={!submitting}
        />

        <Field
          label="Начало"
          value={pickupStartTime}
          onChangeText={(value) => {
            setPickupStartTime(value);
            clearFeedback();
          }}
          placeholder="18:00"
          keyboardType="numbers-and-punctuation"
          editable={!submitting}
        />

        <Field
          label="Конец"
          value={pickupEndTime}
          onChangeText={(value) => {
            setPickupEndTime(value);
            clearFeedback();
          }}
          placeholder="21:00"
          keyboardType="numbers-and-punctuation"
          hint="Время по Алматы (UTC+5)."
          editable={!submitting}
        />
      </View>

      {error ? <InlineError message={error} /> : null}

      {saved ? <InlineSuccess message="Предложение обновлено." /> : null}

      <Button
        label="Сохранить изменения"
        onPress={handleSave}
        loading={submitting}
      />

      <Button
        label="Ко всем предложениям"
        variant="ghost"
        onPress={() => router.replace("/business/offers")}
      />
    </KeyboardScreen>
  );
}

function EditOfferContent({ businessId }: { businessId: string }) {
  const { id } = useLocalSearchParams<{ id: string }>();

  const load = useCallback(
    (signal: AbortSignal) => api.offers.getOne(id, signal),
    [id],
  );

  const { data: offer, loading, error, reload, setData } =
    useApiResource<Offer>(load, { enabled: Boolean(id) });

  const branchId = offer?.branch_id ?? "";

  const loadBranch = useCallback(
    (signal: AbortSignal) => api.branches.getOne(branchId, signal),
    [branchId],
  );

  const { data: branch } = useApiResource<Branch>(loadBranch, {
    enabled: branchId.length > 0,
  });

  if (loading) {
    return (
      <Screen edges={["left", "right", "bottom"]}>
        <LoadingState label="Загружаем предложение…" />
      </Screen>
    );
  }

  if (error || !offer) {
    return (
      <Screen edges={["left", "right", "bottom"]}>
        <ErrorState
          message={error ?? "Предложение не найдено."}
          onRetry={reload}
        />
      </Screen>
    );
  }

  // Филиал ещё грузится — не показываем чужую ошибку раньше времени.
  if (branch && branch.business_id !== businessId) {
    return (
      <Screen edges={["left", "right", "bottom"]}>
        <ErrorState message="Это предложение принадлежит другому заведению." />
      </Screen>
    );
  }

  return (
    <EditOfferForm
      key={offer.id}
      offer={offer}
      branch={branch}
      onSaved={setData}
    />
  );
}

export default function EditOfferScreen() {
  return (
    <BusinessGuard requireManage>
      {({ businessId }) => (
        <EditOfferContent key={businessId} businessId={businessId} />
      )}
    </BusinessGuard>
  );
}
