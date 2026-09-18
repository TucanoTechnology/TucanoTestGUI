import { afterEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { AuthProvider, useAuth } from "./AuthProvider.js";
import { apiFetch, setRefreshToken } from "../api/client.js";
import {
  bearerToken,
  errorEnvelope,
  jsonResponse,
  mockApi,
  resetTestApi,
} from "../test-utils.js";

const SESSION = {
  accessToken: "access-1",
  refreshToken: "refresh-1",
  tokenType: "Bearer",
  expiresIn: 900,
};

function Probe() {
  const { isAuthenticated, username, systemAdmin, roles, login, logout } =
    useAuth();
  const [projects, setProjects] = useState("none");

  const load = () => {
    void apiFetch((client) => client.projects.listProjects({})).then(
      (ids) => setProjects(ids.join(",")),
      () => setProjects("failed"),
    );
  };

  return (
    <div>
      <span data-testid="state">
        {isAuthenticated ? `signed-in:${username}` : "signed-out"}
      </span>
      <span data-testid="authority">
        {isAuthenticated
          ? systemAdmin
            ? "system-admin"
            : "not-system-admin"
          : "none"}
      </span>
      <span data-testid="roles">
        {Object.entries(roles)
          .map(([projectId, role]) => `${projectId}=${role}`)
          .join(",")}
      </span>
      <span data-testid="projects">{projects}</span>
      <button
        type="button"
        onClick={() => {
          void login("admin", "demo-admin-password").catch(() => undefined);
        }}
      >
        Sign in
      </button>
      <button type="button" onClick={load}>
        Load projects
      </button>
      <button
        type="button"
        onClick={() => {
          void logout();
        }}
      >
        Sign out
      </button>
    </div>
  );
}

function renderProbe() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

async function signIn() {
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  await waitFor(() => {
    expect(screen.getByTestId("state")).toHaveTextContent("signed-in:admin");
  });
}

afterEach(() => {
  resetTestApi();
});

describe("AuthProvider", () => {
  it("sends the bearer token from a sign-in on later requests", async () => {
    const requests = mockApi(({ url, method }) => {
      if (url === "/api/auth/login" && method === "POST") {
        return jsonResponse(200, SESSION);
      }
      if (url === "/api/auth/me" && method === "GET") {
        return jsonResponse(200, { username: "admin" });
      }
      if (url === "/api/projects" && method === "GET") {
        return jsonResponse(200, ["checkout"]);
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    renderProbe();
    await signIn();
    fireEvent.click(screen.getByRole("button", { name: "Load projects" }));

    await waitFor(() => {
      expect(screen.getByTestId("projects")).toHaveTextContent("checkout");
    });

    const login = requests.find((request) => request.url === "/api/auth/login");
    expect(login!.body).toEqual({
      username: "admin",
      password: "demo-admin-password",
    });
    expect(login!.headers["authorization"]).toBeUndefined();

    const me = requests.find((request) => request.url === "/api/auth/me");
    expect(me!.headers["authorization"]).toBe("Bearer access-1");

    const data = requests.find((request) => request.url === "/api/projects");
    expect(bearerToken(data!)).toBe("access-1");
    expect(localStorage.getItem("refreshToken")).toBe("refresh-1");
  });

  it("keeps the authority and project roles the account is signed in with", async () => {
    mockApi(({ url, method }) => {
      if (url === "/api/auth/login" && method === "POST") {
        return jsonResponse(200, SESSION);
      }
      if (url === "/api/auth/me" && method === "GET") {
        return jsonResponse(200, {
          id: "u2",
          username: "viewer",
          systemAdmin: false,
          roles: { "checkout.json": "owner" },
        });
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    renderProbe();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    // The authority arrives with the account, not after it: a control is never
    // rendered for an account whose name is already known.
    await waitFor(() => {
      expect(screen.getByTestId("authority")).toHaveTextContent(
        "not-system-admin",
      );
    });
    expect(screen.getByTestId("state")).toHaveTextContent("signed-in:viewer");
    expect(screen.getByTestId("roles")).toHaveTextContent("checkout.json=owner");
  });

  it("keeps the authority a stored session is restored with", async () => {
    setRefreshToken("refresh-1");
    mockApi(({ url, method }) => {
      if (url === "/api/auth/refresh" && method === "POST") {
        return jsonResponse(200, SESSION);
      }
      if (url === "/api/auth/me" && method === "GET") {
        return jsonResponse(200, {
          id: "u1",
          username: "admin",
          systemAdmin: true,
          roles: {},
        });
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    renderProbe();

    await waitFor(() => {
      expect(screen.getByTestId("authority")).toHaveTextContent(
        "system-admin",
      );
    });
    expect(screen.getByTestId("state")).toHaveTextContent("signed-in:admin");
    // The administrator reaches every project holding no role in any of them,
    // so the authority is what carries its controls.
    expect(screen.getByTestId("roles")).toBeEmptyDOMElement();
  });

  it("returns to the login screen when the refresh is refused", async () => {
    mockApi(({ url, method }) => {
      if (url === "/api/auth/login" && method === "POST") {
        return jsonResponse(200, SESSION);
      }
      if (url === "/api/auth/me" && method === "GET") {
        return jsonResponse(200, { username: "admin" });
      }
      if (url === "/api/projects" && method === "GET") {
        return errorEnvelope(401, "unauthenticated", "access token expired");
      }
      if (url === "/api/auth/refresh" && method === "POST") {
        return errorEnvelope(401, "invalid_token", "refresh token revoked");
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    renderProbe();
    await signIn();
    fireEvent.click(screen.getByRole("button", { name: "Load projects" }));

    await waitFor(() => {
      expect(screen.getByTestId("state")).toHaveTextContent("signed-out");
    });
    expect(screen.getByTestId("projects")).toHaveTextContent("failed");
    expect(localStorage.getItem("refreshToken")).toBeNull();
  });

  it("sends the refresh token on logout and clears the session", async () => {
    const requests = mockApi(({ url, method }) => {
      if (url === "/api/auth/login" && method === "POST") {
        return jsonResponse(200, SESSION);
      }
      if (url === "/api/auth/me" && method === "GET") {
        return jsonResponse(200, { username: "admin" });
      }
      if (url === "/api/auth/logout" && method === "POST") {
        return new Response(null, { status: 204 });
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    renderProbe();
    await signIn();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => {
      expect(screen.getByTestId("state")).toHaveTextContent("signed-out");
    });
    // The authority does not outlive the session it was reported for.
    expect(screen.getByTestId("authority")).toHaveTextContent("none");
    expect(screen.getByTestId("roles")).toBeEmptyDOMElement();

    const logout = requests.find((request) => request.url === "/api/auth/logout");
    expect(logout!.body).toEqual({ refreshToken: "refresh-1" });
    expect(logout!.headers["authorization"]).toBe("Bearer access-1");
    expect(localStorage.getItem("refreshToken")).toBeNull();
  });
});
