import { Pressable, Text, View } from "react-native";

type MenuRowProps = {
  icon: string;
  label: string;
  description?: string;
  badge?: string;
  onPress: () => void;
};

export function MenuRow({
  icon,
  label,
  description,
  badge,
  onPress,
}: MenuRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="min-h-[64px] flex-row items-center gap-4 rounded-2xl border border-line bg-card px-4 py-3 active:bg-blush"
    >
      <Text className="text-2xl">{icon}</Text>

      <View className="flex-1">
        <Text className="text-base font-medium text-ink">{label}</Text>

        {description ? (
          <Text className="mt-0.5 text-xs text-muted">{description}</Text>
        ) : null}
      </View>

      {badge ? (
        <View className="rounded-full bg-primary px-2.5 py-1">
          <Text className="text-xs font-bold text-white">{badge}</Text>
        </View>
      ) : null}

      <Text className="text-xl text-subtle">›</Text>
    </Pressable>
  );
}
