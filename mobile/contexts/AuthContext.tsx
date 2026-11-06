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

import { api, setUnauthorizedHandler } from "@/lib/api";
import { registerForPush } from "@/lib/push";
import { clearToken, getToken, setToken } from "@/lib/storage";
import * as Notifications from "expo-notifications";
import type { LoginPayload, RegisterPayload, User } from "@/types/api";

type AuthContextValue = {
  user: User | null;
  /** true, пока идёт восстановление сессии при старте приложения. */
  loading: boolean;
  isAuthenticated: boolean;

  login: (payload: LoginPayload) => Promise<User>;
  register: (payload: RegisterPayload) => Promise<User>;
  /**
   * Business-эндпоинты отдают готовый access_token вместе
   * с ответом — сохраняем его без второго запроса на /auth/login.
   */
  adoptSession: (accessToken: string, user: User) => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Восстановление сессии при старте: читаем токен из SecureStore
  // и подтверждаем его через /auth/me.
  useEffect(() => {
    let active = true;

    async function restoreSession() {
      try {
        const currentUser = await api.auth.me();

        if (active) {
          setUser(currentUser);
        }
      } catch {
        // Токена нет, он протух или сервер недоступен — в любом
        // случае пользователь считается неавторизованным.
        // Сам токен уже вычищен в api-клиенте при 401.
        if (active) {
          setUser(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void restoreSession();

    return () => {
      active = false;
    };
  }, []);

  // Любой 401 из api-клиента завершает сессию в одном месте.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (mountedRef.current) {
        setUser(null);
      }
    });

    return () => setUnauthorizedHandler(null);
  }, []);

  /*
    Регистрируем устройство для push, как только появился пользователь.

    Токен привязывается к аккаунту на сервере, поэтому регистрация
    должна идти именно после входа, а не при старте приложения.
    Ошибку глушим: без push приложение работает полностью, уведомления
    всё равно видны в списке.
  */
  useEffect(() => {
    if (!user) {
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    void registerForPush(controller.signal).then((result) => {
      if (!cancelled && result.reason) {
        console.info("Push недоступен:", result.reason);
      }
    }).catch(() => { /* Notification permissions must never break login. */ });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [user]);

  const logout = useCallback(async () => {
    const token = await getToken();
    // Clear the UI immediately; server revocation also removes this session's devices.
    setUser(null);
    try {
      if (token) await api.auth.logout(token);
    } catch {
      // Offline logout cannot recall queued OS banners; push payloads contain no private data.
    } finally {
      if (token === await getToken()) await clearToken();
      await Notifications.dismissAllNotificationsAsync().catch(() => undefined);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const token = await getToken();
    const currentUser = await api.auth.me();

    if (mountedRef.current && token === await getToken()) {
      setUser(currentUser);
    }
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    const { access_token } = await api.auth.login(payload);

    await setToken(access_token);

    const currentUser = await api.auth.me();

    if (mountedRef.current) {
      setUser(currentUser);
    }

    return currentUser;
  }, []);

  const register = useCallback(
    async (payload: RegisterPayload) => {
      await api.auth.register(payload);

      return login({
        email: payload.email,
        password: payload.password,
      });
    },
    [login],
  );

  const adoptSession = useCallback(
    async (accessToken: string, nextUser: User) => {
      await setToken(accessToken);

      if (mountedRef.current) {
        setUser(nextUser);
      }
    },
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      login,
      register,
      adoptSession,
      refreshUser,
      logout,
    }),
    [
      user,
      loading,
      login,
      register,
      adoptSession,
      refreshUser,
      logout,
    ],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
