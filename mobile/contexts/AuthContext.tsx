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
import { clearToken, setToken } from "@/lib/storage";
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

  const logout = useCallback(async () => {
    await clearToken();

    if (mountedRef.current) {
      setUser(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const currentUser = await api.auth.me();

    if (mountedRef.current) {
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
