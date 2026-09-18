import { vi } from "vitest";
import {
  clearTokens,
  getAccessToken,
  setAccessToken,
  setApiClient,
} from "./api/client.js";
import { createApiClient } from "./api/configure.js";

export interface RecordedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
  /** Present when the request carried `FormData`: a multipart body is not JSON. */
  formData?: FormData;
}

export type RequestHandler = (
  request: RecordedRequest,
) => Response | Promise<Response>;

/** Header names are lower-cased, the form the wire and `Headers` use. */
function readHeaders(init?: RequestInit): Record<string, string> {
  const headers = init?.headers;
  if (!headers) return {};
  const entries = headers instanceof Headers
    ? [...headers.entries()]
    : Array.isArray(headers)
      ? headers
      : Object.entries(headers);
  return Object.fromEntries(
    entries.map(([name, value]) => [name.toLowerCase(), String(value)]),
  );
}

/** The bearer token a recorded request was sent with, when it carried one. */
export function bearerToken(request: RecordedRequest): string | null {
  const header = request.headers["authorization"];
  return header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
}

/**
 * The body a test reads back: a JSON body parsed, and a body that is not JSON —
 * a raw JUnit XML report, say — kept as the text that was sent, which is what a
 * route taking a non-JSON body receives.
 */
function readBody(body: BodyInit | null | undefined): unknown {
  if (typeof body !== "string") return undefined;
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

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
      const body = init?.body;
      const formData = body instanceof FormData ? body : undefined;
      const request: RecordedRequest = {
        url,
        method: (init?.method ?? "GET").toUpperCase(),
        headers: readHeaders(init),
        body: formData ? undefined : readBody(body),
        ...(formData ? { formData } : {}),
      };
      requests.push(request);
      return handler(request);
    }),
  );

  setAccessToken("test-token");
  setApiClient(createApiClient({ baseUrl: "/api", token: getAccessToken }));

  return requests;
}

export function resetTestApi() {
  vi.unstubAllGlobals();
  clearTokens();
  localStorage.clear();
  sessionStorage.clear();
}
