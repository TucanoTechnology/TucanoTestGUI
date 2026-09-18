import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { errorEnvelope, jsonResponse, mockApi, resetTestApi } from "../test-utils.js";
import { AuthProvider } from "./AuthProvider.js";
import { EntityList } from "./EntityList.js";
import { ProjectProvider, useProjectContext } from "./ProjectContext.js";

/** The seeded `payments.json`: a suite plus a case several parents hold. */
const PAYMENTS = {
  projectId: "payments",
  name: "Payments",
  description: "Card payments",
  testSuites: [
    {
      suiteId: "smoke",
      name: "Smoke",
      testCases: [
        {
          testCaseId: "TC-LOGIN-1",
          title: "Login succeeds with valid credentials",
        },
      ],
    },
  ],
  testCases: [
    {
      testCaseId: "TC-PROJECT-1",
      title: "Guest checkout creates an order",
    },
  ],
};

function SelectionProbe() {
  const { selection, announcement } = useProjectContext();
  return (
    <>
      <span data-testid="selection">
        {selection ? `${selection.type}:${selection.id}` : "none"}
      </span>
      <span data-testid="announcement">{announcement?.message ?? ""}</span>
    </>
  );
}

function renderCases() {
  sessionStorage.setItem("selectedProjectId", PAYMENTS.projectId);
  return render(
    <AuthProvider>
      <ProjectProvider>
        <EntityList entityType="case" />
        <SelectionProbe />
      </ProjectProvider>
    </AuthProvider>,
  );
}

afterEach(() => {
  resetTestApi();
});

describe("EntityList", () => {
  it("lists the cases a project holds without reading each one by id", async () => {
    const requests = mockApi(({ url, method }) => {
      if (url === "/api/projects/payments" && method === "GET") {
        return jsonResponse(200, PAYMENTS);
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    renderCases();

    const list = await screen.findByRole("list", { name: "case list" });
    expect(within(list).getAllByRole("button")).toHaveLength(2);
    expect(
      within(list).getByRole("button", {
        name: "Guest checkout creates an order",
      }),
    ).toBeInTheDocument();
    expect(
      within(list).getByRole("button", {
        name: "Login succeeds with valid credentials",
      }),
    ).toBeInTheDocument();
    // The bare case route answers 409 for a case several parents hold.
    expect(
      requests.filter((request) => request.url.startsWith("/api/test_cases")),
    ).toEqual([]);

    fireEvent.click(
      within(list).getByRole("button", {
        name: "Guest checkout creates an order",
      }),
    );
    await waitFor(() => {
      expect(screen.getByTestId("selection")).toHaveTextContent(
        "case:TC-PROJECT-1",
      );
    });
  });

  it("shows the API error envelope when the project cannot be read", async () => {
    mockApi(({ url, method }) => {
      if (url === "/api/projects/payments" && method === "GET") {
        return errorEnvelope(403, "forbidden", "no grant on this project");
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    renderCases();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("forbidden");
    expect(alert).toHaveTextContent("no grant on this project");
  });

  it("creates a case through the project and lists it after the re-fetch", async () => {
    const created: Array<{ testCaseId: string; title: string }> = [];
    const requests = mockApi(({ url, method, body }) => {
      if (url === "/api/projects/payments" && method === "GET") {
        return jsonResponse(200, {
          ...PAYMENTS,
          testCases: [
            ...PAYMENTS.testCases,
            ...created.map((testCase) => ({
              testCaseId: testCase.testCaseId,
              title: testCase.title,
            })),
          ],
        });
      }
      if (url === "/api/projects/payments/test_cases" && method === "POST") {
        const request = body as { testCaseId: string; title: string };
        created.push(request);
        return jsonResponse(201, {
          message: "Test case created",
          id: request.testCaseId,
        });
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    renderCases();
    await screen.findByRole("list", { name: "case list" });

    fireEvent.click(screen.getByRole("button", { name: "New case" }));

    const dialog = await screen.findByRole("dialog", { name: "New case" });
    const form = within(dialog).getByRole("form", { name: "Create case form" });
    fireEvent.change(within(form).getByLabelText("Case ID"), {
      target: { value: "TC-NEW-1" },
    });
    fireEvent.change(within(form).getByLabelText("Title"), {
      target: { value: "Refund a captured payment" },
    });
    fireEvent.change(within(form).getByLabelText("Expected result"), {
      target: { value: "The refund is recorded" },
    });
    fireEvent.change(within(form).getByLabelText("Priority"), {
      target: { value: "High" },
    });
    fireEvent.change(within(form).getByLabelText("Tags"), {
      target: { value: "refunds, smoke" },
    });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByTestId("selection")).toHaveTextContent(
        "case:TC-NEW-1",
      );
    });

    const posts = requests.filter((request) => request.method === "POST");
    expect(posts).toHaveLength(1);
    expect(posts[0]?.url).toBe("/api/projects/payments/test_cases");
    expect(posts[0]?.body).toEqual({
      testCaseId: "TC-NEW-1",
      title: "Refund a captured payment",
      expectedResult: "The refund is recorded",
      priority: "High",
      tags: ["refunds", "smoke"],
    });
    expect(screen.getByTestId("announcement")).toHaveTextContent(
      "Test case created",
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    const list = await screen.findByRole("list", { name: "case list" });
    expect(
      within(list).getByRole("button", { name: "Refund a captured payment" }),
    ).toBeInTheDocument();
  });

  it("keeps the create form open and shows the envelope when creation is rejected", async () => {
    mockApi(({ url, method }) => {
      if (url === "/api/projects/payments" && method === "GET") {
        return jsonResponse(200, PAYMENTS);
      }
      if (url === "/api/projects/payments/test_cases" && method === "POST") {
        return errorEnvelope(
          409,
          "conflict",
          "test case TC-LOGIN-1 already exists",
        );
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    renderCases();
    await screen.findByRole("list", { name: "case list" });

    fireEvent.click(screen.getByRole("button", { name: "New case" }));
    const dialog = await screen.findByRole("dialog", { name: "New case" });
    const form = within(dialog).getByRole("form", { name: "Create case form" });
    fireEvent.change(within(form).getByLabelText("Case ID"), {
      target: { value: "TC-LOGIN-1" },
    });
    fireEvent.change(within(form).getByLabelText("Title"), {
      target: { value: "Login succeeds with valid credentials" },
    });
    fireEvent.change(within(form).getByLabelText("Expected result"), {
      target: { value: "The account page loads" },
    });
    fireEvent.submit(form);

    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent("conflict");
    expect(alert).toHaveTextContent("test case TC-LOGIN-1 already exists");
    expect(screen.getByRole("dialog", { name: "New case" })).toBeInTheDocument();
  });

  it("offers no create control outside a case list", async () => {
    mockApi(({ url, method }) => {
      if (url === "/api/projects/payments/test_suites" && method === "GET") {
        return jsonResponse(200, []);
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    sessionStorage.setItem("selectedProjectId", PAYMENTS.projectId);
    render(
      <AuthProvider>
        <ProjectProvider>
          <EntityList entityType="suite" />
        </ProjectProvider>
      </AuthProvider>,
    );

    await screen.findByText("No suites found");
    expect(
      screen.queryByRole("button", { name: "New case" }),
    ).not.toBeInTheDocument();
  });
});
