import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { setRefreshToken } from "../api/client.js";
import { jsonResponse, mockApi, resetTestApi } from "../test-utils.js";
import { AuthProvider } from "./AuthProvider.js";
import { AppShell } from "./AppShell.js";

const CHECKOUT = {
  projectId: "checkout",
  name: "Checkout",
  description: "Payment flow",
  tags: ["web"],
};

const SESSION = {
  accessToken: "access-1",
  refreshToken: "refresh-2",
  tokenType: "Bearer",
  expiresIn: 900,
};

const ACCOUNT = {
  id: "u1",
  username: "admin",
  systemAdmin: true,
  roles: {},
};

function renderShell() {
  return render(
    <AuthProvider>
      <AppShell />
    </AuthProvider>,
  );
}

afterEach(() => {
  resetTestApi();
});

describe("AppShell", () => {
  it("renders the five-area layout: top bar, nav rail and three panes", async () => {
    mockApi(({ url, method }) => {
      if (url === "/api/projects" && method === "GET") {
        return jsonResponse(200, []);
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    renderShell();

    // Top bar: brand, project switcher, user and sign-out.
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByText("Tucano Test")).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Active project" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();

    // Nav rail: one control per module, the first active.
    const navrail = screen.getByRole("navigation", {
      name: "Module navigation",
    });
    expect(within(navrail).getAllByRole("button")).toHaveLength(5);
    expect(
      within(navrail).getByRole("button", { name: "Test Cases" }),
    ).toHaveAttribute("aria-current", "page");

    // Three panes, each a landmark the panes can be reached through.
    expect(
      screen.getByRole("complementary", { name: "Project explorer" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("main", { name: "Test Cases" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("complementary", { name: "Detail panel" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Select an entity from the explorer"),
    ).toBeInTheDocument();

    expect(await screen.findByText("No projects found")).toBeInTheDocument();
  });

  it("switches the active module from the nav rail", async () => {
    mockApi(({ url, method }) => {
      if (url === "/api/projects" && method === "GET") {
        return jsonResponse(200, []);
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    renderShell();
    await screen.findByText("No projects found");

    fireEvent.click(screen.getByRole("button", { name: "Test Runs" }));

    expect(screen.getByRole("main", { name: "Test Runs" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Test Runs" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("button", { name: "Test Cases" }),
    ).not.toHaveAttribute("aria-current");
    expect(
      screen.getByText("Select a project from the explorer to view runs"),
    ).toBeInTheDocument();
  });

  it("mounts the reports views in the centre pane", async () => {
    mockApi(({ url, method }) => {
      if (url === "/api/projects" && method === "GET") {
        return jsonResponse(200, []);
      }
      if (url === "/api/reports/coverage" && method === "GET") {
        return jsonResponse(200, {
          totalCases: 4,
          suites: [
            {
              suiteId: "smoke.checkout.json",
              name: "smoke.checkout",
              caseCount: 4,
            },
          ],
        });
      }
      if (url === "/api/reports/summary" && method === "GET") {
        return jsonResponse(200, {
          total: 6,
          passed: 2,
          failed: 2,
          blocked: 1,
          untested: 0,
          passPercentage: 33.33333333333333,
          totalDurationMs: 2000,
        });
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    renderShell();
    fireEvent.click(screen.getByRole("button", { name: "Reports" }));

    const pane = screen.getByRole("main", { name: "Reports" });
    expect(
      await within(pane).findByRole("heading", { name: "Coverage" }),
    ).toBeInTheDocument();
    expect(within(pane).getByRole("heading", { name: "Summary" })).toBeInTheDocument();
    expect(
      within(pane).getByRole("group", { name: "Report filters" }),
    ).toBeInTheDocument();
  });

  it("re-scopes the panes when the top bar picks a project", async () => {
    mockApi(({ url, method }) => {
      if (url === "/api/projects" && method === "GET") {
        return jsonResponse(200, [CHECKOUT.projectId]);
      }
      if (url === "/api/projects/checkout" && method === "GET") {
        return jsonResponse(200, CHECKOUT);
      }
      if (url === "/api/projects/checkout/test_cases" && method === "GET") {
        return jsonResponse(200, []);
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    renderShell();

    const switcher = screen.getByRole("combobox", { name: "Active project" });
    await screen.findByRole("option", { name: "Checkout" });
    fireEvent.change(switcher, { target: { value: CHECKOUT.projectId } });

    expect(
      await screen.findByRole("heading", { level: 2, name: "Checkout" }),
    ).toBeInTheDocument();
    expect(screen.getByText("No cases found")).toBeInTheDocument();
    expect(
      screen.getByText("Selected project: checkout", { selector: ".sr-only" }),
    ).toBeInTheDocument();
    expect(sessionStorage.getItem("selectedProjectId")).toBe("checkout");
  });

  it("mounts the suite tree in the left pane once a project is active", async () => {
    mockApi(({ url, method }) => {
      if (url === "/api/projects" && method === "GET") {
        return jsonResponse(200, [CHECKOUT.projectId]);
      }
      if (url === "/api/projects/checkout" && method === "GET") {
        return jsonResponse(200, {
          ...CHECKOUT,
          testSuites: [
            {
              suiteId: "suite-login",
              name: "Login",
              testCases: [{ testCaseId: "case-signin", title: "Signs in" }],
            },
          ],
        });
      }
      if (url === "/api/projects/checkout/test_cases" && method === "GET") {
        return jsonResponse(200, []);
      }
      if (url === "/api/test_suites/suite-login" && method === "GET") {
        return jsonResponse(200, { suiteId: "suite-login", name: "Login" });
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    renderShell();
    expect(
      screen.getByRole("complementary", { name: "Project explorer" }),
    ).toBeInTheDocument();

    await screen.findByRole("option", { name: "Checkout" });
    fireEvent.change(screen.getByRole("combobox", { name: "Active project" }), {
      target: { value: CHECKOUT.projectId },
    });

    const pane = await screen.findByRole("complementary", {
      name: "Suite tree",
    });
    expect(
      screen.queryByRole("complementary", { name: "Project explorer" }),
    ).not.toBeInTheDocument();
    expect(within(pane).getByRole("heading", { name: "Suites" })).toBeInTheDocument();
    expect(
      await within(pane).findByRole("button", { name: /All test cases/ }),
    ).toBeInTheDocument();
    expect(
      within(pane).getByRole("button", { name: /Directly in project/ }),
    ).toBeInTheDocument();

    fireEvent.click(within(pane).getByRole("button", { name: /Login/ }));

    expect(
      await screen.findByText("Selected suite: suite-login", {
        selector: ".sr-only",
      }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { level: 2, name: "Login" }),
    ).toBeInTheDocument();
  });

  it("shows the signed-in account and signs out from the top bar", async () => {
    setRefreshToken("refresh-1");
    const requests = mockApi(({ url, method }) => {
      if (url === "/api/auth/refresh" && method === "POST") {
        return jsonResponse(200, SESSION);
      }
      if (url === "/api/auth/me" && method === "GET") {
        return jsonResponse(200, ACCOUNT);
      }
      if (url === "/api/projects" && method === "GET") {
        return jsonResponse(200, []);
      }
      if (url === "/api/auth/logout" && method === "POST") {
        return jsonResponse(200, { message: "Signed out" });
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    renderShell();

    expect(await screen.findByText("admin")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => {
      expect(screen.queryByText("admin")).not.toBeInTheDocument();
    });
    expect(
      requests.some(
        (request) =>
          request.url === "/api/auth/logout" && request.method === "POST",
      ),
    ).toBe(true);
  });

  it("has no accessibility violations", async () => {
    mockApi(({ url, method }) => {
      if (url === "/api/projects" && method === "GET") {
        return jsonResponse(200, [CHECKOUT.projectId]);
      }
      if (url === "/api/projects/checkout" && method === "GET") {
        return jsonResponse(200, CHECKOUT);
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    const { baseElement } = renderShell();
    await screen.findByRole("treeitem", { name: "Checkout" });

    const { default: axe } = await import("axe-core");
    const results = await axe.run(baseElement);
    expect(results.violations).toEqual([]);
  });
});
