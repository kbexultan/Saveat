import { forwardRef } from "react";
import { Text, TextInput, View, type TextInputProps } from "react-native";

import { colors } from "@/constants/theme";

type FieldProps = TextInputProps & {
  label: string;
  hint?: string;
  error?: string;
  containerClassName?: string;
};

/**
 * Поле формы SAVEAT: подпись, ввод, подсказка и ошибка.
 * Высота 52px держит комфортную зону нажатия на телефоне.
 */
export const Field = forwardRef<TextInput, FieldProps>(function Field(
  { label, hint, error, containerClassName = "", ...inputProps },
  ref,
) {
  return (
    <View className={`gap-1.5 ${containerClassName}`}>
      <Text className="text-sm font-medium text-ink">{label}</Text>

      <TextInput
        ref={ref}
        placeholderTextColor={colors.subtle}
        className={
          `min-h-[52px] rounded-2xl border bg-card px-4 py-3 ` +
          `text-base text-ink ${
            error ? "border-danger" : "border-border"
          }`
        }
        {...inputProps}
      />

      {hint && !error ? (
        <Text className="text-xs text-muted">{hint}</Text>
      ) : null}

      {error ? (
        <Text className="text-xs font-medium text-danger">{error}</Text>
      ) : null}
    </View>
  );
});
