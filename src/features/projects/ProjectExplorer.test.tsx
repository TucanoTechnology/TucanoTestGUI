import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { MeResponse } from "../../api/generated/index.js";
import { setRefreshToken } from "../../api/client.js";
import { AuthProvider, useAuth } from "../../app/AuthProvider.js";
import { ProjectProvider, useProjectContext } from "../../app/ProjectContext.js";
import {
  errorEnvelope,
  jsonResponse,
  mockApi,
  resetTestApi,
  type RequestHandler,
} from "../../test-utils.js";
import { ProjectExplorer } from "./ProjectExplorer.js";

const CHECKOUT = {
  projectId: "checkout",
  name: "Checkout",
  description: "Payment flow",
  tags: ["web", "smoke"],
};

/** `GET /auth/me` for the seeded accounts, as the API reports them. */
const ADMIN_ME: MeResponse = {
  id: "u1",
  username: "admin",
  systemAdmin: true,
  roles: {},
};

const VIEWER_ME: MeResponse = {
  id: "u2",
  username: "viewer",
  systemAdmin: false,
  roles: { "checkout.json": "owner" },
};

/** The pair `POST /auth/refresh` answers a restored session with. */
const REFRESHED_SESSION = {
  accessToken: "access-2",
  refreshToken: "refresh-2",
  tokenType: "Bearer",
  expiresIn: 900,
};

/**
 * Answers the two routes the mount-restore path reads, so the explorer renders
 * under `me` rather than under no session at all, and delegates the rest.
 */
function withSession(me: MeResponse, handler: RequestHandler): RequestHandler {
  return (request) => {
    if (request.url === "/api/auth/refresh" && request.method === "POST") {
      return jsonResponse(200, REFRESHED_SESSION);
    }
    if (request.url === "/api/auth/me" && request.method === "GET") {
      return jsonResponse(200, me);
    }
    return handler(request);
  };
}

/** The seeded shape: a suite carrying its cases plus a directly owned case. */
const SEEDED_CHECKOUT = {
  ...CHECKOUT,
  testSuites: [
    {
      suiteId: "smoke",
      name: "Smoke",
      description: "Fast checks",
      testCases: [
        {
          testCaseId: "TC-CART-1",
          title: "Cart survives a refresh",
        },
      ],
    },
  ],
  testCases: [
    {
      testCaseId: "TC-PROJECT-1",
      title: "Guest checkout creates an order",
    },
  ],
};

function ContextProbe() {
  const { announcement, selection } = useProjectContext();
  return (
    <nav aria-label="Context probe">
      <span data-testid="announcement">{announcement?.message ?? ""}</span>
      <span data-testid="selection">
        {selection ? `${selection.type}:${selection.id}` : "none"}
      </span>
    </nav>
  );
}

/**
 * Reports what the shell learned about the account, so a test can tell a
 * settled account from the render before the stored session is restored.
 */
function AuthProbe() {
  const { isAuthenticated, username, systemAdmin } = useAuth();
  return (
    <nav aria-label="Account probe">
      <span data-testid="account">
        {isAuthenticated
          ? `${username}:${systemAdmin ? "system-admin" : "not-system-admin"}`
          : "signed-out"}
      </span>
    </nav>
  );
}

/** Render under `me`, as the shell does once the account has been read. */
function renderExplorer(me: MeResponse | null = null) {
  if (me) setRefreshToken("refresh-1");

  return render(
    <AuthProvider>
      <ProjectProvider>
        <ProjectExplorer />
        <ContextProbe />
        <AuthProbe />
      </ProjectProvider>
    </AuthProvider>,
  );
}

async function openCreateForm() {
  // The control is offered on the account's authority, so it is there a tick
  // after the stored session has been restored.
  fireEvent.click(await screen.findByRole("button", { name: "New Project" }));
  const dialog = await screen.findByRole("dialog", { name: "New project" });
  return {
    dialog,
    form: within(dialog).getByRole("form", { name: "Create project form" }),
  };
}

afterEach(() => {
  resetTestApi();
});

describe("ProjectExplorer", () => {
  it("creates a project, refreshes the explorer and selects it", async () => {
    const projectIds: string[] = [];
    const requests = mockApi(
      withSession(ADMIN_ME, ({ url, method }) => {
        if (url === "/api/projects" && method === "GET") {
          return jsonResponse(200, projectIds);
        }
        if (url === "/api/projects" && method === "POST") {
          projectIds.push(CHECKOUT.projectId);
          return jsonResponse(201, {
            message: "Project created",
            id: "checkout",
          });
        }
        if (url === "/api/projects/checkout" && method === "GET") {
          return jsonResponse(200, CHECKOUT);
        }
        throw new Error(`Unexpected request: ${method} ${url}`);
      }),
    );

    renderExplorer(ADMIN_ME);
    expect(await screen.findByText("No projects found")).toBeInTheDocument();

    const { dialog, form } = await openCreateForm();
    fireEvent.change(within(dialog).getByLabelText("Name"), {
      target: { value: "Checkout" },
    });
    fireEvent.change(within(dialog).getByLabelText("Description"), {
      target: { value: "Payment flow" },
    });
    fireEvent.change(within(dialog).getByLabelText("Tags"), {
      target: { value: "web, smoke, web" },
    });
    fireEvent.submit(form);

    expect(await screen.findByText("Checkout")).toBeInTheDocument();

    const posts = requests.filter(
      (request) =>
        request.url === "/api/projects" && request.method === "POST",
    );
    expect(posts).toHaveLength(1);
    expect(posts[0]?.body).toEqual({
      name: "Checkout",
      description: "Payment flow",
      tags: ["web", "smoke"],
    });

    await waitFor(() => {
      expect(screen.getByTestId("selection")).toHaveTextContent(
        "project:checkout",
      );
    });
    expect(screen.getByTestId("announcement")).toHaveTextContent(
      "Project created",
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the API error envelope when creation is rejected", async () => {
    mockApi(
      withSession(ADMIN_ME, ({ url, method }) => {
        if (url === "/api/projects" && method === "GET") {
          return jsonResponse(200, []);
        }
        if (url === "/api/projects" && method === "POST") {
          return errorEnvelope(
            400,
            "invalid_request",
            "name must not be empty",
          );
        }
        throw new Error(`Unexpected request: ${method} ${url}`);
      }),
    );

    renderExplorer(ADMIN_ME);
    await screen.findByText("No projects found");

    const { dialog, form } = await openCreateForm();
    fireEvent.change(within(dialog).getByLabelText("Name"), {
      target: { value: "Checkout" },
    });
    fireEvent.submit(form);

    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent("invalid_request");
    expect(alert).toHaveTextContent("name must not be empty");
    expect(
      screen.getByRole("dialog", { name: "New project" }),
    ).toBeInTheDocument();
  });

  it("states the ID a new project's name derives", async () => {
    mockApi(
      withSession(ADMIN_ME, ({ url, method }) => {
        if (url === "/api/projects" && method === "GET") {
          return jsonResponse(200, []);
        }
        throw new Error(`Unexpected request: ${method} ${url}`);
      }),
    );

    renderExplorer(ADMIN_ME);
    await screen.findByText("No projects found");

    const { dialog } = await openCreateForm();
    expect(within(dialog).getByLabelText("Name")).toHaveAccessibleDescription(
      /with .json appended/,
    );
  });

  it("refuses a name the API cannot derive an ID from, and sends no request", async () => {
    const requests = mockApi(
      withSession(ADMIN_ME, ({ url, method }) => {
        if (url === "/api/projects" && method === "GET") {
          return jsonResponse(200, []);
        }
        throw new Error(`Unexpected request: ${method} ${url}`);
      }),
    );

    renderExplorer(ADMIN_ME);
    await screen.findByText("No projects found");

    const { dialog, form } = await openCreateForm();
    const name = within(dialog).getByLabelText("Name");

    fireEvent.change(name, { target: { value: "team/checkout" } });

    const alert = within(dialog).getByRole("alert");
    expect(alert).toHaveTextContent("team/checkout.json");
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveAccessibleDescription(/not a single path component/);
    expect(
      within(dialog).getByRole("button", { name: "Create project" }),
    ).toBeDisabled();

    // The control is disabled, but a form can be submitted without it, and the
    // API would answer the same name with an `invalid_id` the user cannot act
    // on rather than with the form's own explanation of it.
    fireEvent.submit(form);
    expect(
      screen.getByRole("dialog", { name: "New project" }),
    ).toBeInTheDocument();
    expect(
      requests.filter(
        (request) =>
          request.url === "/api/projects" && request.method === "POST",
      ),
    ).toHaveLength(0);

    fireEvent.change(name, { target: { value: "Checkout" } });
    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Create project" }),
    ).toBeEnabled();
  });

  it("renders suites, their cases and the cases the project owns directly", async () => {
    mockApi(({ url, method }) => {
      if (url === "/api/projects" && method === "GET") {
        return jsonResponse(200, [SEEDED_CHECKOUT.projectId]);
      }
      if (url === "/api/projects/checkout" && method === "GET") {
        return jsonResponse(200, SEEDED_CHECKOUT);
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    renderExplorer();

    const tree = await screen.findByRole("tree");
    // The project counts both children: its suite and its directly owned case.
    // The count span abuts the label, so the accessible name carries no space.
    fireEvent.click(
      within(tree).getByRole("button", { name: /^Checkout\s*2$/ }),
    );

    const directCase = within(tree).getByRole("button", {
      name: "Guest checkout creates an order",
    });
    fireEvent.click(directCase);
    await waitFor(() => {
      expect(screen.getByTestId("selection")).toHaveTextContent(
        "case:TC-PROJECT-1",
      );
    });

    // A suite keeps nesting its own cases under itself.
    fireEvent.click(
      within(tree).getByRole("button", { name: /^Smoke\s*1$/ }),
    );
    fireEvent.click(
      within(tree).getByRole("button", { name: "Cart survives a refresh" }),
    );
    await waitFor(() => {
      expect(screen.getByTestId("selection")).toHaveTextContent(
        "case:TC-CART-1",
      );
    });
  });

  it("filters the project list by tag through the API", async () => {
    const requests = mockApi(({ url, method }) => {
      if (url === "/api/projects" && method === "GET") {
        return jsonResponse(200, [CHECKOUT.projectId]);
      }
      if (url === "/api/projects?tags=web%2Csmoke" && method === "GET") {
        return jsonResponse(200, [CHECKOUT.projectId]);
      }
      if (url === "/api/projects/checkout" && method === "GET") {
        return jsonResponse(200, CHECKOUT);
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    renderExplorer();
    expect(await screen.findByText("Checkout")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filter by tags"), {
      target: { value: "web, smoke, web" },
    });
    // Typing alone does not filter: the list is fetched on submit.
    expect(requests.some((request) => request.url.includes("tags"))).toBe(
      false,
    );

    fireEvent.submit(
      screen.getByRole("form", { name: "Filter projects by tags" }),
    );

    await waitFor(() => {
      expect(requests.some((request) => request.url === "/api/projects?tags=web%2Csmoke")).toBe(
        true,
      );
    });
  });

  it("never sends an empty tags parameter", async () => {
    const requests = mockApi(({ url, method }) => {
      if (url === "/api/projects" && method === "GET") {
        return jsonResponse(200, [CHECKOUT.projectId]);
      }
      if (url === "/api/projects/checkout" && method === "GET") {
        return jsonResponse(200, CHECKOUT);
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    renderExplorer();
    expect(await screen.findByText("Checkout")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filter by tags"), {
      target: { value: " , " },
    });
    fireEvent.submit(
      screen.getByRole("form", { name: "Filter projects by tags" }),
    );

    // A field with nothing in it is the unfiltered list: the API reads `?tags=`
    // as matching nothing, so the parameter stays off the request entirely.
    expect(requests.some((request) => request.url.includes("tags"))).toBe(
      false,
    );
    expect(
      requests.filter((request) => request.url === "/api/projects"),
    ).toHaveLength(1);
    expect(screen.getByText("Checkout")).toBeInTheDocument();
  });

  it("clears the tag filter and returns to the unfiltered list", async () => {
    const requests = mockApi(({ url, method }) => {
      if (url === "/api/projects" && method === "GET") {
        return jsonResponse(200, [CHECKOUT.projectId]);
      }
      if (url === "/api/projects?tags=web" && method === "GET") {
        return jsonResponse(200, []);
      }
      if (url === "/api/projects/checkout" && method === "GET") {
        return jsonResponse(200, CHECKOUT);
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    renderExplorer();
    expect(await screen.findByText("Checkout")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filter by tags"), {
      target: { value: "web" },
    });
    fireEvent.submit(
      screen.getByRole("form", { name: "Filter projects by tags" }),
    );

    expect(await screen.findByText("No projects carry “web”")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(await screen.findByText("Checkout")).toBeInTheDocument();
    expect(
      requests.filter((request) => request.url === "/api/projects"),
    ).toHaveLength(2);
    expect(
      screen.queryByRole("button", { name: "Clear" }),
    ).not.toBeInTheDocument();
  });

  it("does not offer the create the account's authority cannot use", async () => {
    mockApi(
      withSession(VIEWER_ME, ({ url, method }) => {
        if (url === "/api/projects" && method === "GET") {
          return jsonResponse(200, [CHECKOUT.projectId]);
        }
        if (url === "/api/projects/checkout" && method === "GET") {
          return jsonResponse(200, CHECKOUT);
        }
        throw new Error(`Unexpected request: ${method} ${url}`);
      }),
    );

    renderExplorer(VIEWER_ME);

    // The account is settled — the stored session was restored, roles and all —
    // before the toolbar is judged, so the absence below is not just the
    // render that precedes the restore.
    expect(await screen.findByText("viewer:not-system-admin")).toBeInTheDocument();
    expect(await screen.findByText("Checkout")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "New Project" }),
    ).not.toBeInTheDocument();
    // The refusal is not silent: the toolbar says why, and the role the account
    // does hold on `checkout.json` belongs to that project's own controls.
    expect(
      screen.getByText("Only a system administrator can create a project."),
    ).toBeInTheDocument();
  });

  it("offers the create to a system administrator holding no role", async () => {
    mockApi(
      withSession(ADMIN_ME, ({ url, method }) => {
        if (url === "/api/projects" && method === "GET") {
          return jsonResponse(200, []);
        }
        throw new Error(`Unexpected request: ${method} ${url}`);
      }),
    );

    renderExplorer(ADMIN_ME);

    expect(await screen.findByText("admin:system-admin")).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: "New Project" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Only a system administrator can create a project."),
    ).not.toBeInTheDocument();
  });

  it("has no accessibility violations with the create form open", async () => {
    mockApi(
      withSession(ADMIN_ME, ({ url, method }) => {
        if (url === "/api/projects" && method === "GET") {
          return jsonResponse(200, [CHECKOUT.projectId]);
        }
        if (url === "/api/projects/checkout" && method === "GET") {
          return jsonResponse(200, CHECKOUT);
        }
        throw new Error(`Unexpected request: ${method} ${url}`);
      }),
    );

    const { baseElement } = renderExplorer(ADMIN_ME);
    expect(await screen.findByText("Checkout")).toBeInTheDocument();
    await openCreateForm();

    const { default: axe } = await import("axe-core");
    const results = await axe.run(baseElement, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });

  it("has no accessibility violations without the create control", async () => {
    mockApi(
      withSession(VIEWER_ME, ({ url, method }) => {
        if (url === "/api/projects" && method === "GET") {
          return jsonResponse(200, [CHECKOUT.projectId]);
        }
        if (url === "/api/projects/checkout" && method === "GET") {
          return jsonResponse(200, CHECKOUT);
        }
        throw new Error(`Unexpected request: ${method} ${url}`);
      }),
    );

    const { baseElement } = renderExplorer(VIEWER_ME);
    expect(await screen.findByText("viewer:not-system-admin")).toBeInTheDocument();
    expect(await screen.findByText("Checkout")).toBeInTheDocument();

    const { default: axe } = await import("axe-core");
    const results = await axe.run(baseElement, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });
});
