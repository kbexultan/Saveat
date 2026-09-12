import * as Location from "expo-location";
import { useCallback, useEffect, useState } from "react";

import type { Coordinates } from "@/lib/geo";

export type LocationPermission =
  | "checking"
  | "granted"
  | "denied"
  | "unavailable";

/**
 * Геопозиция пользователя для карты.
 *
 * Отказ в разрешении — обычный сценарий: карта продолжает
 * работать, просто без синей точки и расстояний.
 */
export function useUserLocation() {
  const [permission, setPermission] =
    useState<LocationPermission>("checking");

  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const { status } =
          await Location.requestForegroundPermissionsAsync();

        if (!active) {
          return;
        }

        if (status !== Location.PermissionStatus.GRANTED) {
          setPermission("denied");
          setCoordinates(null);
          return;
        }

        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        if (!active) {
          return;
        }

        setCoordinates({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });

        setPermission("granted");
      } catch {
        // Сервисы геолокации выключены или недоступны на устройстве.
        if (active) {
          setPermission("unavailable");
          setCoordinates(null);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [attempt]);

  /** Повторный запрос разрешения — вызывается из обработчика нажатия. */
  const request = useCallback(() => {
    setPermission("checking");
    setAttempt((current) => current + 1);
  }, []);

  return { permission, coordinates, request };
}
