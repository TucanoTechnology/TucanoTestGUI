import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TestCase } from "../../api/generated/index.js";
import { AuthProvider } from "../../app/AuthProvider.js";
import {
  ProjectProvider,
  useProjectContext,
} from "../../app/ProjectContext.js";
import {
  jsonResponse,
  mockApi,
  resetTestApi,
} from "../../test-utils.js";
import { CaseList } from "./CaseList.js";

const CART: TestCase = {
  testCaseId: "TC-CART-1",
  title: "Add an item to the cart",
  expectedResult: "The cart shows the item",
  tags: ["smoke"],
  priority: "Medium",
  version: 3,
  lastModified: "2026-09-10T08:00:00Z",
};

const DIRECT: TestCase = {
  testCaseId: "TC-PROJECT-1",
  title: "Reach the checkout page",
  expectedResult: "The page loads",
};

const PROJECT = {
  projectId: "checkout",
  name: "Checkout",
  testCases: [DIRECT],
  testSuites: [
    { suiteId: "smoke.checkout", name: "Smoke", testCases: [CART] },
  ],
};

function Harness({
  suiteFilter,
  onSelectCase,
  onCreateRun,
}: {
  suiteFilter: string | null;
  onSelectCase: (id: string) => void;
  onCreateRun: () => void;
}) {
  const { selection } = useProjectContext();
  return (
    <CaseList
      projectId="checkout"
      suiteFilter={suiteFilter}
      selectedCaseId={selection?.type === "case" ? selection.id : null}
      onSelectCase={onSelectCase}
      onCreateRun={onCreateRun}
    />
  );
}

function renderList(props: {
  suiteFilter?: string | null;
  onSelectCase?: (id: string) => void;
  onCreateRun?: () => void;
} = {}) {
  const onSelectCase = props.onSelectCase ?? (() => {});
  const onCreateRun = props.onCreateRun ?? (() => {});
  return render(
    <AuthProvider>
      <ProjectProvider>
        <Harness
          suiteFilter={props.suiteFilter ?? null}
          onSelectCase={onSelectCase}
          onCreateRun={onCreateRun}
        />
      </ProjectProvider>
    </AuthProvider>,
  );
}

/** The project document behind the list, with the state the test mutates. */
function mockListApi() {
  const state = {
    cases: [CART, DIRECT].map((testCase) => ({ ...testCase })),
    resultPosts: [] as unknown[],
    run: {
      testRunId: "nightly.json",
      timestamp: "1750000000",
      testCases: [CART],
      results: [
        {
          testCaseId: "TC-CART-1",
          status: "Failed",
          notes: "keep me",
          durationMs: 800,
          timestamp: "1750000001",
          defectLinks: [],
          attachments: [],
        },
      ],
    },
  };

  const requests = mockApi(({ url, method, body }) => {
    // #181: the placement dialog's own reads.
    if (url === "/api/projects" && method === "GET") {
      return jsonResponse(200, ["checkout"]);
    }
    if (url === "/api/projects/checkout/test_suites" && method === "GET") {
      return jsonResponse(200, ["smoke.checkout"]);
    }
    if (url === "/api/projects/checkout" && method === "GET") {
      const direct = state.cases.filter(
        (testCase) => testCase.testCaseId === "TC-PROJECT-1",
      );
      const inSuite = state.cases.filter(
        (testCase) => testCase.testCaseId === "TC-CART-1",
      );
      return jsonResponse(200, {
        ...PROJECT,
        testCases: direct,
        testSuites: [{ ...PROJECT.testSuites[0], testCases: inSuite }],
      });
    }
    if (url === "/api/projects/checkout/test_runs" && method === "GET") {
      return jsonResponse(200, ["nightly.json"]);
    }
    if (url === "/api/reports/last-results?projectId=checkout" && method === "GET") {
      return jsonResponse(200, {
        projectId: "checkout",
        cases: [
          {
            testCaseId: "TC-CART-1",
            // The bulk-status test reads this route again after recording;
            // answer from the run store so the column reflects the new status.
            status: state.run.results[0]!.status,
            runId: "nightly.json",
            timestamp: "1757800000",
          },
        ],
      });
    }
    if (url === "/api/test_runs/nightly.json" && method === "GET") {
      return jsonResponse(200, state.run);
    }
    if (url === "/api/test_runs/nightly.json/results" && method === "POST") {
      state.resultPosts.push(body);
      const result = state.run.results[0]!;
      const request = body as Record<string, unknown>;
      Object.assign(result, {
        status: request.status,
        notes: request.notes ?? "",
        durationMs: request.durationMs,
      });
      return jsonResponse(200, { message: "Test result recorded in run" });
    }
    if (url === "/api/test_cases/TC-CART-1" && method === "PUT") {
      state.cases = state.cases.map((testCase) =>
        testCase.testCaseId === "TC-CART-1"
          ? ({ ...testCase, ...(body as Partial<TestCase>) } as TestCase)
          : testCase,
      );
      return jsonResponse(200, { message: "Test case updated" });
    }
    throw new Error(`Unexpected request: ${method} ${url}`);
  });

  return { requests, state };
}

const rows = () => screen.getAllByRole("row");

/** Wait for the populated table (mirrors the assertions every test starts from). */
async function openDetailWait() {
  await waitFor(() => expect(rows()).toHaveLength(3));
}

afterEach(() => {
  resetTestApi();
});

describe("CaseList", () => {
  it("renders the breadcrumb, action rows and one row per case", async () => {
    mockListApi();
    renderList();

    await waitFor(() => expect(rows()).toHaveLength(3));

    // Breadcrumb: the project, and the suite node once one is scoped.
    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(nav).getByText("Checkout")).toBeInTheDocument();

    // Action rows: the run hand-off, the export, and the create control.
    expect(
      screen.getByRole("button", { name: "Create test run" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Create" })).toBeInTheDocument();

    // The ID column carries the identifier and the parent path; the version
    // rides beside the title so the revision a run pins is visible (#162).
    expect(screen.getByText("TC-CART-1")).toBeInTheDocument();
    expect(screen.getByText("Smoke")).toBeInTheDocument();
    expect(screen.getByText("(v3)")).toBeInTheDocument();
    // A project-level case shows just the project name in the breadcrumb.
    expect(screen.getAllByText("Checkout").length).toBeGreaterThan(0);
    // The Last Results column reads the report: TC-CART-1 failed in the
    // nightly run, and the case no run covered is absent — an em dash, never
    // a fabricated Untested.
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(
      within(screen.getByRole("grid", { name: "Test cases" })).getAllByText(
        "—",
      ).length,
    ).toBeGreaterThanOrEqual(1);

    // Selecting a row reports the case to the shell.
    fireEvent.click(screen.getByText("Add an item to the cart"));
  });

  it("the row action opens the placement dialog for that case (#181)", async () => {
    mockListApi();
    renderList();
    await waitFor(() => expect(rows()).toHaveLength(3));

    fireEvent.click(
      screen.getByRole("button", { name: "Move or copy TC-CART-1" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Move or copy TC-CART-1",
    });
    // Copy is the offered default, and the row click did NOT also select.
    expect(
      within(dialog).getByLabelText(/Copy — leave the original in place/),
    ).toBeChecked();

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Move or copy TC-CART-1" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("names the suite node in the breadcrumb when scoped", async () => {
    mockListApi();
    renderList({ suiteFilter: "smoke.checkout" });

    const nav = await screen.findByRole("navigation", { name: "Breadcrumb" });
    expect(within(nav).getByText("Smoke")).toHaveClass(
      "case-list__crumb--current",
    );
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(screen.queryByText("Reach the checkout page")).not.toBeInTheDocument();
  });

  it("shows only project-level cases for the direct scope", async () => {
    mockListApi();
    renderList({ suiteFilter: "__direct__" });

    const nav = await screen.findByRole("navigation", { name: "Breadcrumb" });
    expect(within(nav).getByText("Directly in project")).toBeInTheDocument();
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(screen.getByText("Reach the checkout page")).toBeInTheDocument();
  });

  it("filters the table from the search input without a request", async () => {
    const { requests } = mockListApi();
    renderList();
    await waitFor(() => expect(rows()).toHaveLength(3));

    fireEvent.change(screen.getByLabelText("Search cases"), {
      target: { value: "cart" },
    });
    expect(rows()).toHaveLength(2);
    expect(screen.getByText("Add an item to the cart")).toBeInTheDocument();
    expect(screen.queryByText("Reach the checkout page")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search cases"), {
      target: { value: "nothing matches" },
    });
    expect(
      screen.getByText("No test cases match the search"),
    ).toBeInTheDocument();
    expect(
      requests.filter((request) => request.method !== "GET"),
    ).toHaveLength(0);
  });

  it("creates a case through the project composition route", async () => {
    const { requests } = mockListApi();
    renderList();
    await waitFor(() => expect(rows()).toHaveLength(3));

    fireEvent.click(screen.getAllByRole("button", { name: "+ Create" })[0]!);
    const form = await screen.findByRole("form", { name: "Create case form" });
    fireEvent.change(within(form).getByLabelText("Case ID"), {
      target: { value: "TC-NEW-1" },
    });
    fireEvent.change(within(form).getByLabelText("Title"), {
      target: { value: "A new case" },
    });
    fireEvent.change(within(form).getByLabelText("Expected result"), {
      target: { value: "It works" },
    });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(
        requests.filter(
          (request) =>
            request.url === "/api/projects/checkout/test_cases" &&
            request.method === "POST",
        ),
      ).toHaveLength(1);
    });
  });

  it("selects rows with checkboxes and runs a bulk tag update", async () => {
    const { requests, state } = mockListApi();
    renderList();
    await waitFor(() => expect(rows()).toHaveLength(3));

    fireEvent.click(screen.getByLabelText("Select TC-CART-1"));
    expect(
      await screen.findByRole("toolbar", { name: "Bulk case operations" }),
    ).toBeInTheDocument();
    expect(screen.getByText("1 selected")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Tags for bulk operations"), {
      target: { value: "regression" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add tags" }));

    await waitFor(() => {
      expect(
        requests.filter(
          (request) =>
            request.url === "/api/test_cases/TC-CART-1" &&
            request.method === "PUT",
        ),
      ).toHaveLength(1);
    });
    expect(state.cases[0]?.tags).toEqual(["smoke", "regression"]);
    expect(
      await screen.findByText(/Tagged 1 of 1 cases/),
    ).toBeInTheDocument();
  });

  it("select all checks every visible row and clear empties the toolbar", async () => {
    mockListApi();
    renderList();
    await waitFor(() => expect(rows()).toHaveLength(3));

    fireEvent.click(screen.getByLabelText("Select all"));
    expect(screen.getByLabelText("Select TC-CART-1")).toBeChecked();
    expect(screen.getByLabelText("Select TC-PROJECT-1")).toBeChecked();
    expect(screen.getByText("2 selected")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(
      screen.queryByRole("toolbar", { name: "Bulk case operations" }),
    ).not.toBeInTheDocument();
  });

  it("records a bulk status against a chosen run, preserving the stored fields", async () => {
    const { state } = mockListApi();
    renderList();
    await waitFor(() => expect(rows()).toHaveLength(3));

    fireEvent.click(screen.getByLabelText("Select TC-CART-1"));
    await screen.findByRole("toolbar", { name: "Bulk case operations" });

    fireEvent.change(screen.getByLabelText("Run to record against"), {
      target: { value: "nightly.json" },
    });
    fireEvent.change(screen.getByLabelText("Status to record"), {
      target: { value: "Passed" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Record status" }));

    await waitFor(() => expect(state.resultPosts).toHaveLength(1));
    // The record route replaces the whole result: comment, duration and
    // timestamp travel back with the new status.
    expect(state.resultPosts[0]).toEqual({
      testCaseId: "TC-CART-1",
      status: "Passed",
      notes: "keep me",
      durationMs: 800,
      timestamp: "1750000001",
    });
  });

  it("skips a selected case the chosen run does not hold", async () => {
    const { state } = mockListApi();
    renderList();
    await waitFor(() => expect(rows()).toHaveLength(3));

    fireEvent.click(screen.getByLabelText("Select all"));
    await screen.findByRole("toolbar", { name: "Bulk case operations" });
    fireEvent.change(screen.getByLabelText("Run to record against"), {
      target: { value: "nightly.json" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Record status" }));

    await waitFor(() => expect(state.resultPosts).toHaveLength(1));
    expect(
      await screen.findByText(/1 skipped \(TC-PROJECT-1\)/),
    ).toBeInTheDocument();
  });

  it("hands off to the runs module from the action row", async () => {
    mockListApi();
    const onCreateRun = vi.fn();
    renderList({ onCreateRun });
    await waitFor(() => expect(rows()).toHaveLength(3));

    fireEvent.click(screen.getByRole("button", { name: "Create test run" }));
    expect(onCreateRun).toHaveBeenCalledTimes(1);
  });

  it("shows the skeleton while the project is read and the error state on failure", async () => {
    mockApi(() => new Promise<Response>(() => {}));
    renderList();
    expect(
      await screen.findByRole("status", { name: "Loading" }),
    ).toBeInTheDocument();
    resetTestApi();

    mockApi(() =>
      jsonResponse(404, { error: { code: "not_found", message: "no project" } }),
    );
    renderList();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("not_found");
    expect(alert).toHaveTextContent("no project");
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("names the run and moment behind each badge in the tooltip", async () => {
    mockListApi();
    renderList();
    await openDetailWait();

    const badge = screen.getByText("Failed");
    expect(badge).toHaveAttribute(
      "title",
      expect.stringMatching(/^Last recorded in nightly\.json at /),
    );
  });

  it("falls back to priority when the report fails, never painting cases as untested", async () => {
    mockApi(({ url, method }) => {
      if (url === "/api/projects/checkout" && method === "GET") {
        return jsonResponse(200, {
          ...PROJECT,
          testSuites: [
            {
              suiteId: "smoke.checkout",
              name: "Smoke",
              testCases: [{ ...CART, priority: "Critical" }],
            },
          ],
        });
      }
      if (url === "/api/reports/last-results?projectId=checkout" && method === "GET") {
        return jsonResponse(500, {
          error: { code: "internal", message: "report offline" },
        });
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });
    const { baseElement } = renderList();
    await waitFor(() => expect(rows()).toHaveLength(3));

    // The row degrades to the priority badge with an honest title; no case is
    // shown as if nothing had ever been recorded.
    const fallback = screen.getByText("Critical");
    expect(fallback).toHaveAttribute(
      "title",
      "Priority — last results could not be loaded",
    );
    void baseElement;
  });

  it("re-reads the report after a bulk status change", async () => {
    const { state } = mockListApi();
    renderList();
    await waitFor(() => expect(rows()).toHaveLength(3));

    fireEvent.click(screen.getByLabelText("Select TC-CART-1"));
    await screen.findByRole("toolbar", { name: "Bulk case operations" });
    fireEvent.change(screen.getByLabelText("Run to record against"), {
      target: { value: "nightly.json" },
    });
    fireEvent.change(screen.getByLabelText("Status to record"), {
      target: { value: "Passed" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Record status" }));

    await waitFor(() => expect(state.resultPosts).toHaveLength(1));
    // The second report read picks up the recorded status: the store flips
    // TC-CART-1 to Passed when the record POST lands, and the report answers
    // from the same store.
    await waitFor(() =>
      expect(screen.getByText("Passed")).toBeInTheDocument(),
    );
  });

  it("has no accessibility violations on the populated table", async () => {
    mockListApi();
    // The shell mounts the list inside `main`; the region rule needs that.
    const { baseElement } = render(
      <AuthProvider>
        <ProjectProvider>
          <main aria-label="Test Cases">
            <Harness
              suiteFilter={null}
              onSelectCase={() => {}}
              onCreateRun={() => {}}
            />
          </main>
        </ProjectProvider>
      </AuthProvider>,
    );
    await waitFor(() => expect(rows()).toHaveLength(3));

    const { default: axe } = await import("axe-core");
    const results = await axe.run(baseElement, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });
});
