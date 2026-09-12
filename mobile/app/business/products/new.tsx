import { useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

import { BusinessGuard } from "@/components/BusinessGuard";
import { KeyboardScreen } from "@/components/KeyboardScreen";
import {
  ProductForm,
  type ProductFormValues,
} from "@/components/ProductForm";
import { api, toErrorMessage } from "@/lib/api";

function NewProductContent({ businessId }: { businessId: string }) {
  const router = useRouter();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function handleSubmit(values: ProductFormValues) {
    setSubmitting(true);
    setError("");

    api.products
      .create({
        business_id: businessId,
        name: values.name,
        description: values.description,
        category: values.category,
        image_url: values.image_url,
        base_price: values.base_price,
      })
      .then(() => {
        router.replace("/business/products");
      })
      .catch((caught: unknown) => {
        setError(toErrorMessage(caught));
      })
      .finally(() => setSubmitting(false));
  }

  return (
    <KeyboardScreen>
      <View className="gap-1 pb-2">
        <Text className="text-2xl font-bold text-ink">Новый товар</Text>

        <Text className="text-sm text-muted">
          Товар — это позиция каталога. Скидку на день задаёте в
          предложении.
        </Text>
      </View>

      <ProductForm
        submitLabel="Создать товар"
        submitting={submitting}
        error={error}
        onSubmit={handleSubmit}
      />
    </KeyboardScreen>
  );
}

export default function NewProductScreen() {
  return (
    <BusinessGuard requireManage>
      {({ businessId }) => (
        <NewProductContent key={businessId} businessId={businessId} />
      )}
    </BusinessGuard>
  );
}
