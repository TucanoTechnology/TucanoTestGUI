import { vi } from "vitest";
import { clearTokens, setAccessToken, setApiClient } from "./api/client.js";
import { createApiClient } from "./api/configure.js";

export interface RecordedRequest {
  url: string;
  method: string;
  body: unknown;
}

export type RequestHandler = (
  request: RecordedRequest,
) => Response | Promise<Response>;

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** The API error envelope: `{ error: { code, message } }`. */
export function errorEnvelope(
  status: number,
  code: string,
  message: string,
): Response {
  return jsonResponse(status, { error: { code, message } });
}

/**
 * Answer every request the generated client makes with `handler` and point the
 * app at `/api` with a token, as an authenticated session would. Returns the
 * requests in order, so tests can assert what was sent.
 */
export function mockApi(handler: RequestHandler): RecordedRequest[] {
  const requests: RecordedRequest[] = [];

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      const request: RecordedRequest = {
        url,
        method: (init?.method ?? "GET").toUpperCase(),
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      };
      requests.push(request);
      return handler(request);
    }),
  );

  setAccessToken("test-token");
  setApiClient(createApiClient({ baseUrl: "/api", token: "test-token" }));

  return requests;
}

export function resetTestApi() {
  vi.unstubAllGlobals();
  clearTokens();
  localStorage.clear();
  sessionStorage.clear();
}
