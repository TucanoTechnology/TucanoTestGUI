import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AuthProvider } from "../../app/AuthProvider.js";
import {
  errorEnvelope,
  jsonResponse,
  mockApi,
  resetTestApi,
} from "../../test-utils.js";
import { RunDetail } from "./RunDetail.js";

const RUN = {
  testRunId: "nightly",
  name: "Nightly run",
  timestamp: "1750000000",
  tags: ["nightly"],
  projects: [{ projectId: "checkout", name: "Checkout" }],
  testSuites: [{ suiteId: "smoke.checkout", name: "Checkout smoke" }],
  testCases: [{ testCaseId: "TC-LOGIN-1", title: "Log in" }],
  results: [{ testCaseId: "TC-LOGIN-1", status: "passed" }],
};

function renderDetail(runId = "nightly") {
  return render(
    <AuthProvider>
      <nav aria-label="Run detail probe">
        <RunDetail runId={runId} />
      </nav>
    </AuthProvider>,
  );
}

afterEach(() => {
  resetTestApi();
});

describe("RunDetail", () => {
  it("renders the run document", async () => {
    const requests = mockApi(({ url, method }) => {
      if (url === "/api/test_runs/nightly" && method === "GET") {
        return jsonResponse(200, RUN);
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    const { baseElement } = renderDetail();

    await screen.findByRole("heading", { name: "Nightly run" });
    expect(screen.getByText("Run ID: nightly")).toBeInTheDocument();
    expect(screen.getByText("1750000000")).toBeInTheDocument();
    expect(screen.getByText("nightly")).toBeInTheDocument();
    expect(screen.getByText("Projects (1)")).toBeInTheDocument();
    expect(screen.getByText("Suites (1)")).toBeInTheDocument();
    expect(screen.getByText("Test Cases (1)")).toBeInTheDocument();
    expect(screen.getByText("Results (1)")).toBeInTheDocument();
    expect(screen.getByText("passed")).toBeInTheDocument();

    expect(requests.map((request) => request.url)).toEqual([
      "/api/test_runs/nightly",
    ]);

    const { default: axe } = await import("axe-core");
    const results = await axe.run(baseElement, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });

  it("falls back to the run id when the run carries no name", async () => {
    mockApi(({ url, method }) => {
      if (url === "/api/test_runs/nightly" && method === "GET") {
        return jsonResponse(200, { ...RUN, name: undefined });
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    renderDetail();

    await screen.findByRole("heading", { name: "nightly" });
  });

  it("shows a loading status while the request is in flight", () => {
    mockApi(() => new Promise<Response>(() => {}));

    renderDetail();

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("shows the API error envelope", async () => {
    mockApi(({ url, method }) => {
      if (url === "/api/test_runs/nightly" && method === "GET") {
        return errorEnvelope(409, "conflict", "run id is ambiguous");
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    renderDetail();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("conflict");
    expect(alert).toHaveTextContent("run id is ambiguous");
  });
});
