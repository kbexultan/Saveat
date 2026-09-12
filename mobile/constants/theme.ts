/**
 * Палитра SAVEAT. Та же, что на вебе, чтобы приложение
 * и сайт выглядели одним продуктом.
 *
 * Классы NativeWind объявлены в tailwind.config.js,
 * а этот объект нужен там, где цвет передаётся в prop
 * нативного компонента (иконки табов, карта, ActivityIndicator).
 */
export const colors = {
  sand: "#F1D7BE",
  card: "#FFFDF9",
  ink: "#3B2F2F",
  primary: "#D87979",
  primaryDark: "#C96868",
  blush: "#F4DCDC",
  muted: "#8B7770",
  subtle: "#A18C84",
  line: "#EADFD6",
  border: "#DDCEC3",
  surface: "#FAF5EF",
  success: "#587852",
  danger: "#A64F55",
  white: "#FFFFFF",
} as const;

/** Весь продукт работает по времени Алматы. */
export const ALMATY_TIME_ZONE = "Asia/Almaty";

/** Алматы — стартовый регион карты, пока нет геопозиции. */
export const ALMATY_REGION = {
  latitude: 43.238949,
  longitude: 76.889709,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

/** Backend не принимает больше 20 единиц одного offer в заказе. */
export const MAX_QUANTITY_PER_OFFER = 20;
