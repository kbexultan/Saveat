import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Text, View } from "react-native";

import { BusinessGuard } from "@/components/BusinessGuard";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { KeyboardScreen } from "@/components/KeyboardScreen";
import { OptionPicker } from "@/components/OptionPicker";
import { Screen } from "@/components/Screen";
import {
  ErrorState,
  InlineError,
  LoadingState,
} from "@/components/StateViews";
import { useApiResource } from "@/hooks/useApiResource";
import { api, toErrorMessage } from "@/lib/api";
import { calculateDiscount, formatPrice, toNumber } from "@/lib/format";
import {
  parseDecimalInput,
  toAlmatyIso,
  todayInAlmaty,
} from "@/lib/validation";
import type { Branch, Product } from "@/types/api";

type FormData = {
  branches: Branch[];
  products: Product[];
};

function NewOfferForm({
  branches,
  products,
}: {
  branches: Branch[];
  products: Product[];
}) {
  const router = useRouter();

  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [productId, setProductId] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [quantity, setQuantity] = useState("1");

  const [pickupDate, setPickupDate] = useState(todayInAlmaty());
  const [pickupStartTime, setPickupStartTime] = useState("18:00");
  const [pickupEndTime, setPickupEndTime] = useState("21:00");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === productId) ?? null,
    [products, productId],
  );

  // Обычная цена берётся из карточки товара.
  const originalPrice = selectedProduct
    ? toNumber(selectedProduct.base_price)
    : 0;

  const parsedSalePrice = parseDecimalInput(salePrice) ?? 0;

  const discount =
    originalPrice > 0 && parsedSalePrice > 0
      ? calculateDiscount(originalPrice, parsedSalePrice)
      : 0;

  function selectProduct(id: string) {
    setProductId(id);
    setError("");

    const product = products.find((item) => item.id === id);

    if (product && !title.trim()) {
      setTitle(product.name);
    }
  }

  function handleSubmit() {
    if (submitting) {
      return;
    }

    if (!branchId) {
      setError("Выберите филиал.");
      return;
    }

    if (!productId) {
      setError("Выберите товар.");
      return;
    }

    if (title.trim().length < 2) {
      setError("Укажите название предложения.");
      return;
    }

    if (originalPrice <= 0) {
      setError("У выбранного товара не указана базовая цена.");
      return;
    }

    if (parsedSalePrice <= 0) {
      setError("Цена SAVEAT должна быть больше нуля.");
      return;
    }

    if (parsedSalePrice > originalPrice) {
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

    setSubmitting(true);
    setError("");

    api.offers
      .create({
        branch_id: branchId,
        product_id: productId,
        type: "product",
        title: title.trim(),
        description: description.trim() || null,
        original_price: originalPrice.toFixed(2),
        sale_price: parsedSalePrice.toFixed(2),
        quantity_total: quantityTotal,
        pickup_start: pickupStart,
        pickup_end: pickupEnd,
      })
      .then(() => {
        router.replace("/business/offers");
      })
      .catch((caught: unknown) => {
        setError(toErrorMessage(caught));
      })
      .finally(() => setSubmitting(false));
  }

  const activeProducts = products.filter((product) => product.is_active);

  return (
    <KeyboardScreen>
      <View className="gap-1 pb-2">
        <Text className="text-2xl font-bold text-ink">
          Новое предложение
        </Text>

        <Text className="text-sm text-muted">
          Укажите, что, где, по какой цене и когда можно забрать.
        </Text>
      </View>

      <View className="gap-4 rounded-3xl border border-line bg-card p-5">
        <OptionPicker
          label="Филиал"
          options={branches.map((branch) => ({
            id: branch.id,
            label: branch.name,
            description: branch.address,
          }))}
          value={branchId}
          onChange={(id) => {
            setBranchId(id);
            setError("");
          }}
          emptyText="Сначала создайте филиал."
          disabled={submitting}
        />
      </View>

      <View className="gap-4 rounded-3xl border border-line bg-card p-5">
        <OptionPicker
          label="Товар"
          options={activeProducts.map((product) => ({
            id: product.id,
            label: product.name,
            description: `Обычная цена ${formatPrice(product.base_price)}`,
          }))}
          value={productId}
          onChange={selectProduct}
          emptyText="Сначала добавьте активный товар в каталог."
          disabled={submitting}
          hint="Обычная цена предложения берётся из карточки товара."
        />
      </View>

      <View className="gap-4 rounded-3xl border border-line bg-card p-5">
        <Field
          label="Название предложения"
          value={title}
          onChangeText={(value) => {
            setTitle(value);
            setError("");
          }}
          placeholder="Вечерний круассан"
          editable={!submitting}
        />

        <Field
          label="Описание"
          value={description}
          onChangeText={setDescription}
          placeholder="Необязательно"
          multiline
          numberOfLines={3}
          editable={!submitting}
        />
      </View>

      <View className="gap-4 rounded-3xl border border-line bg-card p-5">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-muted">Обычная цена</Text>

          <Text className="text-sm font-semibold text-ink">
            {originalPrice > 0 ? formatPrice(originalPrice) : "—"}
          </Text>
        </View>

        <Field
          label="Цена SAVEAT, ₸"
          value={salePrice}
          onChangeText={(value) => {
            setSalePrice(value);
            setError("");
          }}
          placeholder="600"
          keyboardType="decimal-pad"
          editable={!submitting}
        />

        {discount > 0 ? (
          <View className="rounded-2xl bg-blush px-4 py-3">
            <Text className="text-sm font-semibold text-primary-dark">
              Скидка −{discount}%
            </Text>
          </View>
        ) : null}

        <Field
          label="Количество"
          value={quantity}
          onChangeText={(value) => {
            setQuantity(value.replace(/[^0-9]/g, ""));
            setError("");
          }}
          placeholder="5"
          keyboardType="number-pad"
          hint="Сколько порций доступно к брони."
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
            setError("");
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
            setError("");
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
            setError("");
          }}
          placeholder="21:00"
          keyboardType="numbers-and-punctuation"
          hint="Время по Алматы (UTC+5)."
          editable={!submitting}
        />
      </View>

      {error ? <InlineError message={error} /> : null}

      <Button
        label="Опубликовать предложение"
        onPress={handleSubmit}
        loading={submitting}
        disabled={branches.length === 0 || activeProducts.length === 0}
      />

      {branches.length === 0 || activeProducts.length === 0 ? (
        <Text className="px-2 text-xs text-muted">
          Чтобы создать предложение, нужен хотя бы один филиал и один
          активный товар.
        </Text>
      ) : null}
    </KeyboardScreen>
  );
}

function NewOfferContent({ businessId }: { businessId: string }) {
  const load = useCallback(
    async (signal: AbortSignal): Promise<FormData> => {
      const [branches, products] = await Promise.all([
        api.branches.byBusiness(businessId, signal),
        api.products.byBusiness(businessId, signal),
      ]);

      return { branches, products };
    },
    [businessId],
  );

  const { data, loading, error, reload } = useApiResource<FormData>(load);

  if (loading) {
    return (
      <Screen edges={["left", "right", "bottom"]}>
        <LoadingState label="Загружаем филиалы и товары…" />
      </Screen>
    );
  }

  if (error || !data) {
    return (
      <Screen edges={["left", "right", "bottom"]}>
        <ErrorState
          message={error ?? "Не удалось загрузить данные заведения."}
          onRetry={reload}
        />
      </Screen>
    );
  }

  return (
    <NewOfferForm branches={data.branches} products={data.products} />
  );
}

export default function NewOfferScreen() {
  return (
    <BusinessGuard requireManage>
      {({ businessId }) => (
        <NewOfferContent key={businessId} businessId={businessId} />
      )}
    </BusinessGuard>
  );
}
