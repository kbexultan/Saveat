import { ActivityIndicator, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { colors } from "@/constants/theme";

export function LoadingState({
  label = "Загружаем…",
}: {
  label?: string;
}) {
  return (
    <View className="flex-1 items-center justify-center gap-3 px-6 py-12">
      <ActivityIndicator size="large" color={colors.primary} />
      <Text className="text-sm text-muted">{label}</Text>
    </View>
  );
}

export function ErrorState({
  message,
  onRetry,
  retryLabel = "Повторить",
}: {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <View className="flex-1 items-center justify-center gap-4 px-6 py-12">
      <Text className="text-4xl">😕</Text>

      <Text className="text-center text-base font-medium text-ink">
        Что-то пошло не так
      </Text>

      <Text className="text-center text-sm text-muted">{message}</Text>

      {onRetry ? (
        <Button
          label={retryLabel}
          onPress={onRetry}
          variant="secondary"
          className="mt-2 w-full max-w-xs"
        />
      ) : null}
    </View>
  );
}

export function EmptyState({
  emoji = "🌾",
  title,
  description,
  actionLabel,
  onAction,
}: {
  emoji?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View className="flex-1 items-center justify-center gap-3 px-6 py-12">
      <Text className="text-5xl">{emoji}</Text>

      <Text className="text-center text-lg font-semibold text-ink">
        {title}
      </Text>

      {description ? (
        <Text className="text-center text-sm text-muted">
          {description}
        </Text>
      ) : null}

      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          className="mt-3 w-full max-w-xs"
        />
      ) : null}
    </View>
  );
}

export function InlineError({ message }: { message: string }) {
  return (
    <View className="rounded-2xl border border-danger/40 bg-blush px-4 py-3">
      <Text className="text-sm font-medium text-danger">{message}</Text>
    </View>
  );
}

export function InlineSuccess({ message }: { message: string }) {
  return (
    <View className="rounded-2xl border border-success/30 bg-surface px-4 py-3">
      <Text className="text-sm font-medium text-success">
        ✓ {message}
      </Text>
    </View>
  );
}
