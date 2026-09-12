import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useAuth } from "@/contexts/AuthContext";
import { api, toErrorMessage } from "@/lib/api";
import { readJson, removeKey, STORAGE_KEYS, writeJson } from "@/lib/storage";
import type { BusinessMembership, BusinessRole } from "@/types/api";

/** Роли, которым backend разрешает управлять филиалами/товарами/офферами. */
const MANAGE_ROLES: BusinessRole[] = ["owner", "manager"];

type BusinessContextValue = {
  memberships: BusinessMembership[];
  selectedMembership: BusinessMembership | null;

  loading: boolean;
  error: string | null;

  /** owner или manager у выбранного бизнеса. */
  canManage: boolean;

  refreshBusiness: () => Promise<void>;
  selectBusiness: (businessId: string) => void;
  setMemberships: (memberships: BusinessMembership[]) => void;
};

const BusinessContext = createContext<BusinessContextValue | null>(null);

type State = {
  memberships: BusinessMembership[];
  selectedId: string | null;
  loading: boolean;
  error: string | null;
};

const INITIAL_STATE: State = {
  memberships: [],
  selectedId: null,
  loading: true,
  error: null,
};

export function BusinessProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();

  const [state, setState] = useState<State>(INITIAL_STATE);
  const [reloadToken, setReloadToken] = useState(0);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const userId = user?.id ?? null;

  /**
   * Выбранный бизнес: сохранённый локально, иначе первый доступный.
   * Возвращает готовое состояние, не трогая React напрямую.
   */
  const buildState = useCallback(
    async (next: BusinessMembership[]): Promise<State> => {
      if (next.length === 0) {
        await removeKey(STORAGE_KEYS.selectedBusiness);

        return {
          memberships: [],
          selectedId: null,
          loading: false,
          error: null,
        };
      }

      const savedId = await readJson<string>(
        STORAGE_KEYS.selectedBusiness,
      );

      const selected =
        next.find((item) => item.business.id === savedId) ?? next[0];

      await writeJson(
        STORAGE_KEYS.selectedBusiness,
        selected.business.id,
      );

      return {
        memberships: next,
        selectedId: selected.business.id,
        loading: false,
        error: null,
      };
    },
    [],
  );

  useEffect(() => {
    if (authLoading) {
      return;
    }

    let active = true;

    async function load() {
      if (!userId) {
        // Разлогинились: локальный выбор бизнеса больше не нужен.
        await removeKey(STORAGE_KEYS.selectedBusiness);

        if (active) {
          setState({
            memberships: [],
            selectedId: null,
            loading: false,
            error: null,
          });
        }

        return;
      }

      try {
        const data = await api.businessAuth.me();

        const nextState = await buildState(data.memberships ?? []);

        if (active) {
          setState(nextState);
        }
      } catch (caught) {
        if (active) {
          setState({
            memberships: [],
            selectedId: null,
            loading: false,
            error: toErrorMessage(caught),
          });
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [authLoading, userId, reloadToken, buildState]);

  const refreshBusiness = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    setReloadToken((current) => current + 1);
  }, []);

  const selectBusiness = useCallback((businessId: string) => {
    setState((current) => {
      const exists = current.memberships.some(
        (item) => item.business.id === businessId,
      );

      return exists ? { ...current, selectedId: businessId } : current;
    });

    void writeJson(STORAGE_KEYS.selectedBusiness, businessId);
  }, []);

  /** Вход/регистрация бизнеса уже вернули список — не запрашиваем повторно. */
  const setMemberships = useCallback(
    (next: BusinessMembership[]) => {
      void buildState(next).then((nextState) => {
        if (mountedRef.current) {
          setState(nextState);
        }
      });
    },
    [buildState],
  );

  const selectedMembership = useMemo(
    () =>
      state.memberships.find(
        (item) => item.business.id === state.selectedId,
      ) ?? null,
    [state.memberships, state.selectedId],
  );

  const canManage = Boolean(
    selectedMembership && MANAGE_ROLES.includes(selectedMembership.role),
  );

  const value = useMemo<BusinessContextValue>(
    () => ({
      memberships: state.memberships,
      selectedMembership,
      loading: authLoading || state.loading,
      error: state.error,
      canManage,
      refreshBusiness,
      selectBusiness,
      setMemberships,
    }),
    [
      state.memberships,
      state.loading,
      state.error,
      selectedMembership,
      authLoading,
      canManage,
      refreshBusiness,
      selectBusiness,
      setMemberships,
    ],
  );

  return (
    <BusinessContext.Provider value={value}>
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusiness(): BusinessContextValue {
  const context = useContext(BusinessContext);

  if (!context) {
    throw new Error("useBusiness must be used inside BusinessProvider");
  }

  return context;
}
