import { afterEach, describe, expect, it } from "vitest";
import { createApiClient } from "./configure.js";
import {
  bearerToken,
  jsonResponse,
  mockApi,
  resetTestApi,
} from "../test-utils.js";

afterEach(() => {
  resetTestApi();
});

describe("createApiClient", () => {
  it("reads a token provider once per request, so a new token is picked up", async () => {
    const requests = mockApi(() => jsonResponse(200, []));
    let token: string | null = "first-token";
    const client = createApiClient({ token: () => token });

    await client.projects.listProjects({});
    token = "second-token";
    await client.projects.listProjects({});

    expect(bearerToken(requests[0]!)).toBe("first-token");
    expect(bearerToken(requests[1]!)).toBe("second-token");
  });

  it("sends no Authorization header when the provider has no token", async () => {
    const requests = mockApi(() => jsonResponse(200, []));

    await createApiClient({ token: () => null }).projects.listProjects({});

    expect(requests[0]!.headers["authorization"]).toBeUndefined();
  });

  it("sends a static token unchanged", async () => {
    const requests = mockApi(() => jsonResponse(200, []));

    await createApiClient({ token: "static-token" }).projects.listProjects({});

    expect(bearerToken(requests[0]!)).toBe("static-token");
  });
});
