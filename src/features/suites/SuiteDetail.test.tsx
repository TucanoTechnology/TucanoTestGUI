import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AuthProvider } from "../../app/AuthProvider.js";
import { ProjectProvider, useProjectContext } from "../../app/ProjectContext.js";
import {
  errorEnvelope,
  jsonResponse,
  mockApi,
  resetTestApi,
} from "../../test-utils.js";
import { SuiteDetail } from "./SuiteDetail.js";

const SUITE = {
  suiteId: "smoke.checkout",
  name: "Checkout smoke",
  description: "The checkout happy path.",
  tags: ["smoke"],
  testCases: [
    { testCaseId: "TC-LOGIN-1", title: "Log in", priority: "High" },
  ],
};

function Harness({
  suiteId,
  projectId,
}: {
  suiteId: string;
  projectId?: string;
}) {
  const { selection } = useProjectContext();

  return (
    <nav aria-label="Context probe">
      <span data-testid="selection">
        {selection ? `${selection.type}:${selection.id}` : "none"}
      </span>
      <SuiteDetail suiteId={suiteId} projectId={projectId} />
    </nav>
  );
}

function renderDetail({
  suiteId = "smoke.checkout",
  projectId = "checkout",
}: { suiteId?: string; projectId?: string } = {}) {
  return render(
    <AuthProvider>
      <ProjectProvider>
        <Harness suiteId={suiteId} projectId={projectId} />
      </ProjectProvider>
    </AuthProvider>,
  );
}

afterEach(() => {
  resetTestApi();
});

describe("SuiteDetail", () => {
  it("renders the suite document and selects a case from it", async () => {
    const requests = mockApi(({ url, method }) => {
      if (url === "/api/test_suites/smoke.checkout" && method === "GET") {
        return jsonResponse(200, SUITE);
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    const { baseElement } = renderDetail();

    await screen.findByRole("heading", { name: "Checkout smoke" });
    expect(screen.getByText("Suite ID: smoke.checkout")).toBeInTheDocument();
    expect(screen.getByText("The checkout happy path.")).toBeInTheDocument();
    expect(screen.getByText("smoke")).toBeInTheDocument();
    expect(screen.getByText("Test Cases (1)")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Log in/ }));
    expect(screen.getByTestId("selection")).toHaveTextContent(
      "case:TC-LOGIN-1",
    );

    expect(requests.map((request) => request.url)).toEqual([
      "/api/test_suites/smoke.checkout",
    ]);

    const { default: axe } = await import("axe-core");
    const results = await axe.run(baseElement, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });

  it("shows a loading status while the request is in flight", () => {
    mockApi(() => new Promise<Response>(() => {}));

    renderDetail();

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("shows the API error envelope", async () => {
    mockApi(({ url, method }) => {
      if (url === "/api/test_suites/smoke.checkout" && method === "GET") {
        return errorEnvelope(404, "not_found", "no such suite");
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    renderDetail();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("not_found");
    expect(alert).toHaveTextContent("no such suite");
  });
});
