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
  setAccessToken,
  setRefreshToken,
  setApiClient,
} from "../api/client.js";
import { createApiClient, type ApiClient } from "../api/configure.js";

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
  const [tokenVersion, setTokenVersion] = useState(0);

  const client = useMemo(() => {
    const token = getAccessToken();
    const newClient = createApiClient({ baseUrl: "/api", token: token ?? undefined });
    setApiClient(newClient);
    return newClient;
  }, [tokenVersion]);

  const login = useCallback(
    async (user: string, password: string) => {
      const loginClient = createApiClient({ baseUrl: "/api" });
      const session = await loginClient.auth.login({
        requestBody: { username: user, password },
      });
      setAccessToken(session.accessToken);
      setRefreshToken(session.refreshToken);
      setTokenVersion((v) => v + 1);

      const tokenClient = createApiClient({
        baseUrl: "/api",
        token: session.accessToken,
      });
      const me = await tokenClient.auth.getCurrentUser();
      setUsername(me.username);
      setIsAuthenticated(true);
    },
    [],
  );

  const logout = useCallback(async () => {
    const rt = getRefreshToken();
    try {
      if (rt && getAccessToken()) {
        await client.auth.logout({
          requestBody: { refreshToken: rt },
        });
      }
    } catch {
      // best-effort logout
    }
    clearTokens();
    setTokenVersion((v) => v + 1);
    setIsAuthenticated(false);
    setUsername(null);
  }, [client]);

  useEffect(() => {
    const rt = getRefreshToken();
    if (!rt) return;

    const bootstrapClient = createApiClient({ baseUrl: "/api" });
    bootstrapClient.auth
      .refreshSession({ requestBody: { refreshToken: rt } })
      .then((session) => {
        setAccessToken(session.accessToken);
        setRefreshToken(session.refreshToken);
        setTokenVersion((v) => v + 1);
        const tokenClient = createApiClient({
          baseUrl: "/api",
          token: session.accessToken,
        });
        return tokenClient.auth.getCurrentUser();
      })
      .then((me) => {
        setUsername(me.username);
        setIsAuthenticated(true);
      })
      .catch(() => {
        clearTokens();
      });
  }, []);

  const value = useMemo(
    () => ({ isAuthenticated, username, client, login, logout }),
    [isAuthenticated, username, client, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
