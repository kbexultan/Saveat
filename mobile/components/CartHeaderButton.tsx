import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { colors } from "@/constants/theme";
import { useCart } from "@/contexts/CartContext";

/** Иконка корзины со счётчиком — живёт в шапке экранов покупателя. */
export function CartHeaderButton() {
  const router = useRouter();
  const { totalItems } = useCart();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Корзина, ${totalItems} шт.`}
      onPress={() => router.push("/cart")}
      className="mr-3 h-11 w-11 items-center justify-center rounded-full border border-border bg-card active:bg-blush"
    >
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Path
          d="M3 4h2l2.3 11.2c.2 1 1.1 1.8 2.2 1.8h8c1 0 1.9-.7 2.2-1.7L21 9H7"
          stroke={colors.ink}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Circle cx="10" cy="20" r="1.5" fill={colors.ink} />
        <Circle cx="18" cy="20" r="1.5" fill={colors.ink} />
      </Svg>

      {totalItems > 0 ? (
        <View className="absolute -right-1 -top-1 min-h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1">
          <Text className="text-[10px] font-bold text-white">
            {totalItems > 99 ? "99+" : totalItems}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
