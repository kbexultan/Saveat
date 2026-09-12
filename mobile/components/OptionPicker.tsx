import { Pressable, Text, View } from "react-native";

export type PickerOption = {
  id: string;
  label: string;
  description?: string;
};

type OptionPickerProps = {
  label: string;
  options: PickerOption[];
  value: string;
  onChange: (id: string) => void;
  emptyText: string;
  disabled?: boolean;
  hint?: string;
};

/**
 * Выбор одного значения из короткого списка (филиал, товар).
 * Нативный Picker на Android и iOS выглядит по-разному,
 * поэтому рисуем обычные строки — они одинаковы везде.
 */
export function OptionPicker({
  label,
  options,
  value,
  onChange,
  emptyText,
  disabled = false,
  hint,
}: OptionPickerProps) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-ink">{label}</Text>

      {options.length === 0 ? (
        <View className="rounded-2xl border border-border bg-surface px-4 py-3">
          <Text className="text-sm text-muted">{emptyText}</Text>
        </View>
      ) : (
        <View className="gap-2">
          {options.map((option) => {
            const active = option.id === value;

            return (
              <Pressable
                key={option.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: active, disabled }}
                onPress={() => onChange(option.id)}
                disabled={disabled}
                className={
                  "min-h-[56px] flex-row items-center justify-between gap-3 rounded-2xl border px-4 py-3 " +
                  (active
                    ? "border-primary bg-blush"
                    : "border-border bg-card active:bg-surface") +
                  (disabled ? " opacity-50" : "")
                }
              >
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-ink">
                    {option.label}
                  </Text>

                  {option.description ? (
                    <Text className="mt-0.5 text-xs text-muted">
                      {option.description}
                    </Text>
                  ) : null}
                </View>

                {active ? (
                  <Text className="text-base font-bold text-primary-dark">
                    ✓
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      )}

      {hint ? <Text className="text-xs text-muted">{hint}</Text> : null}
    </View>
  );
}
