import { ActivityIndicator, Pressable, Text } from "react-native";

import { colors } from "@/constants/theme";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger";

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
};

const CONTAINER: Record<ButtonVariant, string> = {
  primary: "bg-primary",
  secondary: "bg-card border border-primary",
  ghost: "bg-transparent border border-border",
  danger: "bg-card border border-danger",
};

const LABEL: Record<ButtonVariant, string> = {
  primary: "text-white",
  secondary: "text-primary-dark",
  ghost: "text-ink",
  danger: "text-danger",
};

const SPINNER: Record<ButtonVariant, string> = {
  primary: colors.white,
  secondary: colors.primaryDark,
  ghost: colors.ink,
  danger: colors.danger,
};

export function Button({
  label,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  className = "",
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      onPress={onPress}
      disabled={isDisabled}
      className={
        `min-h-[52px] flex-row items-center justify-center ` +
        `rounded-2xl px-5 ${CONTAINER[variant]} ` +
        `${isDisabled ? "opacity-50" : "active:opacity-80"} ${className}`
      }
    >
      {loading ? (
        <ActivityIndicator size="small" color={SPINNER[variant]} />
      ) : (
        <Text
          className={`text-base font-semibold ${LABEL[variant]}`}
          numberOfLines={1}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}
