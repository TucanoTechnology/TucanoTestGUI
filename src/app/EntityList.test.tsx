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
  const { selection } = useProjectContext();
  return (
    <span data-testid="selection">
      {selection ? `${selection.type}:${selection.id}` : "none"}
    </span>
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
});
