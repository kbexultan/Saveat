import { useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

import { BranchForm, type BranchFormValues } from "@/components/BranchForm";
import { BusinessGuard } from "@/components/BusinessGuard";
import { KeyboardScreen } from "@/components/KeyboardScreen";
import { api, toErrorMessage } from "@/lib/api";

function NewBranchContent({ businessId }: { businessId: string }) {
  const router = useRouter();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function handleSubmit(values: BranchFormValues) {
    setSubmitting(true);
    setError("");

    api.branches
      .create({ business_id: businessId, ...values })
      .then(() => {
        router.replace("/business/branches");
      })
      .catch((caught: unknown) => {
        setError(toErrorMessage(caught));
      })
      .finally(() => setSubmitting(false));
  }

  return (
    <KeyboardScreen>
      <View className="gap-1 pb-2">
        <Text className="text-2xl font-bold text-ink">Новый филиал</Text>

        <Text className="text-sm text-muted">
          Филиал — это точка, где покупатель забирает заказ.
        </Text>
      </View>

      <BranchForm
        submitLabel="Создать филиал"
        submitting={submitting}
        error={error}
        onSubmit={handleSubmit}
      />
    </KeyboardScreen>
  );
}

export default function NewBranchScreen() {
  return (
    <BusinessGuard requireManage>
      {({ businessId }) => (
        <NewBranchContent key={businessId} businessId={businessId} />
      )}
    </BusinessGuard>
  );
}
