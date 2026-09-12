import { useRouter } from "expo-router";

import { Screen } from "@/components/Screen";
import { EmptyState } from "@/components/StateViews";

export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <Screen edges={["left", "right", "bottom"]}>
      <EmptyState
        emoji="🧭"
        title="Такой страницы нет"
        description="Ссылка устарела или была введена с ошибкой."
        actionLabel="На главную"
        onAction={() => router.replace("/")}
      />
    </Screen>
  );
}
