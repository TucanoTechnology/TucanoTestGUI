import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AuthProvider } from "../../app/AuthProvider.js";
import {
  errorEnvelope,
  jsonResponse,
  mockApi,
  resetTestApi,
} from "../../test-utils.js";
import { CaseDetail } from "./CaseDetail.js";

const CASE = {
  testCaseId: "TC-LOGIN-1",
  title: "Sign in with a registered account",
  description: "A registered shopper signs in.",
  preconditions: "The shopper has an account.",
  priority: "Critical",
  severity: "High",
  tags: ["smoke", "auth"],
  steps: [
    {
      action: "Open the sign-in page",
      expectedResult: "The form is shown",
    },
  ],
  expectedResult: "The account page loads",
  attachments: [
    {
      filename: "login.png",
      originalName: "login.png",
      mimeType: "image/png",
      size: 1234,
    },
  ],
};

const PROJECT = {
  projectId: "checkout",
  name: "Checkout",
  testSuites: [
    {
      suiteId: "smoke.checkout",
      name: "Smoke",
      testCases: [CASE],
    },
  ],
};

function renderDetail(props: { caseId: string; projectId?: string }) {
  return render(
    <AuthProvider>
      <nav aria-label="Case detail probe">
        <CaseDetail caseId={props.caseId} projectId={props.projectId} />
      </nav>
    </AuthProvider>,
  );
}

afterEach(() => {
  resetTestApi();
});

describe("CaseDetail", () => {
  it("renders the case document resolved through its project", async () => {
    const requests = mockApi(({ url, method }) => {
      if (url === "/api/projects/checkout" && method === "GET") {
        return jsonResponse(200, PROJECT);
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    const { baseElement } = renderDetail({
      caseId: "TC-LOGIN-1",
      projectId: "checkout",
    });

    await screen.findByRole("heading", {
      name: "Sign in with a registered account",
    });

    expect(screen.getByText("Case ID: TC-LOGIN-1")).toBeInTheDocument();
    expect(screen.getByText("A registered shopper signs in.")).toBeInTheDocument();
    expect(screen.getByText("Critical")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("smoke")).toBeInTheDocument();
    expect(screen.getByText("Open the sign-in page")).toBeInTheDocument();
    expect(screen.getByText("→ The form is shown")).toBeInTheDocument();
    expect(screen.getByText("The account page loads")).toBeInTheDocument();
    expect(screen.getByText("login.png")).toBeInTheDocument();
    expect(screen.getByText("1234 bytes")).toBeInTheDocument();

    expect(requests.map((request) => request.url)).toEqual([
      "/api/projects/checkout",
    ]);

    const { default: axe } = await import("axe-core");
    const results = await axe.run(baseElement, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });

  it("reads the bare case route only when no project is known", async () => {
    const requests = mockApi(({ url, method }) => {
      if (url === "/api/test_cases/TC-LOGIN-1" && method === "GET") {
        return jsonResponse(200, CASE);
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    renderDetail({ caseId: "TC-LOGIN-1" });

    await screen.findByRole("heading", {
      name: "Sign in with a registered account",
    });
    expect(requests.map((request) => request.url)).toEqual([
      "/api/test_cases/TC-LOGIN-1",
    ]);
  });

  it("reports a case the project does not carry", async () => {
    mockApi(({ url, method }) => {
      if (url === "/api/projects/checkout" && method === "GET") {
        return jsonResponse(200, PROJECT);
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    renderDetail({ caseId: "TC-MISSING", projectId: "checkout" });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Test case TC-MISSING is not part of project checkout",
    );
  });

  it("shows a loading status while the request is in flight", async () => {
    mockApi(() => new Promise<Response>(() => {}));

    renderDetail({ caseId: "TC-LOGIN-1", projectId: "checkout" });

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("shows the API error envelope", async () => {
    mockApi(({ url, method }) => {
      if (url === "/api/projects/checkout" && method === "GET") {
        return errorEnvelope(403, "forbidden", "insufficient role");
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    renderDetail({ caseId: "TC-LOGIN-1", projectId: "checkout" });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("forbidden");
    expect(alert).toHaveTextContent("insufficient role");
  });
});
