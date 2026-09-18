import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  onSessionExpired,
  refreshSession,
  setAccessToken,
  setRefreshToken,
  setApiClient,
} from "../api/client.js";
import { API_BASE_URL, createApiClient, type ApiClient } from "../api/configure.js";

interface AuthState {
  isAuthenticated: boolean;
  username: string | null;
  client: ApiClient;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState<string | null>(null);

  // Built once. Its token provider reads the stored access token per request, so
  // sign-in and refresh do not have to rebuild it to change the bearer header.
  const client = useMemo(() => {
    const newClient = createApiClient({
      baseUrl: API_BASE_URL,
      token: getAccessToken,
    });
    setApiClient(newClient);
    return newClient;
  }, []);

  const signOut = useCallback(() => {
    clearTokens();
    setIsAuthenticated(false);
    setUsername(null);
  }, []);

  useEffect(() => onSessionExpired(signOut), [signOut]);

  const login = useCallback(
    async (user: string, password: string) => {
      const session = await createApiClient({
        baseUrl: API_BASE_URL,
      }).auth.login({ requestBody: { username: user, password } });

      setAccessToken(session.accessToken);
      setRefreshToken(session.refreshToken);

      const me = await client.auth.getCurrentUser();
      setUsername(me.username);
      setIsAuthenticated(true);
    },
    [client],
  );

  const logout = useCallback(async () => {
    const refreshToken = getRefreshToken();
    try {
      if (refreshToken && getAccessToken()) {
        await client.auth.logout({ requestBody: { refreshToken } });
      }
    } catch {
      // best-effort logout
    }
    signOut();
  }, [client, signOut]);

  useEffect(() => {
    if (!getRefreshToken()) return;

    let cancelled = false;

    void (async () => {
      if (!(await refreshSession())) return;

      try {
        const me = await client.auth.getCurrentUser();
        if (cancelled) return;
        setUsername(me.username);
        setIsAuthenticated(true);
      } catch {
        // The stored session could not be confirmed; stay on the login screen.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [client]);

  const value = useMemo(
    () => ({ isAuthenticated, username, client, login, logout }),
    [isAuthenticated, username, client, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
