import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../../app/AuthProvider.js";
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

function renderTree(selectedSuiteId: string | null = null) {
  const onSelectSuite = vi.fn();
  const view = render(
    <AuthProvider>
      {/* The shell mounts the tree inside its left pane; the landmark is part
          of the pane, not of the tree. */}
      <aside aria-label="Suite tree">
        <SuiteTree
          projectId={PROJECT.projectId}
          selectedSuiteId={selectedSuiteId}
          onSelectSuite={onSelectSuite}
        />
      </aside>
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
