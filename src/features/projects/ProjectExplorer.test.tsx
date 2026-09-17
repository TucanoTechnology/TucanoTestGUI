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
    const results = await axe.run(baseElement);
    expect(results.violations).toEqual([]);
  });
});
