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

function renderRuns() {
  sessionStorage.setItem("selectedProjectId", PAYMENTS.projectId);
  return render(
    <AuthProvider>
      <ProjectProvider>
        <EntityList entityType="run" />
        <SelectionProbe />
      </ProjectProvider>
    </AuthProvider>,
  );
}

function renderMilestones() {
  sessionStorage.setItem("selectedProjectId", PAYMENTS.projectId);
  return render(
    <AuthProvider>
      <ProjectProvider>
        <EntityList entityType="milestone" />
        <SelectionProbe />
      </ProjectProvider>
    </AuthProvider>,
  );
}

function renderConfigurations() {
  sessionStorage.setItem("selectedProjectId", PAYMENTS.projectId);
  return render(
    <AuthProvider>
      <ProjectProvider>
        <EntityList entityType="configuration" />
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

  it("lists runs under the key the project holds them by", async () => {
    const requests = mockApi(({ url, method }) => {
      if (url === "/api/projects/payments/test_runs" && method === "GET") {
        return jsonResponse(200, ["nightly.json", "imported.json"]);
      }
      if (url === "/api/test_runs/nightly.json" && method === "GET") {
        return jsonResponse(200, {
          name: "Nightly run",
          timestamp: "1750000000",
        });
      }
      if (url === "/api/test_runs/imported.json" && method === "GET") {
        return jsonResponse(200, { timestamp: "1750000001" });
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    renderRuns();

    const list = await screen.findByRole("list", { name: "run list" });
    expect(within(list).getAllByRole("button")).toHaveLength(2);
    // A run document need not carry a `testRunId`, so the listing key names it.
    expect(
      within(list).getByRole("button", { name: /Nightly run/ }),
    ).toBeInTheDocument();
    expect(
      within(list).getByRole("button", { name: /imported\.json/ }),
    ).toBeInTheDocument();
    expect(within(list).getByText("1750000001")).toBeInTheDocument();

    fireEvent.click(within(list).getByRole("button", { name: /Nightly run/ }));
    await waitFor(() => {
      expect(screen.getByTestId("selection")).toHaveTextContent(
        "run:nightly.json",
      );
    });
    expect(
      requests.filter((request) => request.url.startsWith("/api/test_runs")),
    ).toHaveLength(2);
  });

  it("creates a run that copies the selected suites, cases and configuration", async () => {
    const createdIds: string[] = [];
    const requests = mockApi(({ url, method }) => {
      if (url === "/api/projects/payments/test_runs" && method === "GET") {
        return jsonResponse(200, createdIds);
      }
      if (url === "/api/projects/payments" && method === "GET") {
        return jsonResponse(200, PAYMENTS);
      }
      if (url === "/api/projects/payments/configurations" && method === "GET") {
        return jsonResponse(200, ["chrome-linux"]);
      }
      if (url === "/api/configurations/chrome-linux" && method === "GET") {
        return jsonResponse(200, {
          configId: "chrome-linux",
          name: "Chrome on Linux",
          browser: "chrome",
          os: "linux",
        });
      }
      if (url === "/api/projects/payments/test_runs" && method === "POST") {
        createdIds.push("nightly.json");
        return jsonResponse(201, {
          message: "Test run created",
          id: "nightly.json",
        });
      }
      if (url === "/api/test_runs/nightly.json" && method === "GET") {
        return jsonResponse(200, {
          name: "Nightly",
          timestamp: "1750000000",
        });
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    renderRuns();
    await screen.findByText("No runs found");

    fireEvent.click(screen.getByRole("button", { name: "New run" }));

    const dialog = await screen.findByRole("dialog", { name: "New run" });
    const form = within(dialog).getByRole("form", { name: "Create run form" });
    fireEvent.change(within(form).getByLabelText("Name"), {
      target: { value: "Nightly" },
    });
    fireEvent.change(within(form).getByLabelText("Configuration"), {
      target: { value: "chrome-linux" },
    });
    fireEvent.click(within(form).getByRole("checkbox", { name: /^Smoke/ }));
    fireEvent.click(
      within(form).getByRole("checkbox", { name: /Guest checkout/ }),
    );
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByTestId("selection")).toHaveTextContent(
        "run:nightly.json",
      );
    });

    const posts = requests.filter((request) => request.method === "POST");
    expect(posts).toHaveLength(1);
    expect(posts[0]?.url).toBe("/api/projects/payments/test_runs");
    expect(posts[0]?.body).toEqual({
      name: "Nightly",
      projects: [{ projectId: "payments", name: "Payments", testSuites: [] }],
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
      // The API copies the cases but never pins their revisions itself.
      caseVersions: { "TC-LOGIN-1": 1, "TC-PROJECT-1": 1 },
      configurations: [{ configId: "chrome-linux", name: "Chrome on Linux" }],
    });
    expect(screen.getByTestId("announcement")).toHaveTextContent(
      "Test run created",
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the run dialog open and shows the envelope when creation is rejected", async () => {
    mockApi(({ url, method }) => {
      if (url === "/api/projects/payments/test_runs" && method === "GET") {
        return jsonResponse(200, []);
      }
      if (url === "/api/projects/payments" && method === "GET") {
        return jsonResponse(200, PAYMENTS);
      }
      if (url === "/api/projects/payments/configurations" && method === "GET") {
        return jsonResponse(200, []);
      }
      if (url === "/api/projects/payments/test_runs" && method === "POST") {
        return errorEnvelope(400, "invalid_request", "Field `projects` is invalid");
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    renderRuns();
    await screen.findByText("No runs found");

    fireEvent.click(screen.getByRole("button", { name: "New run" }));
    const dialog = await screen.findByRole("dialog", { name: "New run" });
    const form = within(dialog).getByRole("form", { name: "Create run form" });
    fireEvent.change(within(form).getByLabelText("Name"), {
      target: { value: "Nightly" },
    });
    fireEvent.submit(form);

    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent("invalid_request");
    expect(alert).toHaveTextContent("Field `projects` is invalid");
    expect(screen.getByRole("dialog", { name: "New run" })).toBeInTheDocument();
  });

  it("shows the envelope when the run options cannot be read", async () => {
    mockApi(({ url, method }) => {
      if (url === "/api/projects/payments/test_runs" && method === "GET") {
        return jsonResponse(200, []);
      }
      if (url === "/api/projects/payments" && method === "GET") {
        return errorEnvelope(403, "forbidden", "no grant on this project");
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    renderRuns();
    await screen.findByText("No runs found");

    fireEvent.click(screen.getByRole("button", { name: "New run" }));

    const dialog = await screen.findByRole("dialog", { name: "New run" });
    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent("forbidden");
    expect(alert).toHaveTextContent("no grant on this project");
  });

  it("lists milestones under the key the project holds them by", async () => {
    const requests = mockApi(({ url, method }) => {
      if (url === "/api/projects/payments/milestones" && method === "GET") {
        return jsonResponse(200, ["probe-e.json"]);
      }
      if (url === "/api/milestones/probe-e.json" && method === "GET") {
        // The document carries an identifier that differs from the key the
        // project lists it under, and the key is what addresses it.
        return jsonResponse(200, {
          milestoneId: "probe-e",
          name: "Probe E",
          status: "in_progress",
        });
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    renderMilestones();

    const list = await screen.findByRole("list", { name: "milestone list" });
    expect(within(list).getAllByRole("button")).toHaveLength(1);
    expect(
      within(list).getByRole("button", { name: /Probe E/ }),
    ).toBeInTheDocument();
    expect(within(list).getByText("in_progress")).toBeInTheDocument();

    fireEvent.click(within(list).getByRole("button", { name: /Probe E/ }));
    await waitFor(() => {
      expect(screen.getByTestId("selection")).toHaveTextContent(
        "milestone:probe-e.json",
      );
    });
    expect(requests.filter((request) => request.url.startsWith("/api/milestones"))).toHaveLength(1);
  });

  it("creates a milestone that links the selected suites and runs", async () => {
    const requests = mockApi(({ url, method }) => {
      if (url === "/api/projects/payments/milestones" && method === "GET") {
        return jsonResponse(200, []);
      }
      if (url === "/api/projects/payments" && method === "GET") {
        return jsonResponse(200, PAYMENTS);
      }
      if (url === "/api/projects/payments/test_runs" && method === "GET") {
        return jsonResponse(200, ["nightly.json"]);
      }
      if (url === "/api/test_runs/nightly.json" && method === "GET") {
        return jsonResponse(200, { name: "Nightly run" });
      }
      if (url === "/api/projects/payments/milestones" && method === "POST") {
        return jsonResponse(201, {
          message: "Milestone created",
          id: "v1.0.json",
        });
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    renderMilestones();
    await screen.findByText("No milestones found");

    fireEvent.click(screen.getByRole("button", { name: "New milestone" }));

    const dialog = await screen.findByRole("dialog", { name: "New milestone" });
    const form = within(dialog).getByRole("form", {
      name: "Create milestone form",
    });
    fireEvent.change(within(form).getByLabelText("Name"), {
      target: { value: "Checkout GA" },
    });
    fireEvent.click(within(form).getByRole("checkbox", { name: /^Smoke/ }));
    fireEvent.click(
      within(form).getByRole("checkbox", { name: /Nightly run/ }),
    );
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByTestId("selection")).toHaveTextContent(
        "milestone:v1.0.json",
      );
    });

    const posts = requests.filter((request) => request.method === "POST");
    expect(posts).toHaveLength(1);
    expect(posts[0]?.url).toBe("/api/projects/payments/milestones");
    expect(posts[0]?.body).toEqual({
      name: "Checkout GA",
      testSuiteIds: ["smoke"],
      testRunIds: ["nightly.json"],
    });
    expect(screen.getByTestId("announcement")).toHaveTextContent(
      "Milestone created",
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the milestone dialog open and shows the envelope when creation is rejected", async () => {
    mockApi(({ url, method }) => {
      if (url === "/api/projects/payments/milestones" && method === "GET") {
        return jsonResponse(200, []);
      }
      if (url === "/api/projects/payments" && method === "GET") {
        return jsonResponse(200, PAYMENTS);
      }
      if (url === "/api/projects/payments/test_runs" && method === "GET") {
        return jsonResponse(200, []);
      }
      if (url === "/api/projects/payments/milestones" && method === "POST") {
        return errorEnvelope(
          400,
          "invalid_request",
          "Field `testSuites` is invalid",
        );
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    renderMilestones();
    await screen.findByText("No milestones found");

    fireEvent.click(screen.getByRole("button", { name: "New milestone" }));
    const dialog = await screen.findByRole("dialog", { name: "New milestone" });
    const form = within(dialog).getByRole("form", {
      name: "Create milestone form",
    });
    fireEvent.change(within(form).getByLabelText("Name"), {
      target: { value: "Checkout GA" },
    });
    fireEvent.submit(form);

    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent("invalid_request");
    expect(alert).toHaveTextContent("Field `testSuites` is invalid");
    expect(
      screen.getByRole("dialog", { name: "New milestone" }),
    ).toBeInTheDocument();
  });

  it("shows the envelope when the milestone options cannot be read", async () => {
    mockApi(({ url, method }) => {
      if (url === "/api/projects/payments/milestones" && method === "GET") {
        return jsonResponse(200, []);
      }
      if (url === "/api/projects/payments" && method === "GET") {
        return errorEnvelope(403, "forbidden", "no grant on this project");
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    renderMilestones();
    await screen.findByText("No milestones found");

    fireEvent.click(screen.getByRole("button", { name: "New milestone" }));

    const dialog = await screen.findByRole("dialog", { name: "New milestone" });
    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent("forbidden");
    expect(alert).toHaveTextContent("no grant on this project");
  });

  it("lists configurations under the key the project holds them by", async () => {
    const requests = mockApi(({ url, method }) => {
      if (url === "/api/projects/payments/configurations" && method === "GET") {
        return jsonResponse(200, ["probe-config.json"]);
      }
      if (url === "/api/configurations/probe-config.json" && method === "GET") {
        // The document carries an identifier that differs from the key the
        // project lists it under, and the key is what addresses it.
        return jsonResponse(200, {
          configId: "probe-config",
          name: "Probe config",
          browser: "Chrome 140",
          os: "Linux",
        });
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    renderConfigurations();

    const list = await screen.findByRole("list", { name: "configuration list" });
    expect(within(list).getAllByRole("button")).toHaveLength(1);
    expect(
      within(list).getByRole("button", { name: /Probe config/ }),
    ).toBeInTheDocument();
    expect(within(list).getByText("Chrome 140, Linux")).toBeInTheDocument();

    fireEvent.click(within(list).getByRole("button", { name: /Probe config/ }));
    await waitFor(() => {
      expect(screen.getByTestId("selection")).toHaveTextContent(
        "configuration:probe-config.json",
      );
    });
    expect(
      requests.filter((request) =>
        request.url.startsWith("/api/configurations"),
      ),
    ).toHaveLength(1);
  });

  it("creates a configuration through the project", async () => {
    const created: string[] = [];
    const requests = mockApi(({ url, method }) => {
      if (url === "/api/projects/payments/configurations" && method === "GET") {
        return jsonResponse(200, created);
      }
      if (url === "/api/projects/payments/configurations" && method === "POST") {
        created.push("mobile-safari.json");
        return jsonResponse(201, {
          message: "Test configuration created",
          id: "mobile-safari.json",
        });
      }
      if (url === "/api/configurations/mobile-safari.json" && method === "GET") {
        return jsonResponse(200, {
          configId: "AO116-EXPLICIT.json",
          name: "Mobile Safari",
          browser: "Safari 18",
        });
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    renderConfigurations();
    await screen.findByText("No configurations found");

    fireEvent.click(screen.getByRole("button", { name: "New configuration" }));

    const dialog = await screen.findByRole("dialog", {
      name: "New configuration",
    });
    const form = within(dialog).getByRole("form", {
      name: "Create configuration form",
    });
    fireEvent.change(within(form).getByLabelText("Name"), {
      target: { value: "Mobile Safari" },
    });
    fireEvent.change(within(form).getByLabelText("Browser"), {
      target: { value: "Safari 18" },
    });
    fireEvent.change(within(form).getByLabelText("Device"), {
      target: { value: "iPhone" },
    });
    fireEvent.submit(form);

    // The create response names the key the project now lists it under, and
    // that key — not the identifier inside the document — is what addresses it.
    await waitFor(() => {
      expect(screen.getByTestId("selection")).toHaveTextContent(
        "configuration:mobile-safari.json",
      );
    });

    const posts = requests.filter((request) => request.method === "POST");
    expect(posts).toHaveLength(1);
    expect(posts[0]?.url).toBe("/api/projects/payments/configurations");
    // The blank optionals are left out: the API rejects an unknown field and
    // stores a supplied empty string.
    expect(posts[0]?.body).toEqual({
      name: "Mobile Safari",
      browser: "Safari 18",
      device: "iPhone",
    });
    expect(screen.getByTestId("announcement")).toHaveTextContent(
      "Test configuration created",
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      requests.filter(
        (request) =>
          request.url === "/api/projects/payments/configurations" &&
          request.method === "GET",
      ),
    ).toHaveLength(2);

    const list = await screen.findByRole("list", {
      name: "configuration list",
    });
    expect(
      within(list).getByRole("button", { name: /Mobile Safari/ }),
    ).toBeInTheDocument();
  });

  it("keeps the configuration dialog open and shows the envelope when creation is rejected", async () => {
    mockApi(({ url, method }) => {
      if (url === "/api/projects/payments/configurations" && method === "GET") {
        return jsonResponse(200, []);
      }
      if (url === "/api/projects/payments/configurations" && method === "POST") {
        return errorEnvelope(
          400,
          "invalid_request",
          "Required fields are missing",
        );
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    renderConfigurations();
    await screen.findByText("No configurations found");

    fireEvent.click(screen.getByRole("button", { name: "New configuration" }));
    const dialog = await screen.findByRole("dialog", {
      name: "New configuration",
    });
    const form = within(dialog).getByRole("form", {
      name: "Create configuration form",
    });
    fireEvent.change(within(form).getByLabelText("Name"), {
      target: { value: "Probe config" },
    });
    fireEvent.submit(form);

    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent("invalid_request");
    expect(alert).toHaveTextContent("Required fields are missing");
    expect(
      screen.getByRole("dialog", { name: "New configuration" }),
    ).toBeInTheDocument();
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
    expect(
      screen.queryByRole("button", { name: "New configuration" }),
    ).not.toBeInTheDocument();
  });
});
