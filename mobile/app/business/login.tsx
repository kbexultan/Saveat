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

export default function BusinessLoginScreen() {
  const router = useRouter();

  const { adoptSession } = useAuth();
  const { setMemberships } = useBusiness();

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
      // Это тот же пользователь SAVEAT и тот же JWT —
      // backend лишь дополнительно проверяет, что у аккаунта
      // есть активное членство в бизнесе.
      const response = await api.businessAuth.login({
        email: email.trim().toLowerCase(),
        password,
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
          Вход для заведений
        </Text>

        <Text className="text-sm text-muted">
          Используйте тот же аккаунт SAVEAT, что и для покупок.
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
            setError("");
          }}
          placeholder="Ваш пароль"
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

      <Button
        label="Зарегистрировать заведение"
        variant="secondary"
        onPress={() => router.replace("/business/register")}
      />
    </KeyboardScreen>
  );
}
