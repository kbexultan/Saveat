import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { InlineError } from "@/components/StateViews";
import { toNumber } from "@/lib/format";
import { parseDecimalInput } from "@/lib/validation";
import type { Product } from "@/types/api";

export type ProductFormValues = {
  name: string;
  description: string | null;
  category: string | null;
  image_url: string | null;
  base_price: string;
  is_active: boolean;
};

type ProductFormProps = {
  product?: Product;
  submitLabel: string;
  submitting: boolean;
  error: string;
  /** На создании backend всегда делает товар активным. */
  showActiveToggle?: boolean;
  onSubmit: (values: ProductFormValues) => void;
};

export function ProductForm({
  product,
  submitLabel,
  submitting,
  error,
  showActiveToggle = false,
  onSubmit,
}: ProductFormProps) {
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(
    product?.description ?? "",
  );
  const [category, setCategory] = useState(product?.category ?? "");
  const [imageUrl, setImageUrl] = useState(product?.image_url ?? "");

  const [basePrice, setBasePrice] = useState(
    product ? String(toNumber(product.base_price)) : "",
  );

  const [isActive, setIsActive] = useState(product?.is_active ?? true);

  const [localError, setLocalError] = useState("");

  function clearLocalError() {
    if (localError) {
      setLocalError("");
    }
  }

  function handleSubmit() {
    if (submitting) {
      return;
    }

    if (name.trim().length < 2) {
      setLocalError("Укажите название товара.");
      return;
    }

    const price = parseDecimalInput(basePrice);

    if (price === null || price <= 0) {
      setLocalError("Базовая цена должна быть больше нуля.");
      return;
    }

    setLocalError("");

    onSubmit({
      name: name.trim(),
      description: description.trim() || null,
      category: category.trim() || null,
      image_url: imageUrl.trim() || null,
      // Decimal на backend принимает строку — так не теряется точность.
      base_price: price.toFixed(2),
      is_active: isActive,
    });
  }

  return (
    <>
      <View className="gap-4 rounded-3xl border border-line bg-card p-5">
        <Field
          label="Название"
          value={name}
          onChangeText={(value) => {
            setName(value);
            clearLocalError();
          }}
          placeholder="Круассан с миндалём"
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

        <Field
          label="Категория"
          value={category}
          onChangeText={setCategory}
          placeholder="Выпечка, кофе, десерты…"
          hint="Используется для фильтра и иконки на витрине."
          editable={!submitting}
        />
      </View>

      <View className="gap-4 rounded-3xl border border-line bg-card p-5">
        <Field
          label="Базовая цена, ₸"
          value={basePrice}
          onChangeText={(value) => {
            setBasePrice(value);
            clearLocalError();
          }}
          placeholder="1200"
          keyboardType="decimal-pad"
          hint="Обычная цена. Скидку задаёте в предложении."
          editable={!submitting}
        />

        <Field
          label="Ссылка на фото"
          value={imageUrl}
          onChangeText={setImageUrl}
          placeholder="https://…"
          autoCapitalize="none"
          keyboardType="url"
          editable={!submitting}
        />
      </View>

      {showActiveToggle ? (
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: isActive }}
          onPress={() => setIsActive((current) => !current)}
          disabled={submitting}
          className="min-h-[64px] flex-row items-center justify-between gap-4 rounded-3xl border border-line bg-card px-5 py-4 active:bg-surface"
        >
          <View className="flex-1">
            <Text className="text-sm font-semibold text-ink">
              Товар активен
            </Text>

            <Text className="mt-0.5 text-xs text-muted">
              Неактивные товары остаются в каталоге, но их не стоит
              использовать в новых предложениях.
            </Text>
          </View>

          <View
            className={
              "h-8 w-14 justify-center rounded-full px-1 " +
              (isActive ? "bg-primary" : "bg-border")
            }
          >
            <View
              className={
                "h-6 w-6 rounded-full bg-white " +
                (isActive ? "self-end" : "self-start")
              }
            />
          </View>
        </Pressable>
      ) : null}

      {localError ? <InlineError message={localError} /> : null}

      {error ? <InlineError message={error} /> : null}

      <Button
        label={submitLabel}
        onPress={handleSubmit}
        loading={submitting}
      />
    </>
  );
}
