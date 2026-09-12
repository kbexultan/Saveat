import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Text, View } from "react-native";

import { BranchForm, type BranchFormValues } from "@/components/BranchForm";
import { BusinessGuard } from "@/components/BusinessGuard";
import { KeyboardScreen } from "@/components/KeyboardScreen";
import { Screen } from "@/components/Screen";
import { ErrorState, LoadingState } from "@/components/StateViews";
import { useApiResource } from "@/hooks/useApiResource";
import { api, toErrorMessage } from "@/lib/api";
import type { Branch } from "@/types/api";

function EditBranchContent({ businessId }: { businessId: string }) {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    (signal: AbortSignal) => api.branches.getOne(id, signal),
    [id],
  );

  const { data: branch, loading, error: loadError, reload } =
    useApiResource<Branch>(load, { enabled: Boolean(id) });

  function handleSubmit(values: BranchFormValues) {
    setSubmitting(true);
    setError("");

    // PATCH проверяет права по бизнесу самого филиала,
    // а не по тому, что прислал клиент.
    api.branches
      .update(id, values)
      .then(() => {
        router.replace("/business/branches");
      })
      .catch((caught: unknown) => {
        setError(toErrorMessage(caught));
      })
      .finally(() => setSubmitting(false));
  }

  if (loading) {
    return (
      <Screen edges={["left", "right", "bottom"]}>
        <LoadingState label="Загружаем филиал…" />
      </Screen>
    );
  }

  if (loadError || !branch) {
    return (
      <Screen edges={["left", "right", "bottom"]}>
        <ErrorState
          message={loadError ?? "Филиал не найден."}
          onRetry={reload}
        />
      </Screen>
    );
  }

  if (branch.business_id !== businessId) {
    return (
      <Screen edges={["left", "right", "bottom"]}>
        <ErrorState message="Этот филиал принадлежит другому заведению." />
      </Screen>
    );
  }

  return (
    <KeyboardScreen>
      <View className="gap-1 pb-2">
        <Text className="text-2xl font-bold text-ink">{branch.name}</Text>

        <Text className="text-sm text-muted">
          Изменения увидят покупатели в приложении и на сайте.
        </Text>
      </View>

      <BranchForm
        branch={branch}
        submitLabel="Сохранить изменения"
        submitting={submitting}
        error={error}
        onSubmit={handleSubmit}
      />
    </KeyboardScreen>
  );
}

export default function EditBranchScreen() {
  return (
    <BusinessGuard requireManage>
      {({ businessId }) => (
        <EditBranchContent key={businessId} businessId={businessId} />
      )}
    </BusinessGuard>
  );
}
