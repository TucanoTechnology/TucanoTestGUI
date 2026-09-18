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
import type { MeResponse } from "../api/generated/index.js";

interface AuthState {
  isAuthenticated: boolean;
  username: string | null;
  /**
   * The authority `/auth/me` reports for the token's account. A control only a
   * system administrator may use is offered on this, never on `roles`, because
   * an administrator reaches every project holding no role in any of them.
   */
  systemAdmin: boolean;
  /**
   * The role the account holds on each project it can reach, keyed by project
   * id. Empty for an account that reaches every project through its authority,
   * and stale by design: a role revoked since the token was minted stays here
   * until the token expires, so an unexpected `forbidden` must still render.
   */
  roles: Record<string, string>;
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
  const [systemAdmin, setSystemAdmin] = useState(false);
  const [roles, setRoles] = useState<Record<string, string>>({});

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

  // Both `me` reads land here, so the account's authority and roles are set
  // exactly where its name is and can never disagree with it.
  const applyAccount = useCallback((me: MeResponse) => {
    setUsername(me.username);
    setSystemAdmin(me.systemAdmin === true);
    setRoles(me.roles ?? {});
  }, []);

  const signOut = useCallback(() => {
    clearTokens();
    setIsAuthenticated(false);
    setUsername(null);
    setSystemAdmin(false);
    setRoles({});
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
      applyAccount(me);
      setIsAuthenticated(true);
    },
    [client, applyAccount],
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
        applyAccount(me);
        setIsAuthenticated(true);
      } catch {
        // The stored session could not be confirmed; stay on the login screen.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [client, applyAccount]);

  const value = useMemo(
    () => ({
      isAuthenticated,
      username,
      systemAdmin,
      roles,
      client,
      login,
      logout,
    }),
    [
      isAuthenticated,
      username,
      systemAdmin,
      roles,
      client,
      login,
      logout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
