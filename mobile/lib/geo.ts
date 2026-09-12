import { Linking, Platform } from "react-native";

export type Coordinates = {
  latitude: number;
  longitude: number;
};

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Расстояние по прямой между двумя точками, в километрах. */
export function distanceInKm(
  from: Coordinates,
  to: Coordinates,
): number {
  const deltaLat = toRadians(to.latitude - from.latitude);
  const deltaLon = toRadians(to.longitude - from.longitude);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) *
      Math.cos(toRadians(to.latitude)) *
      Math.sin(deltaLon / 2) ** 2;

  return (
    EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  );
}

export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} м`;
  }

  if (km < 10) {
    return `${km.toFixed(1)} км`;
  }

  return `${Math.round(km)} км`;
}

/**
 * Открывает маршрут во внешнем картографическом приложении:
 * Apple Maps на iOS, Google Maps на Android.
 */
export async function openDirections(
  target: Coordinates,
  label: string,
): Promise<boolean> {
  const latitude = target.latitude;
  const longitude = target.longitude;

  const url =
    Platform.OS === "ios"
      ? `maps://?daddr=${latitude},${longitude}&q=${encodeURIComponent(
          label,
        )}`
      : `geo:${latitude},${longitude}?q=${latitude},${longitude}(${encodeURIComponent(
          label,
        )})`;

  const fallbackUrl =
    `https://www.google.com/maps/dir/?api=1` +
    `&destination=${latitude},${longitude}`;

  try {
    const supported = await Linking.canOpenURL(url);

    await Linking.openURL(supported ? url : fallbackUrl);

    return true;
  } catch {
    try {
      await Linking.openURL(fallbackUrl);
      return true;
    } catch {
      return false;
    }
  }
}
