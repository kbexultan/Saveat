import type { ColorValue } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

export type TabIconName = "home" | "map" | "orders" | "profile";

type TabBarIconProps = {
  name: TabIconName;
  color: ColorValue;
  size?: number;
};

/**
 * Иконки нижней навигации. Рисуем через react-native-svg,
 * чтобы не тянуть отдельный icon-пакет ради четырёх штук.
 */
export function TabBarIcon({ name, color, size = 24 }: TabBarIconProps) {
  const common = {
    stroke: color,
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none",
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === "home" ? (
        <>
          <Path d="M3.5 10.5 12 3.5l8.5 7" {...common} />
          <Path
            d="M5.5 9.8V19a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.8"
            {...common}
          />
          <Path d="M9.8 20v-5.2h4.4V20" {...common} />
        </>
      ) : null}

      {name === "map" ? (
        <>
          <Path
            d="M9 4 3.6 6.2v13.2L9 17.2l6 2.4 5.4-2.2V4.2L15 6.4 9 4Z"
            {...common}
          />
          <Path d="M9 4v13.2" {...common} />
          <Path d="M15 6.4v13.2" {...common} />
        </>
      ) : null}

      {name === "orders" ? (
        <>
          <Path
            d="M6.5 7.5h11l-1 11.2a1.5 1.5 0 0 1-1.5 1.3H9a1.5 1.5 0 0 1-1.5-1.3L6.5 7.5Z"
            {...common}
          />
          <Path d="M9.5 9.2V6.6a2.5 2.5 0 0 1 5 0v2.6" {...common} />
        </>
      ) : null}

      {name === "profile" ? (
        <>
          <Circle cx="12" cy="8" r="4" {...common} />
          <Path d="M4.5 20.5c0-3.9 3.4-6.5 7.5-6.5s7.5 2.6 7.5 6.5" {...common} />
        </>
      ) : null}
    </Svg>
  );
}
