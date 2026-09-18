import type { ApiClient } from "./configure.js";
import { API_BASE_URL, createApiClient } from "./configure.js";

let _client: ApiClient | null = null;
let _token: string | null = null;
let _refreshToken: string | null = null;
let _refreshPromise: Promise<boolean> | null = null;
let _sessionGeneration = 0;

type SessionExpiredListener = () => void;
const _sessionExpiredListeners = new Set<SessionExpiredListener>();

/**
 * Called when the refresh token can no longer buy a session, so the app can
 * clear its state and show the login screen again. Returns an unsubscribe.
 */
export function onSessionExpired(listener: SessionExpiredListener): () => void {
  _sessionExpiredListeners.add(listener);
  return () => {
    _sessionExpiredListeners.delete(listener);
  };
}

function notifySessionExpired() {
  for (const listener of [..._sessionExpiredListeners]) {
    listener();
  }
}

export function setApiClient(client: ApiClient) {
  _client = client;
}

export function getApiClient(): ApiClient {
  if (!_client) {
    throw new Error("API client not initialized. Call setApiClient() first.");
  }
  return _client;
}

export function setAccessToken(token: string | null) {
  _token = token;
}

export function getAccessToken(): string | null {
  return _token;
}

export function setRefreshToken(token: string | null) {
  _refreshToken = token;
  if (token) {
    localStorage.setItem("refreshToken", token);
  } else {
    localStorage.removeItem("refreshToken");
  }
}

export function getRefreshToken(): string | null {
  if (_refreshToken) return _refreshToken;
  return localStorage.getItem("refreshToken");
}

export function clearTokens() {
  // Bumping the generation retires any refresh already in flight, so a response
  // that arrives after this call cannot put the session back.
  _sessionGeneration += 1;
  _token = null;
  _refreshToken = null;
  localStorage.removeItem("refreshToken");
}

async function performRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  const generation = _sessionGeneration;
  try {
    // Anonymous, because the access token that just failed is the one this call
    // rotates away and a stale bearer would be rejected before the body is read.
    const session = await createApiClient({
      baseUrl: API_BASE_URL,
    }).auth.refreshSession({ requestBody: { refreshToken } });

    if (generation !== _sessionGeneration) return false;

    setAccessToken(session.accessToken);
    setRefreshToken(session.refreshToken);
    return true;
  } catch {
    if (generation === _sessionGeneration) {
      clearTokens();
      notifySessionExpired();
    }
    return false;
  }
}

/**
 * Exchanges the stored refresh token for a fresh pair. Concurrent callers share
 * one in-flight exchange, and every caller learns whether it succeeded.
 */
export async function refreshSession(): Promise<boolean> {
  if (!getRefreshToken()) return false;

  if (!_refreshPromise) {
    const pending = performRefresh().finally(() => {
      if (_refreshPromise === pending) {
        _refreshPromise = null;
      }
    });
    _refreshPromise = pending;
  }

  return _refreshPromise;
}

export async function apiFetch<T>(
  fn: (client: ApiClient) => Promise<T>,
): Promise<T> {
  const client = getApiClient();
  try {
    return await fn(client);
  } catch (error: unknown) {
    const status = (error as { status?: number })?.status;
    if (status !== 401) throw error;

    if (!(await refreshSession())) throw error;
    // The retry goes through the same client, whose token provider now reads
    // the pair this refresh just stored.
    return fn(client);
  }
}
