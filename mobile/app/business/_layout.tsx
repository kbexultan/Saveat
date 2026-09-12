import { Stack } from "expo-router";

import { colors } from "@/constants/theme";

export default function BusinessLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.primaryDark,
        headerTitleStyle: { color: colors.ink, fontWeight: "600" },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.sand },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Для бизнеса" }} />

      <Stack.Screen name="login" options={{ title: "Вход для бизнеса" }} />

      <Stack.Screen
        name="register"
        options={{ title: "Регистрация бизнеса" }}
      />

      <Stack.Screen name="dashboard" options={{ title: "Кабинет" }} />

      <Stack.Screen name="orders" options={{ title: "Заказы" }} />

      <Stack.Screen name="pickup" options={{ title: "Выдача" }} />

      <Stack.Screen
        name="branches/index"
        options={{ title: "Филиалы" }}
      />

      <Stack.Screen
        name="branches/new"
        options={{ title: "Новый филиал" }}
      />

      <Stack.Screen
        name="branches/[id]"
        options={{ title: "Филиал" }}
      />

      <Stack.Screen
        name="products/index"
        options={{ title: "Товары" }}
      />

      <Stack.Screen
        name="products/new"
        options={{ title: "Новый товар" }}
      />

      <Stack.Screen
        name="products/[id]"
        options={{ title: "Товар" }}
      />

      <Stack.Screen name="offers/index" options={{ title: "Предложения" }} />

      <Stack.Screen
        name="offers/new"
        options={{ title: "Новое предложение" }}
      />

      <Stack.Screen
        name="offers/[id]"
        options={{ title: "Предложение" }}
      />
    </Stack>
  );
}
