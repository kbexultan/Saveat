import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Text, View } from "react-native";

import { BusinessGuard } from "@/components/BusinessGuard";
import { KeyboardScreen } from "@/components/KeyboardScreen";
import {
  ProductForm,
  type ProductFormValues,
} from "@/components/ProductForm";
import { Screen } from "@/components/Screen";
import { ErrorState, LoadingState } from "@/components/StateViews";
import { useApiResource } from "@/hooks/useApiResource";
import { api, toErrorMessage } from "@/lib/api";
import type { Product } from "@/types/api";

function EditProductContent({ businessId }: { businessId: string }) {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    (signal: AbortSignal) => api.products.getOne(id, signal),
    [id],
  );

  const { data: product, loading, error: loadError, reload } =
    useApiResource<Product>(load, { enabled: Boolean(id) });

  function handleSubmit(values: ProductFormValues) {
    setSubmitting(true);
    setError("");

    api.products
      .update(id, values)
      .then(() => {
        router.replace("/business/products");
      })
      .catch((caught: unknown) => {
        setError(toErrorMessage(caught));
      })
      .finally(() => setSubmitting(false));
  }

  if (loading) {
    return (
      <Screen edges={["left", "right", "bottom"]}>
        <LoadingState label="Загружаем товар…" />
      </Screen>
    );
  }

  if (loadError || !product) {
    return (
      <Screen edges={["left", "right", "bottom"]}>
        <ErrorState
          message={loadError ?? "Товар не найден."}
          onRetry={reload}
        />
      </Screen>
    );
  }

  if (product.business_id !== businessId) {
    return (
      <Screen edges={["left", "right", "bottom"]}>
        <ErrorState message="Этот товар принадлежит другому заведению." />
      </Screen>
    );
  }

  return (
    <KeyboardScreen>
      <View className="gap-1 pb-2">
        <Text className="text-2xl font-bold text-ink">{product.name}</Text>

        <Text className="text-sm text-muted">
          Изменения не затрагивают уже созданные предложения и заказы.
        </Text>
      </View>

      <ProductForm
        product={product}
        submitLabel="Сохранить изменения"
        submitting={submitting}
        error={error}
        showActiveToggle
        onSubmit={handleSubmit}
      />
    </KeyboardScreen>
  );
}

export default function EditProductScreen() {
  return (
    <BusinessGuard requireManage>
      {({ businessId }) => (
        <EditProductContent key={businessId} businessId={businessId} />
      )}
    </BusinessGuard>
  );
}
