import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { KeyboardScreen } from "@/components/KeyboardScreen";
import { InlineError } from "@/components/StateViews";
import { useAuth } from "@/contexts/AuthContext";
import { toErrorMessage } from "@/lib/api";

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();

  const { redirect } = useLocalSearchParams<{ redirect?: string }>();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = email.trim().length > 0 && password.length > 0;

  async function handleSubmit() {
    if (!canSubmit || submitting) {
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await login({
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

  return (
    <KeyboardScreen>
      <View className="gap-1 pb-2">
        <Text className="text-2xl font-bold text-ink">С возвращением</Text>

        <Text className="text-sm text-muted">
          Войдите, чтобы бронировать еду по SAVEAT-ценам.
        </Text>
      </View>

      <View className="gap-4 rounded-3xl border border-line bg-card p-5">
        <Field
          label="Email"
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            setError("");
          }}
          placeholder="you@example.com"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType="next"
          editable={!submitting}
        />

        <Field
          label="Пароль"
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            setError("");
          }}
          placeholder="Минимум 8 символов"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={() => void handleSubmit()}
          editable={!submitting}
        />

        {error ? <InlineError message={error} /> : null}

        <Button
          label="Войти"
          onPress={() => void handleSubmit()}
          loading={submitting}
          disabled={!canSubmit}
        />
      </View>

      <View className="gap-3">
        <Button
          label="Создать аккаунт"
          variant="secondary"
          onPress={() =>
            router.push(
              redirect
                ? `/register?redirect=${encodeURIComponent(redirect)}`
                : "/register",
            )
          }
        />

        <Button
          label="Вход для бизнеса"
          variant="ghost"
          onPress={() => router.push("/business/login")}
        />
      </View>
    </KeyboardScreen>
  );
}
