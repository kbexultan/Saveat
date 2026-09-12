import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { KeyboardScreen } from "@/components/KeyboardScreen";
import { InlineError } from "@/components/StateViews";
import { useAuth } from "@/contexts/AuthContext";
import { toErrorMessage } from "@/lib/api";
import { validateRegistration } from "@/lib/validation";

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();

  const { redirect } = useLocalSearchParams<{ redirect?: string }>();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (submitting) {
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
      // Backend создаёт пользователя, затем сразу логиним
      // его тем же паролем — отдельного mobile-эндпоинта нет.
      await register({
        full_name: fullName.trim(),
        phone: phone.trim(),
        email: email.trim().toLowerCase(),
        password,
      });

      router.replace(redirect ?? "/");
    } catch (caught) {
      setError(toErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  function clearError() {
    if (error) {
      setError("");
    }
  }

  return (
    <KeyboardScreen>
      <View className="gap-1 pb-2">
        <Text className="text-2xl font-bold text-ink">Создать аккаунт</Text>

        <Text className="text-sm text-muted">
          Бронируйте свежую еду со скидкой до конца дня.
        </Text>
      </View>

      <View className="gap-4 rounded-3xl border border-line bg-card p-5">
        <Field
          label="Имя"
          value={fullName}
          onChangeText={(value) => {
            setFullName(value);
            clearError();
          }}
          placeholder="Бексултан"
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
          placeholder="you@example.com"
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
          label="Зарегистрироваться"
          onPress={() => void handleSubmit()}
          loading={submitting}
        />
      </View>

      <Button
        label="У меня уже есть аккаунт"
        variant="secondary"
        onPress={() =>
          router.replace(
            redirect
              ? `/login?redirect=${encodeURIComponent(redirect)}`
              : "/login",
          )
        }
      />
    </KeyboardScreen>
  );
}
