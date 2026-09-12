import { useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { KeyboardScreen } from "@/components/KeyboardScreen";
import { InlineError } from "@/components/StateViews";
import { useAuth } from "@/contexts/AuthContext";
import { useBusiness } from "@/contexts/BusinessContext";
import { api, toErrorMessage } from "@/lib/api";
import { validateRegistration } from "@/lib/validation";

export default function BusinessRegisterScreen() {
  const router = useRouter();

  const { adoptSession } = useAuth();
  const { setMemberships } = useBusiness();

  const [businessName, setBusinessName] = useState("");
  const [businessDescription, setBusinessDescription] = useState("");

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function clearError() {
    if (error) {
      setError("");
    }
  }

  async function handleSubmit() {
    if (submitting) {
      return;
    }

    if (businessName.trim().length < 2) {
      setError("Укажите название заведения.");
      return;
    }

    const validationError = validateRegistration({
      fullName,
      phone,
      email,
      password,
      confirmPassword,
    });

    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      // Backend одной транзакцией создаёт User, Business
      // и BusinessMember с ролью owner.
      const response = await api.businessAuth.register({
        full_name: fullName.trim(),
        phone: phone.trim(),
        email: email.trim().toLowerCase(),
        password,
        business_name: businessName.trim(),
        business_description: businessDescription.trim() || null,
      });

      await adoptSession(response.access_token, response.user);

      setMemberships(response.memberships);

      router.replace("/business/dashboard");
    } catch (caught) {
      setError(toErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardScreen>
      <View className="gap-1 pb-2">
        <Text className="text-2xl font-bold text-ink">
          Подключите заведение
        </Text>

        <Text className="text-sm text-muted">
          Один аккаунт — и покупки, и кабинет бизнеса.
        </Text>
      </View>

      <View className="gap-4 rounded-3xl border border-line bg-card p-5">
        <Text className="text-sm font-semibold text-ink">Заведение</Text>

        <Field
          label="Название"
          value={businessName}
          onChangeText={(value) => {
            setBusinessName(value);
            clearError();
          }}
          placeholder="Пекарня «Зерно»"
          editable={!submitting}
        />

        <Field
          label="Описание"
          value={businessDescription}
          onChangeText={(value) => {
            setBusinessDescription(value);
            clearError();
          }}
          placeholder="Необязательно"
          multiline
          numberOfLines={3}
          editable={!submitting}
          containerClassName=""
        />
      </View>

      <View className="gap-4 rounded-3xl border border-line bg-card p-5">
        <Text className="text-sm font-semibold text-ink">
          Владелец аккаунта
        </Text>

        <Field
          label="Имя"
          value={fullName}
          onChangeText={(value) => {
            setFullName(value);
            clearError();
          }}
          placeholder="Ваше имя"
          autoComplete="name"
          textContentType="name"
          editable={!submitting}
        />

        <Field
          label="Телефон"
          value={phone}
          onChangeText={(value) => {
            setPhone(value);
            clearError();
          }}
          placeholder="+7 700 000 00 00"
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          editable={!submitting}
        />

        <Field
          label="Email"
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            clearError();
          }}
          placeholder="cafe@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          editable={!submitting}
        />

        <Field
          label="Пароль"
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            clearError();
          }}
          placeholder="Минимум 8 символов"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          editable={!submitting}
        />

        <Field
          label="Повторите пароль"
          value={confirmPassword}
          onChangeText={(value) => {
            setConfirmPassword(value);
            clearError();
          }}
          placeholder="Ещё раз"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={() => void handleSubmit()}
          editable={!submitting}
        />

        {error ? <InlineError message={error} /> : null}

        <Button
          label="Создать заведение"
          onPress={() => void handleSubmit()}
          loading={submitting}
        />
      </View>

      <Text className="px-2 text-xs text-muted">
        Если email уже зарегистрирован в SAVEAT, войдите под ним —
        новый аккаунт создавать не нужно.
      </Text>

      <Button
        label="У меня уже есть аккаунт"
        variant="secondary"
        onPress={() => router.replace("/business/login")}
      />
    </KeyboardScreen>
  );
}
