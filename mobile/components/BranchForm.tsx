import { useState } from "react";
import { Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { InlineError } from "@/components/StateViews";
import { formatClockTime } from "@/lib/format";
import { parseCoordinate, toBackendTime } from "@/lib/validation";
import type { Branch } from "@/types/api";

export type BranchFormValues = {
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  opening_time: string | null;
  closing_time: string | null;
};

type BranchFormProps = {
  branch?: Branch;
  submitLabel: string;
  submitting: boolean;
  error: string;
  onSubmit: (values: BranchFormValues) => void;
};

export function BranchForm({
  branch,
  submitLabel,
  submitting,
  error,
  onSubmit,
}: BranchFormProps) {
  const [name, setName] = useState(branch?.name ?? "");
  const [address, setAddress] = useState(branch?.address ?? "");

  const [latitude, setLatitude] = useState(
    branch?.latitude !== null && branch?.latitude !== undefined
      ? String(branch.latitude)
      : "",
  );

  const [longitude, setLongitude] = useState(
    branch?.longitude !== null && branch?.longitude !== undefined
      ? String(branch.longitude)
      : "",
  );

  const [openingTime, setOpeningTime] = useState(
    formatClockTime(branch?.opening_time ?? null) ?? "",
  );

  const [closingTime, setClosingTime] = useState(
    formatClockTime(branch?.closing_time ?? null) ?? "",
  );

  const [localError, setLocalError] = useState("");

  function handleSubmit() {
    if (submitting) {
      return;
    }

    if (name.trim().length < 2) {
      setLocalError("Укажите название филиала.");
      return;
    }

    if (address.trim().length < 3) {
      setLocalError("Укажите адрес филиала.");
      return;
    }

    const parsedLatitude = latitude.trim()
      ? parseCoordinate(latitude, "latitude")
      : null;

    if (latitude.trim() && parsedLatitude === null) {
      setLocalError("Широта должна быть числом от -90 до 90.");
      return;
    }

    const parsedLongitude = longitude.trim()
      ? parseCoordinate(longitude, "longitude")
      : null;

    if (longitude.trim() && parsedLongitude === null) {
      setLocalError("Долгота должна быть числом от -180 до 180.");
      return;
    }

    // Координаты нужны, чтобы филиал появился на карте.
    if (
      (parsedLatitude === null) !==
      (parsedLongitude === null)
    ) {
      setLocalError(
        "Укажите обе координаты или не указывайте ни одной.",
      );
      return;
    }

    const parsedOpening = openingTime.trim()
      ? toBackendTime(openingTime)
      : null;

    if (openingTime.trim() && parsedOpening === null) {
      setLocalError("Время открытия — в формате ЧЧ:ММ, например 09:00.");
      return;
    }

    const parsedClosing = closingTime.trim()
      ? toBackendTime(closingTime)
      : null;

    if (closingTime.trim() && parsedClosing === null) {
      setLocalError("Время закрытия — в формате ЧЧ:ММ, например 21:00.");
      return;
    }

    setLocalError("");

    onSubmit({
      name: name.trim(),
      address: address.trim(),
      latitude: parsedLatitude,
      longitude: parsedLongitude,
      opening_time: parsedOpening,
      closing_time: parsedClosing,
    });
  }

  function clearLocalError() {
    if (localError) {
      setLocalError("");
    }
  }

  return (
    <>
      <View className="gap-4 rounded-3xl border border-line bg-card p-5">
        <Field
          label="Название"
          value={name}
          onChangeText={(value) => {
            setName(value);
            clearLocalError();
          }}
          placeholder="Филиал на Абая"
          editable={!submitting}
        />

        <Field
          label="Адрес"
          value={address}
          onChangeText={(value) => {
            setAddress(value);
            clearLocalError();
          }}
          placeholder="ул. Абая 10, Алматы"
          editable={!submitting}
        />
      </View>

      <View className="gap-4 rounded-3xl border border-line bg-card p-5">
        <Text className="text-sm font-semibold text-ink">
          Координаты для карты
        </Text>

        <Field
          label="Широта"
          value={latitude}
          onChangeText={(value) => {
            setLatitude(value);
            clearLocalError();
          }}
          placeholder="43.238949"
          keyboardType="numbers-and-punctuation"
          editable={!submitting}
        />

        <Field
          label="Долгота"
          value={longitude}
          onChangeText={(value) => {
            setLongitude(value);
            clearLocalError();
          }}
          placeholder="76.889709"
          keyboardType="numbers-and-punctuation"
          hint="Без координат филиал не появится на карте покупателя."
          editable={!submitting}
        />
      </View>

      <View className="gap-4 rounded-3xl border border-line bg-card p-5">
        <Text className="text-sm font-semibold text-ink">Часы работы</Text>

        <Field
          label="Открытие"
          value={openingTime}
          onChangeText={(value) => {
            setOpeningTime(value);
            clearLocalError();
          }}
          placeholder="09:00"
          keyboardType="numbers-and-punctuation"
          editable={!submitting}
        />

        <Field
          label="Закрытие"
          value={closingTime}
          onChangeText={(value) => {
            setClosingTime(value);
            clearLocalError();
          }}
          placeholder="21:00"
          keyboardType="numbers-and-punctuation"
          editable={!submitting}
        />
      </View>

      {localError ? <InlineError message={localError} /> : null}

      {error ? <InlineError message={error} /> : null}

      <Button
        label={submitLabel}
        onPress={handleSubmit}
        loading={submitting}
      />
    </>
  );
}
