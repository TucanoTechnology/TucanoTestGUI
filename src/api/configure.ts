import { TucanoApi } from "./generated/TucanoApi.js";

export interface ApiClientOptions {
  baseUrl?: string;
  token?: string;
  headers?: Record<string, string>;
}

export function createApiClient(options: ApiClientOptions = {}) {
  const { baseUrl = "/api", token, headers = {} } = options;
  const requestHeaders: Record<string, string> = { ...headers };

  if (token) {
    requestHeaders["Authorization"] = `Bearer ${token}`;
  }

  return new TucanoApi({
    BASE: baseUrl,
    HEADERS: requestHeaders,
  });
}

export type ApiClient = ReturnType<typeof createApiClient>;
