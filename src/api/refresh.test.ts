import { afterEach, describe, expect, it, vi } from "vitest";
import {
  apiFetch,
  clearTokens,
  getAccessToken,
  getRefreshToken,
  onSessionExpired,
  setRefreshToken,
} from "./client.js";
import {
  bearerToken,
  errorEnvelope,
  jsonResponse,
  mockApi,
  resetTestApi,
} from "../test-utils.js";

const REFRESHED = {
  accessToken: "access-2",
  refreshToken: "refresh-2",
  tokenType: "Bearer",
  expiresIn: 900,
};

const EXPIRED = () => errorEnvelope(401, "unauthenticated", "token expired");

afterEach(() => {
  resetTestApi();
});

describe("refresh and retry", () => {
  it("retries a 401 with the token the refresh returned", async () => {
    let attempts = 0;
    const requests = mockApi(({ url, method }) => {
      if (url === "/api/auth/refresh" && method === "POST") {
        return jsonResponse(200, REFRESHED);
      }
      if (url === "/api/projects" && method === "GET") {
        attempts += 1;
        return attempts === 1 ? EXPIRED() : jsonResponse(200, ["checkout"]);
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });
    setRefreshToken("refresh-1");

    const projects = await apiFetch((client) => client.projects.listProjects({}));

    expect(projects).toEqual(["checkout"]);
    const calls = requests.filter((request) => request.url === "/api/projects");
    expect(calls).toHaveLength(2);
    expect(bearerToken(calls[0]!)).toBe("test-token");
    expect(bearerToken(calls[1]!)).toBe("access-2");
    expect(getAccessToken()).toBe("access-2");
    expect(getRefreshToken()).toBe("refresh-2");
  });

  it("exchanges the refresh token anonymously", async () => {
    const requests = mockApi(({ url, method }) => {
      if (url === "/api/auth/refresh" && method === "POST") {
        return jsonResponse(200, REFRESHED);
      }
      if (url === "/api/projects" && method === "GET") {
        return EXPIRED();
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });
    setRefreshToken("refresh-1");

    await expect(
      apiFetch((client) => client.projects.listProjects({})),
    ).rejects.toThrow();

    const refresh = requests.find((request) => request.url === "/api/auth/refresh");
    expect(refresh).toBeDefined();
    expect(refresh!.headers["authorization"]).toBeUndefined();
    expect(refresh!.body).toEqual({ refreshToken: "refresh-1" });
  });

  it("performs one exchange for concurrent 401 responses", async () => {
    let attempts = 0;
    let exchanges = 0;
    mockApi(({ url, method }) => {
      if (url === "/api/auth/refresh" && method === "POST") {
        exchanges += 1;
        return jsonResponse(200, REFRESHED);
      }
      if (url === "/api/projects" && method === "GET") {
        attempts += 1;
        return attempts <= 2 ? EXPIRED() : jsonResponse(200, []);
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });
    setRefreshToken("refresh-1");

    const results = await Promise.all([
      apiFetch((client) => client.projects.listProjects({})),
      apiFetch((client) => client.projects.listProjects({})),
    ]);

    expect(exchanges).toBe(1);
    expect(results).toEqual([[], []]);
  });

  it("reports the session expired and stops retrying when the refresh is refused", async () => {
    const expired = vi.fn();
    const unsubscribe = onSessionExpired(expired);
    const requests = mockApi(({ url, method }) => {
      if (url === "/api/auth/refresh" && method === "POST") {
        return errorEnvelope(401, "invalid_token", "refresh token revoked");
      }
      if (url === "/api/projects" && method === "GET") {
        return EXPIRED();
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });
    setRefreshToken("refresh-1");

    await expect(
      apiFetch((client) => client.projects.listProjects({})),
    ).rejects.toThrow();

    expect(expired).toHaveBeenCalledTimes(1);
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(
      requests.filter((request) => request.url === "/api/projects"),
    ).toHaveLength(1);
    unsubscribe();
  });

  it("ignores a refresh that lands after the session was cleared", async () => {
    let releaseRefresh!: (response: Response) => void;
    let refreshStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      refreshStarted = resolve;
    });
    const pending = new Promise<Response>((resolve) => {
      releaseRefresh = resolve;
    });

    mockApi(({ url, method }) => {
      if (url === "/api/auth/refresh" && method === "POST") {
        refreshStarted();
        return pending;
      }
      if (url === "/api/projects" && method === "GET") {
        return EXPIRED();
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });
    setRefreshToken("refresh-1");

    const attempt = apiFetch((client) => client.projects.listProjects({})).catch(
      () => "refused",
    );

    await started;
    clearTokens();
    releaseRefresh(jsonResponse(200, REFRESHED));

    expect(await attempt).toBe("refused");
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });
});
