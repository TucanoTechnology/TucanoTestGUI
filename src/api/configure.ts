// Non-generated façade over the generated client. Everything under
// `src/api/generated` is overwritten by `npm run generate:client`, so the
// runtime configuration the GUI actually needs lives here instead.

import { TucanoApi, type OpenAPIConfig } from './generated';

/**
 * Path the browser always calls. nginx proxies it to the real API host (see
 * `nginx.conf`), which is why the GUI never needs to know that host.
 */
export const DEFAULT_API_BASE_URL = '/api';

/**
 * Resolves the API base URL, preferring an explicit override over the
 * `VITE_API_BASE_URL` build variable and falling back to the proxy path.
 * A trailing slash is dropped so paths are never joined as `//projects`.
 */
export function resolveApiBaseUrl(configured?: string | null): string {
  const candidate = configured?.trim();
  if (!candidate) return DEFAULT_API_BASE_URL;
  return candidate.replace(/\/+$/, '');
}

export interface ApiClientOptions {
  /** Overrides `VITE_API_BASE_URL`; mainly for tests and embedding. */
  baseUrl?: string;
  /** Bearer token for authenticated calls. */
  token?: string;
  /** Extra headers merged into every request. */
  headers?: Record<string, string>;
}

/** Builds a configured API client. This is the only way the GUI talks to the API. */
export function createApiClient(options: ApiClientOptions = {}): TucanoApi {
  const config: Partial<OpenAPIConfig> = {
    BASE: resolveApiBaseUrl(options.baseUrl ?? import.meta.env.VITE_API_BASE_URL),
  };

  if (options.token !== undefined) {
    config.TOKEN = options.token;
  }
  if (options.headers) {
    config.HEADERS = { ...options.headers };
  }

  return new TucanoApi(config);
}
