import { useState, type FormEvent } from "react";
import { useAuth } from "./AuthProvider.js";

/**
 * The build-time environment the debug flag and demo passwords are read from.
 * The index signature lets `import.meta.env` — which declares no `VITE_` name —
 * be passed straight in.
 */
export interface DebugLoginEnv {
  [key: string]: string | undefined;
  VITE_DEBUG_LOGIN?: string;
  VITE_DEMO_ADMIN_PASSWORD?: string;
  VITE_DEMO_VIEWER_PASSWORD?: string;
}

export interface DemoAccount {
  label: string;
  username: string;
  password: string;
}

export function debugLoginEnabled(env: DebugLoginEnv): boolean {
  return env.VITE_DEBUG_LOGIN === "true";
}

/**
 * The accounts a seeded TucanoTestAPI deployment can sign in as, with the
 * defaults its own seed path documents: `admin` is the bootstrap account
 * (`scripts/demo.sh`, `DEMO_ADMIN_PASSWORD`) and `viewer` is the one account the
 * seed creates and grants (`scripts/seed.mjs`, `TUCANO_SEED_VIEWER_PASSWORD`).
 * A deployment that seeds its own passwords supplies them at build time.
 *
 * The seed grants no other account, so there is no separate `owner` or `editor`
 * login to pre-fill until TucanoTestAPI seeds one.
 */
export function readDemoAccounts(env: DebugLoginEnv): DemoAccount[] {
  return [
    {
      label: "admin (systemAdmin)",
      username: "admin",
      password: env.VITE_DEMO_ADMIN_PASSWORD ?? "demo-admin-password",
    },
    {
      label: "viewer (owner on checkout.json)",
      username: "viewer",
      password: env.VITE_DEMO_VIEWER_PASSWORD ?? "viewer-seed-password",
    },
  ];
}

export function initialCredentials(
  enabled: boolean,
  accounts: DemoAccount[],
): { username: string; password: string } {
  const first = enabled ? accounts[0] : undefined;
  return { username: first?.username ?? "", password: first?.password ?? "" };
}

const DEBUG_LOGIN = debugLoginEnabled(import.meta.env);
const DEMO_ACCOUNTS = readDemoAccounts(import.meta.env);
const INITIAL_CREDENTIALS = initialCredentials(DEBUG_LOGIN, DEMO_ACCOUNTS);

export function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState(INITIAL_CREDENTIALS.username);
  const [password, setPassword] = useState(INITIAL_CREDENTIALS.password);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
    } catch {
      setError("Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (account: DemoAccount) => {
    setUsername(account.username);
    setPassword(account.password);
    setError(null);
  };

  return (
    <div className="login-screen">
      <form className="login-form" onSubmit={handleSubmit} aria-label="Sign in">
        <h1 className="login-form__title">Tucano Test</h1>

        {error && (
          <div className="error-display" role="alert">
            {error}
          </div>
        )}

        <div className="login-form__field">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
            aria-required="true"
          />
        </div>

        <div className="login-form__field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            aria-required="true"
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary login-form__submit"
          disabled={loading}
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>

        {DEBUG_LOGIN && (
          <div className="login-form__debug">
            <p className="login-form__debug-title">Demo accounts</p>
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.username}
                type="button"
                className="login-form__debug-btn"
                onClick={() => fillDemo(account)}
              >
                {account.label} — {account.username} / {account.password}
              </button>
            ))}
          </div>
        )}
      </form>
    </div>
  );
}
