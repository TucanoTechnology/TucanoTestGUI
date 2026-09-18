import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AuthProvider } from "../../app/AuthProvider.js";
import {
  errorEnvelope,
  jsonResponse,
  mockApi,
  resetTestApi,
} from "../../test-utils.js";
import { MilestoneDetail } from "./MilestoneDetail.js";

const MILESTONE = {
  milestoneId: "m1-checkout",
  name: "Checkout GA",
  description: "Everything the checkout flow needs to ship.",
  status: "in_progress",
  startDate: "2026-09-01",
  targetDate: "2026-10-01",
  testSuiteIds: ["smoke.checkout"],
  testRunIds: ["nightly"],
};

const PROGRESS = {
  totalCases: 4,
  passed: 2,
  failed: 1,
  blocked: 1,
};

function renderDetail(milestoneId = "m1-checkout") {
  return render(
    <AuthProvider>
      <nav aria-label="Milestone detail probe">
        <MilestoneDetail milestoneId={milestoneId} projectId="checkout" />
      </nav>
    </AuthProvider>,
  );
}

afterEach(() => {
  resetTestApi();
});

describe("MilestoneDetail", () => {
  it("renders the milestone document and its progress", async () => {
    const requests = mockApi(({ url, method }) => {
      if (url === "/api/milestones/m1-checkout" && method === "GET") {
        return jsonResponse(200, MILESTONE);
      }
      if (url === "/api/milestones/m1-checkout/progress" && method === "GET") {
        return jsonResponse(200, PROGRESS);
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    const { baseElement } = renderDetail();

    await screen.findByRole("heading", { name: "Checkout GA" });
    expect(screen.getByText("Milestone ID: m1-checkout")).toBeInTheDocument();
    expect(
      screen.getByText("Everything the checkout flow needs to ship."),
    ).toBeInTheDocument();
    expect(screen.getByText("in_progress")).toBeInTheDocument();
    expect(screen.getByText("2026-09-01")).toBeInTheDocument();
    expect(screen.getByText("Linked Suites (1)")).toBeInTheDocument();
    expect(screen.getByText("Linked Runs (1)")).toBeInTheDocument();
    expect(
      screen.getByText("4 total — 2 passed, 1 failed, 1 blocked"),
    ).toBeInTheDocument();

    expect(requests.map((request) => request.url).sort()).toEqual([
      "/api/milestones/m1-checkout",
      "/api/milestones/m1-checkout/progress",
    ]);

    const { default: axe } = await import("axe-core");
    const results = await axe.run(baseElement, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });

  it("shows a loading status while the requests are in flight", () => {
    mockApi(() => new Promise<Response>(() => {}));

    renderDetail();

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("shows the API error envelope when the milestone read fails", async () => {
    mockApi(({ url, method }) => {
      if (url === "/api/milestones/m1-checkout" && method === "GET") {
        return errorEnvelope(404, "not_found", "no such milestone");
      }
      if (url === "/api/milestones/m1-checkout/progress" && method === "GET") {
        return jsonResponse(200, PROGRESS);
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    renderDetail();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("not_found");
    expect(alert).toHaveTextContent("no such milestone");
  });

  it("shows the API error envelope when the progress read fails", async () => {
    mockApi(({ url, method }) => {
      if (url === "/api/milestones/m1-checkout" && method === "GET") {
        return jsonResponse(200, MILESTONE);
      }
      if (url === "/api/milestones/m1-checkout/progress" && method === "GET") {
        return errorEnvelope(403, "forbidden", "insufficient role");
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    renderDetail();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("forbidden");
    expect(alert).toHaveTextContent("insufficient role");
  });
});
