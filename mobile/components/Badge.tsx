import { Text, View } from "react-native";

import { offerStatusLabel, orderStatusLabel } from "@/lib/format";

type Tone = "neutral" | "positive" | "warning" | "danger";

const TONE_CONTAINER: Record<Tone, string> = {
  neutral: "bg-surface border-line",
  positive: "bg-surface border-success/40",
  warning: "bg-blush border-primary/40",
  danger: "bg-blush border-danger/40",
};

const TONE_TEXT: Record<Tone, string> = {
  neutral: "text-muted",
  positive: "text-success",
  warning: "text-primary-dark",
  danger: "text-danger",
};

export function Badge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: Tone;
}) {
  return (
    <View
      className={
        `self-start rounded-full border px-3 py-1 ${TONE_CONTAINER[tone]}`
      }
    >
      <Text className={`text-xs font-semibold ${TONE_TEXT[tone]}`}>
        {label}
      </Text>
    </View>
  );
}

function orderTone(status: string): Tone {
  if (status === "picked_up") {
    return "positive";
  }

  if (status === "cancelled") {
    return "danger";
  }

  return "warning";
}

export function OrderStatusBadge({ status }: { status: string }) {
  return <Badge label={orderStatusLabel(status)} tone={orderTone(status)} />;
}

function offerTone(status: string): Tone {
  if (status === "active") {
    return "positive";
  }

  if (status === "sold_out") {
    return "danger";
  }

  return "neutral";
}

export function OfferStatusBadge({ status }: { status: string }) {
  return <Badge label={offerStatusLabel(status)} tone={offerTone(status)} />;
}
