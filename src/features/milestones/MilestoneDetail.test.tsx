import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AuthProvider } from "../../app/AuthProvider.js";
import { ProjectProvider, useProjectContext } from "../../app/ProjectContext.js";
import {
  errorEnvelope,
  jsonResponse,
  mockApi,
  resetTestApi,
  type RequestHandler,
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
  milestoneId: "m1-checkout",
  totalCases: 6,
  passed: 2,
  failed: 1,
  blocked: 1,
  untested: 1,
  retest: 1,
  passPercentage: 33.33,
};

const PROJECT = {
  projectId: "checkout",
  name: "Checkout",
  testSuites: [
    {
      suiteId: "smoke.checkout",
      name: "Checkout smoke",
      testCases: [{ testCaseId: "TC-LOGIN-1", title: "Log in" }],
    },
  ],
};

function DetailProbe() {
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

function renderDetail(milestoneId = "m1-checkout") {
  return render(
    <AuthProvider>
      <ProjectProvider>
        <nav aria-label="Milestone detail probe">
          <MilestoneDetail milestoneId={milestoneId} projectId="checkout" />
          <DetailProbe />
        </nav>
      </ProjectProvider>
    </AuthProvider>,
  );
}

/** The reads a milestone detail makes, plus the options its edit form needs. */
function detailHandler(
  overrides: Record<string, (body: unknown) => Response> = {},
): RequestHandler {
  return ({ url, method, body }) => {
    const key = `${method} ${url}`;
    const override = overrides[key];
    if (override) return override(body);
    if (key === "GET /api/milestones/m1-checkout") {
      return jsonResponse(200, MILESTONE);
    }
    if (key === "GET /api/milestones/m1-checkout/progress") {
      return jsonResponse(200, PROGRESS);
    }
    if (key === "GET /api/projects/checkout") {
      return jsonResponse(200, PROJECT);
    }
    if (key === "GET /api/projects/checkout/test_runs") {
      return jsonResponse(200, ["nightly"]);
    }
    if (key === "GET /api/test_runs/nightly") {
      return jsonResponse(200, { name: "Nightly run" });
    }
    throw new Error(`Unexpected request: ${method} ${url}`);
  };
}

afterEach(() => {
  resetTestApi();
});

describe("MilestoneDetail", () => {
  it("renders the milestone document and its progress", async () => {
    const requests = mockApi(
      detailHandler({
        "PUT /api/milestones/m1-checkout": () =>
          jsonResponse(200, { message: "Resource updated" }),
      }),
    );

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
      screen.getByText("6 total — 2 passed, 1 failed, 1 blocked, 1 untested, 1 retest"),
    ).toBeInTheDocument();
    expect(screen.getByText("33.33% of the total passed")).toBeInTheDocument();

    // Showing a milestone costs its document and its progress, nothing else:
    // the edit options are only read once the form is asked for.
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
    mockApi(
      detailHandler({
        "GET /api/milestones/m1-checkout": () =>
          errorEnvelope(404, "not_found", "no such milestone"),
      }),
    );

    renderDetail();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("not_found");
    expect(alert).toHaveTextContent("no such milestone");
  });

  it("shows the API error envelope when the progress read fails", async () => {
    mockApi(
      detailHandler({
        "GET /api/milestones/m1-checkout/progress": () =>
          errorEnvelope(403, "forbidden", "insufficient role"),
      }),
    );

    renderDetail();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("forbidden");
    expect(alert).toHaveTextContent("insufficient role");
  });

  it("sends only the changed field when the milestone is edited", async () => {
    const requests = mockApi(
      detailHandler({
        "PUT /api/milestones/m1-checkout": () =>
          jsonResponse(200, { message: "Resource updated" }),
      }),
    );

    renderDetail();
    await screen.findByRole("heading", { name: "Checkout GA" });

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    const form = await screen.findByRole("form", { name: "Save changes form" });
    // The stored links open already selected.
    expect(
      within(form).getByRole("checkbox", { name: /^Checkout smoke/ }),
    ).toBeChecked();
    expect(
      within(form).getByRole("checkbox", { name: /Nightly run/ }),
    ).toBeChecked();

    fireEvent.change(within(form).getByLabelText("Name"), {
      target: { value: "Checkout v1.0" },
    });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(
        screen.queryByRole("form", { name: "Save changes form" }),
      ).not.toBeInTheDocument();
    });

    const puts = requests.filter((request) => request.method === "PUT");
    expect(puts).toHaveLength(1);
    expect(puts[0]?.url).toBe("/api/milestones/m1-checkout");
    // An unchanged field is left out, and the identifier is never sent: the API
    // stores it without moving the milestone.
    expect(puts[0]?.body).toEqual({ name: "Checkout v1.0" });
    expect(await screen.findByTestId("announcement")).toHaveTextContent(
      "Resource updated",
    );
    // The document is read again after the mutation.
    expect(
      requests.filter(
        (request) =>
          request.method === "GET" &&
          request.url === "/api/milestones/m1-checkout",
      ),
    ).toHaveLength(2);
  });

  it("sends nothing when an edit changes no field", async () => {
    const requests = mockApi(detailHandler());

    renderDetail();
    await screen.findByRole("heading", { name: "Checkout GA" });

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const form = await screen.findByRole("form", { name: "Save changes form" });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(
        screen.queryByRole("form", { name: "Save changes form" }),
      ).not.toBeInTheDocument();
    });
    expect(
      requests.filter((request) => request.method === "PUT"),
    ).toEqual([]);
  });

  it("keeps the edit form open and shows the envelope when the update is rejected", async () => {
    mockApi(
      detailHandler({
        "PUT /api/milestones/m1-checkout": () =>
          errorEnvelope(409, "conflict", "milestone was changed elsewhere"),
      }),
    );

    renderDetail();
    await screen.findByRole("heading", { name: "Checkout GA" });

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const form = await screen.findByRole("form", { name: "Save changes form" });
    fireEvent.change(within(form).getByLabelText("Status"), {
      target: { value: "completed" },
    });
    fireEvent.submit(form);

    const alert = await within(form).findByRole("alert");
    expect(alert).toHaveTextContent("conflict");
    expect(alert).toHaveTextContent("milestone was changed elsewhere");
    expect(
      screen.getByRole("form", { name: "Save changes form" }),
    ).toBeInTheDocument();
  });

  it("deletes the milestone after a confirmation", async () => {
    const requests = mockApi(
      detailHandler({
        "DELETE /api/milestones/m1-checkout": () =>
          jsonResponse(200, { message: "Resource deleted" }),
      }),
    );

    renderDetail();
    await screen.findByRole("heading", { name: "Checkout GA" });

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Delete milestone",
    });
    // The links stay where they are, so the confirmation says so.
    expect(dialog).toHaveTextContent("The suites and runs it links stay");
    expect(
      requests.filter((request) => request.method === "DELETE"),
    ).toEqual([]);

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Delete milestone" }),
    );

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Delete milestone" }),
      ).not.toBeInTheDocument();
    });

    const deletes = requests.filter((request) => request.method === "DELETE");
    expect(deletes).toHaveLength(1);
    expect(deletes[0]?.url).toBe("/api/milestones/m1-checkout");
    expect(await screen.findByTestId("announcement")).toHaveTextContent(
      "Resource deleted",
    );
    expect(screen.getByTestId("selection")).toHaveTextContent("none");
  });

  it("keeps the confirmation open and shows the envelope when deletion is rejected", async () => {
    mockApi(
      detailHandler({
        "DELETE /api/milestones/m1-checkout": () =>
          errorEnvelope(403, "forbidden", "insufficient role"),
      }),
    );

    renderDetail();
    await screen.findByRole("heading", { name: "Checkout GA" });

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Delete milestone",
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Delete milestone" }),
    );

    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent("forbidden");
    expect(alert).toHaveTextContent("insufficient role");
    expect(
      screen.getByRole("dialog", { name: "Delete milestone" }),
    ).toBeInTheDocument();
  });

  it("shows the envelope when the edit options cannot be read", async () => {
    mockApi(
      detailHandler({
        "GET /api/projects/checkout": () =>
          errorEnvelope(403, "forbidden", "no grant on this project"),
      }),
    );

    renderDetail();
    await screen.findByRole("heading", { name: "Checkout GA" });

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("forbidden");
    expect(alert).toHaveTextContent("no grant on this project");
  });
});
