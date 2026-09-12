import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * JWT живёт только в защищённом хранилище устройства
 * (Keychain на iOS, EncryptedSharedPreferences на Android).
 *
 * Web-вариант нужен исключительно для `expo start --web`
 * во время разработки: SecureStore в браузере не существует.
 * Боевые клиенты SAVEAT — iOS и Android.
 */
const TOKEN_KEY = "saveat_access_token";

const SECURE_STORE_AVAILABLE = Platform.OS !== "web";

export async function getToken(): Promise<string | null> {
  try {
    if (SECURE_STORE_AVAILABLE) {
      return await SecureStore.getItemAsync(TOKEN_KEY);
    }

    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setToken(token: string): Promise<void> {
  if (SECURE_STORE_AVAILABLE) {
    await SecureStore.setItemAsync(TOKEN_KEY, token, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED,
    });

    return;
  }

  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  try {
    if (SECURE_STORE_AVAILABLE) {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      return;
    }

    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch {
    // Токена уже нет — это и есть нужный результат.
  }
}

// --------------------------------
// Несекретные данные
// --------------------------------
//
// Корзина и выбранный бизнес — не секреты,
// им достаточно обычного AsyncStorage.

export async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);

    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as T;
  } catch {
    await AsyncStorage.removeItem(key).catch(() => undefined);
    return null;
  }
}

export async function writeJson(
  key: string,
  value: unknown,
): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Запись кеша не должна ломать экран.
  }
}

export async function removeKey(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // Значения уже нет.
  }
}

export const STORAGE_KEYS = {
  cart: "saveat_cart",
  selectedBusiness: "saveat_business_id",
} as const;
