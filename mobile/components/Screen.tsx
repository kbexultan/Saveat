import type { ReactNode } from "react";
import { View } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

type ScreenProps = {
  children: ReactNode;
  /** Какие края учитывать: на экранах с табами низ уже занят. */
  edges?: readonly Edge[];
  className?: string;
};

/**
 * Песочный фон SAVEAT + безопасные отступы.
 * Базовый контейнер для всех экранов приложения.
 */
export function Screen({
  children,
  edges = ["top", "left", "right"],
  className = "",
}: ScreenProps) {
  return (
    <SafeAreaView edges={edges} className="flex-1 bg-sand">
      <View className={`flex-1 ${className}`}>{children}</View>
    </SafeAreaView>
  );
}
