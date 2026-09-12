import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";

import { AuthRequired } from "@/components/AuthRequired";
import { Button } from "@/components/Button";
import { MenuRow } from "@/components/MenuRow";
import { Screen } from "@/components/Screen";
import { LoadingState } from "@/components/StateViews";
import { useAuth } from "@/contexts/AuthContext";
import { useBusiness } from "@/contexts/BusinessContext";
import { useCart } from "@/contexts/CartContext";
import { API_BASE_URL } from "@/lib/api";
import { businessRoleLabel } from "@/lib/format";

export default function ProfileScreen() {
  const router = useRouter();

  const { user, loading, logout } = useAuth();
  const { memberships, selectedMembership } = useBusiness();
  const { totalItems, clearCart } = useCart();

  const [loggingOut, setLoggingOut] = useState(false);

  if (loading) {
    return (
      <Screen edges={["left", "right"]}>
        <LoadingState />
      </Screen>
    );
  }

  if (!user) {
    return (
      <Screen edges={["left", "right"]}>
        <ScrollView contentContainerClassName="flex-grow">
          <AuthRequired
            description="Войдите, чтобы бронировать еду и видеть свои заказы."
            redirectTo="/profile"
          />

          <View className="px-4 pb-8">
            <MenuRow
              icon="🏪"
              label="Для бизнеса"
              description="Кабинет заведения: заказы, товары, выдача"
              onPress={() => router.push("/business")}
            />
          </View>
        </ScrollView>
      </Screen>
    );
  }

  function handleLogout() {
    Alert.alert("Выйти из аккаунта?", "Корзина останется на устройстве.", [
      { text: "Отмена", style: "cancel" },
      {
        text: "Выйти",
        style: "destructive",
        onPress: () => {
          setLoggingOut(true);

          void logout().finally(() => {
            setLoggingOut(false);
            router.replace("/");
          });
        },
      },
    ]);
  }

  function handleClearCart() {
    Alert.alert("Очистить корзину?", "Все выбранные позиции будут удалены.", [
      { text: "Отмена", style: "cancel" },
      {
        text: "Очистить",
        style: "destructive",
        onPress: clearCart,
      },
    ]);
  }

  const businessDescription =
    memberships.length === 0
      ? "Подключите заведение к SAVEAT"
      : selectedMembership
        ? `${selectedMembership.business.name} · ${businessRoleLabel(
            selectedMembership.role,
          )}`
        : `${memberships.length} заведения`;

  return (
    <Screen edges={["left", "right"]}>
      <ScrollView
        contentContainerClassName="gap-4 px-4 pb-10 pt-4"
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-1 rounded-3xl border border-line bg-card p-5">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-blush">
            <Text className="text-2xl font-bold text-primary-dark">
              {user.full_name.trim().charAt(0).toUpperCase()}
            </Text>
          </View>

          <Text className="mt-3 text-xl font-semibold text-ink">
            {user.full_name}
          </Text>

          {user.email ? (
            <Text className="text-sm text-muted">{user.email}</Text>
          ) : null}

          {user.phone ? (
            <Text className="text-sm text-muted">{user.phone}</Text>
          ) : null}
        </View>

        <View className="gap-3">
          <MenuRow
            icon="🧾"
            label="Мои заказы"
            description="Брони, коды получения и история"
            onPress={() => router.push("/orders")}
          />

          <MenuRow
            icon="🛒"
            label="Корзина"
            description="Позиции, готовые к оформлению"
            badge={totalItems > 0 ? String(totalItems) : undefined}
            onPress={() => router.push("/cart")}
          />

          <MenuRow
            icon="🏪"
            label="Для бизнеса"
            description={businessDescription}
            onPress={() => router.push("/business")}
          />
        </View>

        {totalItems > 0 ? (
          <Button
            label="Очистить корзину"
            variant="ghost"
            onPress={handleClearCart}
          />
        ) : null}

        <Button
          label="Выйти"
          variant="danger"
          loading={loggingOut}
          onPress={handleLogout}
        />

        <View className="items-center gap-1 pt-2">
          <Text className="text-xs text-subtle">SAVEAT · Алматы</Text>

          <Text className="text-[10px] text-subtle">
            API: {API_BASE_URL}
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}
