import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * Ключ Google Maps нужен только для Android-сборок.
 * Он не является секретом приложения, но и не должен
 * лежать в репозитории — передаём его через окружение
 * во время сборки (EAS secret или локальный .env).
 */
const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,

  name: "SAVEAT",
  slug: "saveat",
  scheme: "saveat",
  version: "1.0.0",

  orientation: "portrait",
  userInterfaceStyle: "light",
  backgroundColor: "#F1D7BE",

  icon: "./assets/icon.png",

  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.saveat.app",
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        "SAVEAT показывает заведения рядом с вами и расстояние до них.",
      NSCameraUsageDescription:
        "Камера нужна сотрудникам заведения, чтобы сканировать QR-код заказа при выдаче.",
    },
  },

  android: {
    package: "com.saveat.app",
    adaptiveIcon: {
      backgroundColor: "#F1D7BE",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    ...(googleMapsApiKey
      ? {
          config: {
            googleMaps: {
              apiKey: googleMapsApiKey,
            },
          },
        }
      : {}),
  },

  web: {
    bundler: "metro",
    output: "single",
    favicon: "./assets/favicon.png",
  },

  plugins: [
    "expo-router",
    "expo-secure-store",
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "SAVEAT показывает заведения рядом с вами и расстояние до них.",
      },
    ],
    [
      "expo-camera",
      {
        cameraPermission:
          "Камера нужна сотрудникам заведения, чтобы сканировать QR-код заказа при выдаче.",
        recordAudioAndroid: false,
      },
    ],
  ],

  experiments: {
    typedRoutes: false,
  },
});
