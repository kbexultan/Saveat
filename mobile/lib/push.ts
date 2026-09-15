import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { api } from "@/lib/api";

/**
 * Push-уведомления в мобильном приложении.
 *
 * Важное ограничение: удалённые push не работают в Expo Go начиная с
 * SDK 53 — нужен development build или готовая сборка. Локальный показ
 * (когда приложение открыто) работает везде.
 */

// Показывать баннер, даже когда приложение на переднем плане:
// иначе пользователь, листающий каталог, пропустит сообщение о выдаче.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export type PushRegistration = {
  token: string | null;
  reason?: string;
};

function getProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId
  );
}

export async function registerForPush(): Promise<PushRegistration> {
  // Симулятор не выдаёт push-токен — это ограничение платформы,
  // а не ошибка приложения.
  if (!Device.isDevice) {
    return {
      token: null,
      reason: "Push работают только на реальном устройстве.",
    };
  }

  if (Platform.OS === "android") {
    // Без канала Android не покажет уведомление вообще.
    await Notifications.setNotificationChannelAsync("default", {
      name: "Уведомления SAVEAT",
      importance: Notifications.AndroidImportance.DEFAULT,
      lockscreenVisibility:
        Notifications.AndroidNotificationVisibility.PUBLIC,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;

  if (status !== "granted") {
    const requested =
      await Notifications.requestPermissionsAsync();

    status = requested.status;
  }

  if (status !== "granted") {
    return {
      token: null,
      reason: "Разрешение на уведомления не выдано.",
    };
  }

  const projectId = getProjectId();

  try {
    const result = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );

    await api.push.subscribe(result.data);

    return { token: result.data };
  } catch (error) {
    console.warn("Expo push registration failed:", error);

    return {
      token: null,
      reason:
        "Не удалось получить push-токен. В Expo Go удалённые push недоступны — нужен development build.",
    };
  }
}

export async function unregisterFromPush(
  token: string,
): Promise<void> {
  try {
    await api.push.unsubscribe(token);
  } catch (error) {
    console.warn("Expo push unsubscribe failed:", error);
  }
}
