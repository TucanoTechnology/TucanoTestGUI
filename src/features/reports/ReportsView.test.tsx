import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AuthProvider } from "../../app/AuthProvider.js";
import {
  errorEnvelope,
  jsonResponse,
  mockApi,
  resetTestApi,
  type RecordedRequest,
} from "../../test-utils.js";
import { ReportsView } from "./ReportsView.js";

const PROJECT = { projectId: "checkout.json", name: "Checkout" };
const CONFIGURATION = { configId: "chrome", name: "Chrome on desktop" };

const COVERAGE = {
  totalCases: 4,
  suites: [
    { suiteId: "smoke.checkout.json", name: "smoke.checkout", caseCount: 3 },
    { suiteId: "smoke.checkout-copy.json", name: "smoke.checkout", caseCount: 0 },
  ],
};

const SUMMARY = {
  total: 6,
  passed: 2,
  failed: 2,
  blocked: 1,
  untested: 0,
  passPercentage: 33.33333333333333,
  totalDurationMs: 2000,
};

const SCOPED_COVERAGE = {
  projectId: PROJECT.projectId,
  totalCases: 2,
  suites: [
    { suiteId: "smoke.checkout.json", name: "smoke.checkout", caseCount: 2 },
  ],
};

const SCOPED_SUMMARY = {
  total: 3,
  passed: 3,
  failed: 0,
  blocked: 0,
  untested: 0,
  passPercentage: 100,
  totalDurationMs: 600,
};

function renderView() {
  return render(
    <AuthProvider>
      {/* The shell mounts this view in the centre pane, which is a landmark. */}
      <main aria-label="Reports">
        <ReportsView />
      </main>
    </AuthProvider>,
  );
}

/** The endpoints the filter options load from, shared by every case. */
function respondOptions(url: string, method: string): Response | null {
  if (method !== "GET") return null;
  if (url === "/api/projects") return jsonResponse(200, [PROJECT.projectId]);
  if (url === `/api/projects/${PROJECT.projectId}`) {
    return jsonResponse(200, PROJECT);
  }
  if (url === `/api/projects/${PROJECT.projectId}/configurations`) {
    return jsonResponse(200, [CONFIGURATION.configId]);
  }
  if (url === `/api/configurations/${CONFIGURATION.configId}`) {
    return jsonResponse(200, CONFIGURATION);
  }
  return null;
}

function reportUrls(
  requests: RecordedRequest[],
  report: "coverage" | "summary",
): string[] {
  return requests
    .filter((request) => request.url.startsWith(`/api/reports/${report}`))
    .map((request) => request.url);
}

/** The stat a report renders for `label`, value and all. */
function statValue(container: HTMLElement, label: string): HTMLElement {
  const term = within(container).getByText(label);
  const stat = term.closest(".report__stat");
  if (!stat) throw new Error(`No stat row for ${label}`);
  return stat as HTMLElement;
}

function coverageRegion(): Promise<HTMLElement> {
  return screen.findByRole("region", { name: "Coverage" });
}

function summaryRegion(): Promise<HTMLElement> {
  return screen.findByRole("region", { name: "Summary" });
}

afterEach(() => {
  resetTestApi();
});

describe("ReportsView", () => {
  it("renders the coverage and summary reports for every project", async () => {
    const requests = mockApi((request) => {
      const options = respondOptions(request.url, request.method);
      if (options) return options;
      if (request.url.startsWith("/api/reports/coverage")) {
        return jsonResponse(200, COVERAGE);
      }
      if (request.url.startsWith("/api/reports/summary")) {
        return jsonResponse(200, SUMMARY);
      }
      throw new Error(`Unexpected request: ${request.method} ${request.url}`);
    });

    renderView();

    const coverage = await coverageRegion();
    const summary = await summaryRegion();

    expect(
      within(coverage).getByText("Cases held by every project"),
    ).toBeInTheDocument();
    expect(statValue(coverage, "Total cases")).toHaveTextContent("4");

    const table = within(coverage).getByRole("table", {
      name: "Cases per suite",
    });
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    // Both suites are named `smoke.checkout`, so the identifier is what tells
    // the two rows apart.
    expect(
      within(table).getAllByRole("rowheader", { name: "smoke.checkout" }),
    ).toHaveLength(2);
    expect(
      within(table).getByRole("cell", { name: "smoke.checkout.json" }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("cell", { name: "smoke.checkout-copy.json" }),
    ).toBeInTheDocument();
    expect(
      within(coverage).getByText(/belongs to no suite/),
    ).toBeInTheDocument();

    expect(statValue(summary, "Total results")).toHaveTextContent("6");
    expect(statValue(summary, "Passed")).toHaveTextContent("2");
    expect(statValue(summary, "Failed")).toHaveTextContent("2");
    expect(statValue(summary, "Blocked")).toHaveTextContent("1");
    expect(statValue(summary, "Untested")).toHaveTextContent("0");
    expect(statValue(summary, "Pass rate")).toHaveTextContent("33.3%");
    expect(statValue(summary, "Total duration")).toHaveTextContent("2.0 s");

    // Neither report was scoped, so neither request carried a filter.
    expect(reportUrls(requests, "coverage")).toEqual(["/api/reports/coverage"]);
    expect(reportUrls(requests, "summary")).toEqual(["/api/reports/summary"]);
  });

  it("re-scopes both reports when the project filter changes", async () => {
    const requests = mockApi((request) => {
      const options = respondOptions(request.url, request.method);
      if (options) return options;
      if (request.url === "/api/reports/coverage") {
        return jsonResponse(200, COVERAGE);
      }
      if (request.url === `/api/reports/coverage?projectId=${PROJECT.projectId}`) {
        return jsonResponse(200, SCOPED_COVERAGE);
      }
      if (request.url === "/api/reports/summary") {
        return jsonResponse(200, SUMMARY);
      }
      if (request.url === `/api/reports/summary?projectId=${PROJECT.projectId}`) {
        return jsonResponse(200, SCOPED_SUMMARY);
      }
      throw new Error(`Unexpected request: ${request.method} ${request.url}`);
    });

    renderView();
    const coverage = await coverageRegion();
    const summary = await summaryRegion();

    fireEvent.change(screen.getByLabelText("Project"), {
      target: { value: PROJECT.projectId },
    });

    expect(
      await within(coverage).findByText("Cases held by checkout.json"),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(statValue(coverage, "Total cases")).toHaveTextContent("2");
      expect(statValue(summary, "Total results")).toHaveTextContent("3");
      expect(statValue(summary, "Pass rate")).toHaveTextContent("100.0%");
      expect(statValue(summary, "Total duration")).toHaveTextContent("600 ms");
    });

    expect(reportUrls(requests, "coverage")).toEqual([
      "/api/reports/coverage",
      "/api/reports/coverage?projectId=checkout.json",
    ]);
    expect(reportUrls(requests, "summary")).toEqual([
      "/api/reports/summary",
      "/api/reports/summary?projectId=checkout.json",
    ]);
  });

  it("narrows the summary report to a configuration and leaves coverage alone", async () => {
    const requests = mockApi((request) => {
      const options = respondOptions(request.url, request.method);
      if (options) return options;
      if (request.url === "/api/reports/coverage") {
        return jsonResponse(200, COVERAGE);
      }
      if (request.url === `/api/reports/coverage?projectId=${PROJECT.projectId}`) {
        return jsonResponse(200, SCOPED_COVERAGE);
      }
      if (request.url === "/api/reports/summary") {
        return jsonResponse(200, SUMMARY);
      }
      if (request.url === `/api/reports/summary?projectId=${PROJECT.projectId}`) {
        return jsonResponse(200, SUMMARY);
      }
      if (
        request.url ===
        `/api/reports/summary?projectId=${PROJECT.projectId}&configurationId=${CONFIGURATION.configId}`
      ) {
        return jsonResponse(200, SCOPED_SUMMARY);
      }
      throw new Error(`Unexpected request: ${request.method} ${request.url}`);
    });

    renderView();
    await coverageRegion();
    const summary = await summaryRegion();

    fireEvent.change(screen.getByLabelText("Project"), {
      target: { value: PROJECT.projectId },
    });

    const configuration = screen.getByLabelText("Configuration");
    await waitFor(() => expect(configuration).toBeEnabled());
    await within(configuration).findByRole("option", {
      name: CONFIGURATION.name,
    });

    fireEvent.change(configuration, {
      target: { value: CONFIGURATION.configId },
    });

    await waitFor(() => {
      expect(statValue(summary, "Total results")).toHaveTextContent("3");
      expect(statValue(summary, "Pass rate")).toHaveTextContent("100.0%");
    });

    expect(reportUrls(requests, "coverage")).toEqual([
      "/api/reports/coverage",
      `/api/reports/coverage?projectId=${PROJECT.projectId}`,
    ]);
    expect(reportUrls(requests, "summary")).toEqual([
      "/api/reports/summary",
      `/api/reports/summary?projectId=${PROJECT.projectId}`,
      `/api/reports/summary?projectId=${PROJECT.projectId}&configurationId=chrome`,
    ]);
  });

  it("offers no configuration until a project is chosen", async () => {
    mockApi((request) => {
      const options = respondOptions(request.url, request.method);
      if (options) return options;
      if (request.url.startsWith("/api/reports/coverage")) {
        return jsonResponse(200, COVERAGE);
      }
      if (request.url.startsWith("/api/reports/summary")) {
        return jsonResponse(200, SUMMARY);
      }
      throw new Error(`Unexpected request: ${request.method} ${request.url}`);
    });

    renderView();
    await summaryRegion();

    const configuration = screen.getByLabelText("Configuration");
    expect(configuration).toBeDisabled();
    expect(configuration).toHaveAttribute(
      "aria-describedby",
      "report-configuration-hint",
    );

    const hint = screen.getByText("Choose a project to filter by configuration.");
    expect(hint).toHaveAttribute("id", "report-configuration-hint");

    fireEvent.change(screen.getByLabelText("Project"), {
      target: { value: PROJECT.projectId },
    });

    await waitFor(() => expect(configuration).toBeEnabled());
    expect(
      screen.getByText("Narrows the summary report to the runs that reference it."),
    ).toBeInTheDocument();
  });

  it("drops the chosen configuration when the project changes", async () => {
    mockApi((request) => {
      const options = respondOptions(request.url, request.method);
      if (options) return options;
      if (request.url.startsWith("/api/reports/coverage")) {
        return jsonResponse(200, COVERAGE);
      }
      if (request.url.startsWith("/api/reports/summary")) {
        return jsonResponse(200, SUMMARY);
      }
      throw new Error(`Unexpected request: ${request.method} ${request.url}`);
    });

    renderView();
    await summaryRegion();

    const project = screen.getByLabelText("Project");
    const configuration = screen.getByLabelText("Configuration");

    fireEvent.change(project, { target: { value: PROJECT.projectId } });
    await waitFor(() => expect(configuration).toBeEnabled());
    await within(configuration).findByRole("option", {
      name: CONFIGURATION.name,
    });

    fireEvent.change(configuration, {
      target: { value: CONFIGURATION.configId },
    });
    expect(configuration).toHaveValue(CONFIGURATION.configId);

    fireEvent.change(project, { target: { value: "" } });

    await waitFor(() => {
      expect(configuration).toHaveValue("");
      expect(configuration).toBeDisabled();
      expect(
        screen.queryByRole("option", { name: CONFIGURATION.name }),
      ).not.toBeInTheDocument();
    });
  });

  it("shows the API error envelope of the report that failed", async () => {
    mockApi((request) => {
      const options = respondOptions(request.url, request.method);
      if (options) return options;
      if (request.url.startsWith("/api/reports/coverage")) {
        return jsonResponse(200, COVERAGE);
      }
      if (request.url.startsWith("/api/reports/summary")) {
        return errorEnvelope(
          403,
          "forbidden",
          "This account needs the viewer role in the project",
        );
      }
      throw new Error(`Unexpected request: ${request.method} ${request.url}`);
    });

    renderView();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("forbidden");
    expect(alert).toHaveTextContent(
      "This account needs the viewer role in the project",
    );

    // One report failing does not take the other down with it.
    const coverage = await coverageRegion();
    expect(statValue(coverage, "Total cases")).toHaveTextContent("4");
  });

  it("reports an empty scope rather than an empty table", async () => {
    mockApi((request) => {
      const options = respondOptions(request.url, request.method);
      if (options) return options;
      if (request.url.startsWith("/api/reports/coverage")) {
        return jsonResponse(200, { totalCases: 0, suites: [] });
      }
      if (request.url.startsWith("/api/reports/summary")) {
        return jsonResponse(200, {
          total: 0,
          passed: 0,
          failed: 0,
          blocked: 0,
          untested: 0,
          passPercentage: 0,
          totalDurationMs: 0,
        });
      }
      throw new Error(`Unexpected request: ${request.method} ${request.url}`);
    });

    renderView();

    const coverage = await coverageRegion();
    expect(
      within(coverage).getByText("No suite holds a case in this scope."),
    ).toBeInTheDocument();
    expect(within(coverage).queryByRole("table")).not.toBeInTheDocument();
    expect(statValue(coverage, "Total cases")).toHaveTextContent("0");

    const summary = await summaryRegion();
    expect(statValue(summary, "Total results")).toHaveTextContent("0");
    expect(statValue(summary, "Pass rate")).toHaveTextContent("0.0%");
    expect(statValue(summary, "Total duration")).toHaveTextContent("0 ms");
  });

  it("announces that each report is loading", () => {
    mockApi(() => new Promise<Response>(() => {}));

    renderView();

    expect(screen.getAllByRole("status")).toHaveLength(2);
    expect(screen.getByText("Loading the coverage report…")).toBeInTheDocument();
    expect(screen.getByText("Loading the summary report…")).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    mockApi((request) => {
      const options = respondOptions(request.url, request.method);
      if (options) return options;
      if (request.url.startsWith("/api/reports/coverage")) {
        return jsonResponse(200, COVERAGE);
      }
      if (request.url.startsWith("/api/reports/summary")) {
        return jsonResponse(200, SUMMARY);
      }
      throw new Error(`Unexpected request: ${request.method} ${request.url}`);
    });

    const { baseElement } = renderView();
    await summaryRegion();

    const { default: axe } = await import("axe-core");
    const results = await axe.run(baseElement, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });
});
