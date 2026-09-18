import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../../app/AuthProvider.js";
import {
  ProjectProvider,
  useProjectContext,
} from "../../app/ProjectContext.js";
import {
  errorEnvelope,
  jsonResponse,
  mockApi,
  resetTestApi,
} from "../../test-utils.js";
import { DIRECT_SUITE_ID, SuiteTree } from "./SuiteTree.js";

const PROJECT = {
  projectId: "checkout",
  name: "Checkout",
  testSuites: [
    {
      suiteId: "suite-login",
      name: "Login",
      testCases: [{ testCaseId: "case-signin", title: "Signs in" }],
    },
    {
      suiteId: "suite-search",
      name: "Search",
      testCases: [
        { testCaseId: "case-find", title: "Finds a product" },
        { testCaseId: "case-filter", title: "Filters results" },
      ],
    },
  ],
  testCases: [{ testCaseId: "case-direct", title: "Health check" }],
};

/** The shell owns the live region the tree announces into; the probe stands in
 * for it, inside the pane so the tree's content stays inside a landmark. */
function AnnouncementProbe() {
  const { announcement } = useProjectContext();
  return <span data-testid="announcement">{announcement?.message ?? ""}</span>;
}

function renderTree(selectedSuiteId: string | null = null) {
  const onSelectSuite = vi.fn();
  const view = render(
    <AuthProvider>
      <ProjectProvider>
        {/* The shell mounts the tree inside its left pane; the landmark is part
            of the pane, not of the tree. */}
        <aside aria-label="Suite tree">
          <SuiteTree
            projectId={PROJECT.projectId}
            selectedSuiteId={selectedSuiteId}
            onSelectSuite={onSelectSuite}
          />
          <AnnouncementProbe />
        </aside>
      </ProjectProvider>
    </AuthProvider>,
  );
  return { ...view, onSelectSuite };
}

afterEach(() => {
  resetTestApi();
});

describe("SuiteTree", () => {
  it("pins the virtual nodes above the project's suites with their counts", async () => {
    mockApi(({ url, method }) => {
      if (url === "/api/projects/checkout" && method === "GET") {
        return jsonResponse(200, PROJECT);
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    renderTree();

    const all = await screen.findByRole("button", { name: /All test cases/ });
    expect(all).toHaveTextContent("4");
    expect(
      screen.getByRole("button", { name: /Directly in project/ }),
    ).toHaveTextContent("1");

    const tree = screen.getByRole("tree");
    const nodes = within(tree).getAllByRole("button");
    expect(nodes.map((node) => node.textContent)).toEqual([
      expect.stringContaining("All test cases"),
      expect.stringContaining("Directly in project"),
      expect.stringContaining("Login"),
      expect.stringContaining("Search"),
    ]);
  });

  it("reports the selected suite and clears the selection for pinned nodes", async () => {
    mockApi(({ url, method }) => {
      if (url === "/api/projects/checkout" && method === "GET") {
        return jsonResponse(200, PROJECT);
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    const { onSelectSuite } = renderTree();

    fireEvent.click(await screen.findByRole("button", { name: /Login/ }));
    expect(onSelectSuite).toHaveBeenLastCalledWith("suite-login");

    fireEvent.click(screen.getByRole("button", { name: /Directly in project/ }));
    expect(onSelectSuite).toHaveBeenLastCalledWith(DIRECT_SUITE_ID);

    fireEvent.click(screen.getByRole("button", { name: /All test cases/ }));
    expect(onSelectSuite).toHaveBeenLastCalledWith(null);
  });

  it("expands a suite to reveal the cases it holds", async () => {
    mockApi(({ url, method }) => {
      if (url === "/api/projects/checkout" && method === "GET") {
        return jsonResponse(200, PROJECT);
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    renderTree();
    const login = await screen.findByRole("button", { name: /Login/ });

    expect(screen.queryByText("Signs in")).not.toBeInTheDocument();

    fireEvent.click(login);
    expect(await screen.findByText("Signs in")).toBeInTheDocument();
    expect(screen.queryByText("Finds a product")).not.toBeInTheDocument();

    fireEvent.click(login);
    await waitFor(() => {
      expect(screen.queryByText("Signs in")).not.toBeInTheDocument();
    });
  });

  it("filters the suites by name and says so when nothing matches", async () => {
    mockApi(({ url, method }) => {
      if (url === "/api/projects/checkout" && method === "GET") {
        return jsonResponse(200, PROJECT);
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    renderTree();
    const input = await screen.findByRole("searchbox", {
      name: "Filter suites",
    });

    fireEvent.change(input, { target: { value: "sea" } });
    expect(screen.queryByRole("button", { name: /Login/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Search/ })).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "nothing" } });
    expect(screen.getByText(/No suites match/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Search/ }),
    ).not.toBeInTheDocument();
  });

  it("says the project has no suites rather than showing an empty filter result", async () => {
    mockApi(({ url, method }) => {
      if (url === "/api/projects/checkout" && method === "GET") {
        return jsonResponse(200, { projectId: "checkout", name: "Checkout" });
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    renderTree();
    expect(
      await screen.findByText("No suites in this project"),
    ).toBeInTheDocument();
  });

  it("shows the API error envelope when the project cannot be read", async () => {
    mockApi(({ url, method }) => {
      if (url === "/api/projects/checkout" && method === "GET") {
        return errorEnvelope(404, "not_found", "project not found");
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    renderTree();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("not_found");
    expect(alert).toHaveTextContent("project not found");
  });

  it("creates a suite, refreshes the tree and selects it", async () => {
    let reads = 0;
    const requests = mockApi(({ url, method }) => {
      if (url === "/api/projects/checkout" && method === "GET") {
        reads += 1;
        return jsonResponse(
          200,
          reads === 1
            ? PROJECT
            : {
                ...PROJECT,
                testSuites: [
                  ...PROJECT.testSuites,
                  { suiteId: "suite-new", name: "Checkout flow" },
                ],
              },
        );
      }
      if (url === "/api/projects/checkout/test_suites" && method === "POST") {
        return jsonResponse(201, { message: "Suite created", id: "suite-new" });
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    const { onSelectSuite } = renderTree();
    await screen.findByRole("button", { name: /Login/ });

    fireEvent.click(screen.getByRole("button", { name: "New suite" }));
    const dialog = await screen.findByRole("dialog", { name: "New suite" });
    const form = within(dialog).getByRole("form", {
      name: "Create suite form",
    });
    fireEvent.change(within(dialog).getByLabelText("Name"), {
      target: { value: "Checkout flow" },
    });
    fireEvent.change(within(dialog).getByLabelText("Description"), {
      target: { value: "Pays for the cart" },
    });
    fireEvent.change(within(dialog).getByLabelText("Tags"), {
      target: { value: "web, smoke, web" },
    });
    fireEvent.submit(form);

    expect(
      await screen.findByRole("button", { name: /Checkout flow/ }),
    ).toBeInTheDocument();

    const posts = requests.filter((request) => request.method === "POST");
    expect(posts).toHaveLength(1);
    expect(posts[0]?.url).toBe("/api/projects/checkout/test_suites");
    expect(posts[0]?.body).toEqual({
      name: "Checkout flow",
      description: "Pays for the cart",
      tags: ["web", "smoke"],
    });
    expect(onSelectSuite).toHaveBeenLastCalledWith("suite-new");
    expect(screen.getByTestId("announcement")).toHaveTextContent(
      "Suite created",
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("omits a description and tags the user left empty", async () => {
    const requests = mockApi(({ url, method }) => {
      if (url === "/api/projects/checkout" && method === "GET") {
        return jsonResponse(200, PROJECT);
      }
      if (url === "/api/projects/checkout/test_suites" && method === "POST") {
        return jsonResponse(201, {
          message: "Suite created",
          id: "suite-bare",
        });
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    renderTree();
    await screen.findByRole("button", { name: /Login/ });

    fireEvent.click(screen.getByRole("button", { name: "New suite" }));
    const dialog = await screen.findByRole("dialog", { name: "New suite" });
    fireEvent.change(within(dialog).getByLabelText("Name"), {
      target: { value: "Bare" },
    });
    fireEvent.submit(
      within(dialog).getByRole("form", { name: "Create suite form" }),
    );

    await waitFor(() => {
      expect(
        requests.filter((request) => request.method === "POST"),
      ).toHaveLength(1);
    });
    const [post] = requests.filter((request) => request.method === "POST");
    expect(post?.body).toEqual({ name: "Bare" });
  });

  it("shows the API error envelope and keeps the dialog open when creation is rejected", async () => {
    mockApi(({ url, method }) => {
      if (url === "/api/projects/checkout" && method === "GET") {
        return jsonResponse(200, PROJECT);
      }
      if (url === "/api/projects/checkout/test_suites" && method === "POST") {
        return errorEnvelope(409, "conflict", "suite already exists");
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    renderTree();
    await screen.findByRole("button", { name: /Login/ });

    fireEvent.click(screen.getByRole("button", { name: "New suite" }));
    const dialog = await screen.findByRole("dialog", { name: "New suite" });
    fireEvent.change(within(dialog).getByLabelText("Name"), {
      target: { value: "Login" },
    });
    fireEvent.submit(
      within(dialog).getByRole("form", { name: "Create suite form" }),
    );

    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent("conflict");
    expect(alert).toHaveTextContent("suite already exists");
    expect(
      screen.getByRole("dialog", { name: "New suite" }),
    ).toBeInTheDocument();
  });

  it("has no accessibility violations with the create form open", async () => {
    mockApi(({ url, method }) => {
      if (url === "/api/projects/checkout" && method === "GET") {
        return jsonResponse(200, PROJECT);
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    const { baseElement } = renderTree();
    await screen.findByRole("button", { name: /Login/ });

    fireEvent.click(screen.getByRole("button", { name: "New suite" }));
    await screen.findByRole("dialog", { name: "New suite" });

    const { default: axe } = await import("axe-core");
    const results = await axe.run(baseElement, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });

  it("has no accessibility violations", async () => {
    mockApi(({ url, method }) => {
      if (url === "/api/projects/checkout" && method === "GET") {
        return jsonResponse(200, PROJECT);
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    const { baseElement } = renderTree("suite-login");
    fireEvent.click(await screen.findByRole("button", { name: /Login/ }));
    await screen.findByText("Signs in");

    const { default: axe } = await import("axe-core");
    const results = await axe.run(baseElement);
    expect(results.violations).toEqual([]);
  });
});
