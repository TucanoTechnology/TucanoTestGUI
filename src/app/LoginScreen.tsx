import { useState, type FormEvent } from "react";
import { useAuth } from "./AuthProvider.js";

const DEBUG_LOGIN = import.meta.env.VITE_DEBUG_LOGIN === "true";

const DEMO_ACCOUNTS = [
  { label: "admin (systemAdmin)", username: "admin", password: "admin" },
  { label: "owner", username: "owner", password: "owner" },
  { label: "editor", username: "editor", password: "editor" },
  { label: "viewer", username: "viewer", password: "viewer" },
];

export function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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

  const fillDemo = (account: (typeof DEMO_ACCOUNTS)[number]) => {
    setUsername(account.username);
    setPassword(account.password);
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
            <p className="login-form__debug-title">Debug accounts</p>
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.username}
                type="button"
                className="login-form__debug-btn"
                onClick={() => fillDemo(account)}
              >
                {account.label}
              </button>
            ))}
          </div>
        )}
      </form>
    </div>
  );
}
