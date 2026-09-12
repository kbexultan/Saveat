import "@/global.css";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { colors } from "@/constants/theme";
import { AuthProvider } from "@/contexts/AuthContext";
import { BusinessProvider } from "@/contexts/BusinessContext";
import { CartProvider } from "@/contexts/CartContext";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <BusinessProvider>
            <CartProvider>
              <StatusBar style="dark" />

              <Stack
                screenOptions={{
                  headerStyle: { backgroundColor: colors.card },
                  headerTintColor: colors.primaryDark,
                  headerTitleStyle: {
                    color: colors.ink,
                    fontWeight: "600",
                  },
                  headerShadowVisible: false,
                  contentStyle: { backgroundColor: colors.sand },
                }}
              >
                <Stack.Screen
                  name="(tabs)"
                  options={{ headerShown: false }}
                />

                <Stack.Screen
                  name="business"
                  options={{ headerShown: false }}
                />

                <Stack.Screen
                  name="login"
                  options={{ title: "Вход" }}
                />

                <Stack.Screen
                  name="register"
                  options={{ title: "Регистрация" }}
                />

                <Stack.Screen
                  name="cart"
                  options={{ title: "Корзина" }}
                />

                <Stack.Screen
                  name="orders/[id]"
                  options={{ title: "Заказ" }}
                />

                <Stack.Screen
                  name="+not-found"
                  options={{ title: "Страница не найдена" }}
                />
              </Stack>
            </CartProvider>
          </BusinessProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
