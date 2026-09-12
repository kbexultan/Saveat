import { Redirect, useRouter } from "expo-router";
import { ScrollView, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { ErrorState, LoadingState } from "@/components/StateViews";
import { useAuth } from "@/contexts/AuthContext";
import { useBusiness } from "@/contexts/BusinessContext";

export default function BusinessEntryScreen() {
  const router = useRouter();

  const { isAuthenticated, loading: authLoading } = useAuth();

  const { memberships, loading, error, refreshBusiness } = useBusiness();

  if (authLoading || (isAuthenticated && loading)) {
    return (
      <Screen edges={["left", "right", "bottom"]}>
        <LoadingState />
      </Screen>
    );
  }

  if (isAuthenticated && error) {
    return (
      <Screen edges={["left", "right", "bottom"]}>
        <ErrorState
          message={error}
          onRetry={() => void refreshBusiness()}
        />
      </Screen>
    );
  }

  // Аккаунт уже привязан к заведению — сразу в кабинет.
  if (isAuthenticated && memberships.length > 0) {
    return <Redirect href="/business/dashboard" />;
  }

  return (
    <Screen edges={["left", "right", "bottom"]}>
      <ScrollView
        contentContainerClassName="gap-5 px-4 pb-10 pt-6"
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-2 rounded-3xl border border-line bg-card p-6">
          <Text className="text-3xl">🥐</Text>

          <Text className="mt-2 text-2xl font-bold text-ink">
            SAVEAT для заведений
          </Text>

          <Text className="text-sm leading-5 text-muted">
            Продавайте свежие остатки вместо того, чтобы списывать их.
            Публикуйте предложения, принимайте брони и выдавайте заказы
            по коду прямо с телефона.
          </Text>
        </View>

        <View className="gap-3 rounded-3xl border border-line bg-card p-5">
          {[
            {
              icon: "🏬",
              title: "Филиалы и товары",
              text: "Заводите точки, каталог и цены один раз.",
            },
            {
              icon: "🏷️",
              title: "Предложения на день",
              text: "Ставьте скидку, количество и окно выдачи.",
            },
            {
              icon: "📷",
              title: "Выдача по QR",
              text: "Сканируйте код покупателя или вводите вручную.",
            },
          ].map((item) => (
            <View key={item.title} className="flex-row gap-3">
              <Text className="text-2xl">{item.icon}</Text>

              <View className="flex-1">
                <Text className="text-sm font-semibold text-ink">
                  {item.title}
                </Text>

                <Text className="text-xs text-muted">{item.text}</Text>
              </View>
            </View>
          ))}
        </View>

        {isAuthenticated ? (
          <View className="gap-2 rounded-3xl border border-line bg-card p-5">
            <Text className="text-sm font-semibold text-ink">
              У этого аккаунта пока нет заведения
            </Text>

            <Text className="text-xs text-muted">
              Зарегистрируйте бизнес — вы станете его владельцем.
            </Text>
          </View>
        ) : null}

        <View className="gap-3">
          <Button
            label="Зарегистрировать заведение"
            onPress={() => router.push("/business/register")}
          />

          {!isAuthenticated ? (
            <Button
              label="Войти как бизнес"
              variant="secondary"
              onPress={() => router.push("/business/login")}
            />
          ) : null}

          <Button
            label="Вернуться к покупкам"
            variant="ghost"
            onPress={() => router.replace("/")}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}
