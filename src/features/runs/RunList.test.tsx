import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  errorEnvelope,
  jsonResponse,
  mockApi,
  resetTestApi,
} from "../../test-utils.js";
import { AuthProvider } from "../../app/AuthProvider.js";
import { ProjectProvider } from "../../app/ProjectContext.js";
import { RunList } from "./RunList.js";

const NIGHTLY = {
  testRunId: "nightly.json",
  name: "Nightly",
  timestamp: "1750000000",
  tags: ["nightly"],
  testCases: [
    { testCaseId: "TC-A", title: "A" },
    { testCaseId: "TC-B", title: "B" },
  ],
  results: [
    {
      testCaseId: "TC-A",
      status: "Passed",
      timestamp: "1750000001",
      defectLinks: [],
      attachments: [],
    },
  ],
  configurations: [{ configId: "chrome.json", name: "Chrome Linux" }],
};

const SMOKE = {
  testRunId: "smoke.json",
  name: "Smoke pass",
  timestamp: "1750100000",
  testCases: [{ testCaseId: "TC-A", title: "A" }],
  results: [
    {
      testCaseId: "TC-A",
      status: "Failed",
      timestamp: "1750100001",
      defectLinks: [],
      attachments: [],
    },
  ],
};

function renderList(onSelectRun: (id: string) => void = () => {}) {
  return render(
    <AuthProvider>
      <ProjectProvider>
        <RunList projectId="checkout" selectedRunId={null} onSelectRun={onSelectRun} />
      </ProjectProvider>
    </AuthProvider>,
  );
}

function mockRunsApi(store = { runs: [NIGHTLY, SMOKE] }) {
  const requests = mockApi(({ url, method }) => {
    if (url === "/api/projects/checkout/test_runs" && method === "GET") {
      return jsonResponse(200, store.runs.map((run) => run.testRunId));
    }
    const match = /^\/api\/test_runs\/(.+)$/.exec(url);
    if (match && method === "GET") {
      const run = store.runs.find((candidate) => candidate.testRunId === match[1]);
      return run ? jsonResponse(200, run) : errorEnvelope(404, "not_found", "no run");
    }
    throw new Error(`Unexpected request: ${method} ${url}`);
  });
  return { requests, store };
}

const rows = () => screen.getAllByRole("row");

afterEach(() => {
  resetTestApi();
});

describe("RunList", () => {
  it("lists runs with formatted dates, status badges and configuration", async () => {
    mockRunsApi();
    renderList();

    await waitFor(() => expect(rows()).toHaveLength(3));
    expect(screen.getByText("Nightly")).toBeInTheDocument();
    expect(screen.getByText("nightly.json")).toBeInTheDocument();
    // The listing key is shown next to the name, and the epoch is formatted.
    expect(
      screen.getByText(
        new Date(1750000000 * 1000).toLocaleString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
      ),
    ).toBeInTheDocument();
    // One passed, one untested (the second case has no result), per the run.
    expect(screen.getByText("1 passed")).toBeInTheDocument();
    expect(screen.getByText("1 untested")).toBeInTheDocument();
    expect(screen.getByText("1 failed")).toBeInTheDocument();
    // The name also appears in the filter select; the cell sits in the table.
    expect(screen.getAllByText("Chrome Linux").length).toBeGreaterThan(1);
  });

  it("selects a run from its row", async () => {
    const picked: string[] = [];
    mockRunsApi();
    renderList((id) => picked.push(id));

    await waitFor(() => expect(rows()).toHaveLength(3));
    fireEvent.click(screen.getByText("Smoke pass"));
    expect(picked).toEqual(["smoke.json"]);
  });

  it("filters by name, configuration and tags", async () => {
    mockRunsApi();
    renderList();
    await waitFor(() => expect(rows()).toHaveLength(3));

    fireEvent.change(screen.getByLabelText("Search runs"), {
      target: { value: "nightly" },
    });
    expect(rows()).toHaveLength(2);

    fireEvent.change(screen.getByLabelText("Search runs"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("Filter by configuration"), {
      target: { value: "chrome.json" },
    });
    expect(rows()).toHaveLength(2);
    expect(screen.queryByText("Smoke pass")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filter by configuration"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("Filter runs by tags"), {
      target: { value: "nightly" },
    });
    expect(rows()).toHaveLength(2);
    expect(screen.getByText("Nightly")).toBeInTheDocument();
    expect(screen.queryByText("Smoke pass")).not.toBeInTheDocument();
  });

  it("states the empty project and offers the create control", async () => {
    mockRunsApi({ runs: [] });
    renderList();

    expect(await screen.findByText("No test runs yet")).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "+ New Run" }).length,
    ).toBeGreaterThan(0);
  });

  it("shows the error state with a retry when the listing fails", async () => {
    mockApi(({ url, method }) => {
      if (url === "/api/projects/checkout/test_runs" && method === "GET") {
        return errorEnvelope(500, "internal", "storage offline");
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });
    renderList();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("storage offline");
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
