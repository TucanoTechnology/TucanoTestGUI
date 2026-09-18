import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AuthProvider } from "../../app/AuthProvider.js";
import { ProjectProvider, useProjectContext } from "../../app/ProjectContext.js";
import {
  errorEnvelope,
  jsonResponse,
  mockApi,
  resetTestApi,
} from "../../test-utils.js";
import { ProjectExplorer } from "./ProjectExplorer.js";

const CHECKOUT = {
  projectId: "checkout",
  name: "Checkout",
  description: "Payment flow",
  tags: ["web", "smoke"],
};

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

function renderExplorer() {
  return render(
    <AuthProvider>
      <ProjectProvider>
        <ProjectExplorer />
        <ContextProbe />
      </ProjectProvider>
    </AuthProvider>,
  );
}

async function openCreateForm() {
  fireEvent.click(screen.getByRole("button", { name: "New Project" }));
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
    const requests = mockApi(({ url, method }) => {
      if (url === "/api/projects" && method === "GET") {
        return jsonResponse(200, projectIds);
      }
      if (url === "/api/projects" && method === "POST") {
        projectIds.push(CHECKOUT.projectId);
        return jsonResponse(201, { message: "Project created", id: "checkout" });
      }
      if (url === "/api/projects/checkout" && method === "GET") {
        return jsonResponse(200, CHECKOUT);
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    renderExplorer();
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

    const posts = requests.filter((request) => request.method === "POST");
    expect(posts).toHaveLength(1);
    expect(posts[0]?.url).toBe("/api/projects");
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
    mockApi(({ url, method }) => {
      if (url === "/api/projects" && method === "GET") {
        return jsonResponse(200, []);
      }
      if (url === "/api/projects" && method === "POST") {
        return errorEnvelope(400, "invalid_request", "name must not be empty");
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    renderExplorer();
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

  it("has no accessibility violations with the create form open", async () => {
    mockApi(({ url, method }) => {
      if (url === "/api/projects" && method === "GET") {
        return jsonResponse(200, [CHECKOUT.projectId]);
      }
      if (url === "/api/projects/checkout" && method === "GET") {
        return jsonResponse(200, CHECKOUT);
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    const { baseElement } = renderExplorer();
    expect(await screen.findByText("Checkout")).toBeInTheDocument();
    await openCreateForm();

    const { default: axe } = await import("axe-core");
    const results = await axe.run(baseElement, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });
});
