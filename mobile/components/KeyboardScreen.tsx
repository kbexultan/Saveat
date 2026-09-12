import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";

import { Screen } from "@/components/Screen";

/**
 * Экран с формой: клавиатура не перекрывает поля,
 * тап по фону закрывает её, содержимое скроллится.
 */
export function KeyboardScreen({
  children,
  contentClassName = "gap-4 px-4 pb-10 pt-4",
}: {
  children: ReactNode;
  contentClassName?: string;
}) {
  return (
    <Screen edges={["left", "right", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerClassName={contentClassName}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
