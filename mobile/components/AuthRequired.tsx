import { useRouter } from "expo-router";
import { Text, View } from "react-native";

import { Button } from "@/components/Button";

/**
 * Заглушка для экранов, которым нужен вход.
 * Показываем её вместо пустого экрана и редиректа,
 * чтобы пользователь понимал, что произошло.
 */
export function AuthRequired({
  title = "Войдите в SAVEAT",
  description = "Чтобы оформлять и отслеживать заказы, нужен аккаунт.",
  /** Куда вернуться после успешного входа. */
  redirectTo,
}: {
  title?: string;
  description?: string;
  redirectTo?: string;
}) {
  const router = useRouter();

  const loginHref = redirectTo
    ? `/login?redirect=${encodeURIComponent(redirectTo)}`
    : "/login";

  const registerHref = redirectTo
    ? `/register?redirect=${encodeURIComponent(redirectTo)}`
    : "/register";

  return (
    <View className="flex-1 items-center justify-center gap-4 px-6 py-12">
      <Text className="text-5xl">🔐</Text>

      <Text className="text-center text-lg font-semibold text-ink">
        {title}
      </Text>

      <Text className="text-center text-sm text-muted">{description}</Text>

      <View className="mt-2 w-full max-w-xs gap-3">
        <Button label="Войти" onPress={() => router.push(loginHref)} />

        <Button
          label="Создать аккаунт"
          variant="secondary"
          onPress={() => router.push(registerHref)}
        />
      </View>
    </View>
  );
}
