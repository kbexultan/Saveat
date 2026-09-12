import { useRouter } from "expo-router";
import type { ReactNode } from "react";

import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/StateViews";
import { useAuth } from "@/contexts/AuthContext";
import { useBusiness } from "@/contexts/BusinessContext";
import { businessRoleLabel } from "@/lib/format";
import type { BusinessMembership } from "@/types/api";

type BusinessGuardProps = {
  /** Экран доступен только owner и manager. */
  requireManage?: boolean;
  children: (context: {
    membership: BusinessMembership;
    businessId: string;
  }) => ReactNode;
};

/**
 * Общая проверка доступа к экранам кабинета.
 *
 * Это только UX: настоящая авторизация живёт в backend
 * (BusinessMember + role + status), и каждый запрос всё
 * равно проверяется там.
 */
export function BusinessGuard({
  requireManage = false,
  children,
}: BusinessGuardProps) {
  const router = useRouter();

  const { isAuthenticated, loading: authLoading } = useAuth();

  const {
    selectedMembership,
    memberships,
    loading,
    error,
    canManage,
    refreshBusiness,
  } = useBusiness();

  if (authLoading || loading) {
    return (
      <Screen edges={["left", "right", "bottom"]}>
        <LoadingState />
      </Screen>
    );
  }

  if (!isAuthenticated) {
    return (
      <Screen edges={["left", "right", "bottom"]}>
        <EmptyState
          emoji="🏪"
          title="Войдите как бизнес"
          description="Кабинет заведения доступен участникам бизнеса SAVEAT."
          actionLabel="Войти"
          onAction={() => router.replace("/business/login")}
        />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen edges={["left", "right", "bottom"]}>
        <ErrorState
          message={error}
          onRetry={() => void refreshBusiness()}
        />
      </Screen>
    );
  }

  if (memberships.length === 0 || !selectedMembership) {
    return (
      <Screen edges={["left", "right", "bottom"]}>
        <EmptyState
          emoji="🥐"
          title="У аккаунта нет заведения"
          description="Зарегистрируйте бизнес, чтобы публиковать остатки и выдавать заказы."
          actionLabel="Зарегистрировать бизнес"
          onAction={() => router.replace("/business/register")}
        />
      </Screen>
    );
  }

  if (requireManage && !canManage) {
    return (
      <Screen edges={["left", "right", "bottom"]}>
        <EmptyState
          emoji="🔒"
          title="Недостаточно прав"
          description={`Ваша роль — ${businessRoleLabel(
            selectedMembership.role,
          )}. Управление филиалами, товарами и предложениями доступно владельцу и менеджеру.`}
        />

        <Button
          label="К заказам"
          variant="secondary"
          className="mx-4 mb-6"
          onPress={() => router.replace("/business/orders")}
        />
      </Screen>
    );
  }

  return (
    <>
      {children({
        membership: selectedMembership,
        businessId: selectedMembership.business.id,
      })}
    </>
  );
}
