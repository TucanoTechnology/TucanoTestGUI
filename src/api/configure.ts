import { TucanoApi } from "./generated/TucanoApi.js";

/**
 * Reads the bearer token to send. It is called once per request, so a token
 * stored after the client was built — a sign-in, or the refresh a 401 triggers
 * — is the one that request carries.
 */
export type TokenProvider = () => string | null;

export interface ApiClientOptions {
  baseUrl?: string;
  token?: string | TokenProvider;
  headers?: Record<string, string>;
}

/** Where the client calls the API. `VITE_API_BASE_URL` overrides the proxied `/api`. */
export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ?? "/api";

export function createApiClient(options: ApiClientOptions = {}) {
  const { baseUrl = API_BASE_URL, token, headers = {} } = options;

  return new TucanoApi({
    BASE: baseUrl,
    HEADERS: { ...headers },
    TOKEN:
      typeof token === "function"
        ? // The generated client treats an empty token as "send no Authorization
          // header", which is what an anonymous caller wants.
          async () => token() ?? ""
        : token,
  });
}

export type ApiClient = ReturnType<typeof createApiClient>;
