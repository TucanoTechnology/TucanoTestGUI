import type { ApiClient } from "./configure.js";

let _client: ApiClient | null = null;
let _token: string | null = null;
let _refreshToken: string | null = null;
let _refreshPromise: Promise<void> | null = null;

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
  _token = null;
  _refreshToken = null;
  localStorage.removeItem("refreshToken");
}

export async function refreshSession(): Promise<boolean> {
  const rt = getRefreshToken();
  if (!rt || !_client) return false;

  if (_refreshPromise) {
    await _refreshPromise;
    return true;
  }

  _refreshPromise = (async () => {
    try {
      const session = await _client!.auth.refreshSession({
        requestBody: { refreshToken: rt },
      });
      setAccessToken(session.accessToken);
      setRefreshToken(session.refreshToken);
    } catch {
      clearTokens();
    } finally {
      _refreshPromise = null;
    }
  })();

  await _refreshPromise;
  return getAccessToken() !== null;
}

export async function apiFetch<T>(
  fn: (client: ApiClient) => Promise<T>,
): Promise<T> {
  const client = getApiClient();
  try {
    return await fn(client);
  } catch (error: unknown) {
    const status = (error as { status?: number })?.status;
    if (status === 401) {
      const ok = await refreshSession();
      if (ok) {
        return fn(client);
      }
    }
    throw error;
  }
}
