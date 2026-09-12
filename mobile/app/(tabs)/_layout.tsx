import { Tabs } from "expo-router";

import { CartHeaderButton } from "@/components/CartHeaderButton";
import { TabBarIcon } from "@/components/TabBarIcon";
import { colors } from "@/constants/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.ink,
        headerTitleStyle: { color: colors.ink, fontWeight: "700" },
        headerShadowVisible: false,

        tabBarActiveTintColor: colors.primaryDark,
        tabBarInactiveTintColor: colors.subtle,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.line,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },

        sceneStyle: { backgroundColor: colors.sand },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Главная",
          headerTitle: "SAVEAT",
          headerTitleStyle: {
            color: colors.primary,
            fontWeight: "800",
            fontSize: 22,
          },
          headerRight: () => <CartHeaderButton />,
          tabBarIcon: ({ color }) => (
            <TabBarIcon name="home" color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="map"
        options={{
          title: "Карта",
          headerRight: () => <CartHeaderButton />,
          tabBarIcon: ({ color }) => (
            <TabBarIcon name="map" color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="orders"
        options={{
          title: "Заказы",
          headerTitle: "Мои заказы",
          tabBarIcon: ({ color }) => (
            <TabBarIcon name="orders" color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Профиль",
          tabBarIcon: ({ color }) => (
            <TabBarIcon name="profile" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
