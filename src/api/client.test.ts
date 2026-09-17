import { describe, expect, it } from "vitest";
import { createApiClient } from "./configure.js";

describe("createApiClient", () => {
  it("creates a client with default options", () => {
    const client = createApiClient();
    expect(client).toBeDefined();
    expect(client.projects).toBeDefined();
    expect(client.auth).toBeDefined();
  });

  it("creates a client with a token", () => {
    const client = createApiClient({ token: "test-token" });
    expect(client).toBeDefined();
  });

  it("creates a client with a custom base URL", () => {
    const client = createApiClient({ baseUrl: "http://localhost:3100" });
    expect(client).toBeDefined();
  });
});

describe("token management", () => {
  it("stores and retrieves refresh tokens from localStorage", async () => {
    const {
      setRefreshToken,
      getRefreshToken,
      clearTokens,
    } = await import("./client.js");

    localStorage.clear();
    setRefreshToken("test-refresh");
    expect(getRefreshToken()).toBe("test-refresh");
    expect(localStorage.getItem("refreshToken")).toBe("test-refresh");

    clearTokens();
    expect(getRefreshToken()).toBeNull();
    expect(localStorage.getItem("refreshToken")).toBeNull();
  });

  it("stores and retrieves access tokens in memory", async () => {
    const { setAccessToken, getAccessToken, clearTokens } = await import(
      "./client.js"
    );

    setAccessToken("test-access");
    expect(getAccessToken()).toBe("test-access");

    clearTokens();
    expect(getAccessToken()).toBeNull();
  });
});
