import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { AuthProvider } from "../../app/AuthProvider.js";
import { ProjectProvider, useProjectContext } from "../../app/ProjectContext.js";
import {
  errorEnvelope,
  jsonResponse,
  mockApi,
  resetTestApi,
  type RecordedRequest,
} from "../../test-utils.js";
import { RunDetail } from "./RunDetail.js";

/** `GET /test_runs/nightly.json`, shaped as the seeded dataset is. */
const RUN: Record<string, unknown> = {
  testRunId: "nightly.json",
  name: "Nightly run",
  timestamp: "1750000000",
  tags: ["nightly"],
  projects: [{ projectId: "checkout.json", name: "Checkout" }],
  testSuites: [{ suiteId: "smoke.checkout.json", name: "Checkout smoke" }],
  testCases: [{ testCaseId: "TC-LOGIN-1", title: "Log in" }],
  results: [{ testCaseId: "TC-LOGIN-1", status: "passed" }],
  configurations: [{ configId: "chrome-linux.json", name: "chrome-linux" }],
};

const CONFIGURATION = {
  configId: "chrome-linux.json",
  name: "Chrome on Linux",
  browser: "chrome",
  os: "linux",
};

/** A result as the API stores one, milliseconds and all. */
const RECORDED_RESULT = {
  testCaseId: "TC-LOGIN-1",
  status: "Failed",
  timestamp: "1789655960",
  notes: "lock message missing",
  durationMs: 800,
};

const DEFECT = {
  linkId: "link-1",
  defectId: "OPS-1",
  defectUrl: "https://acme.atlassian.net/browse/OPS-1",
  trackerType: "jira",
  linkedAt: "1789655960",
};

interface ApiStore {
  run: Record<string, unknown>;
  puts: unknown[];
  posts: unknown[];
  /** Bodies posted to the result route, oldest first. */
  resultPosts: unknown[];
  /** Bodies posted to the defect link route, oldest first. */
  defectPosts: unknown[];
  deletes: string[];
  /** When set, the mutating routes answer this instead of succeeding. */
  refusal?: Response;
}

/** Applies `update` to the result the run records for `caseId`. */
function replaceResult(
  store: ApiStore,
  caseId: string,
  update: (result: Record<string, unknown>) => Record<string, unknown>,
) {
  const results =
    (store.run.results as Record<string, unknown>[] | undefined) ?? [];
  store.run = {
    ...store.run,
    results: results.map((result) =>
      result.testCaseId === caseId ? update(result) : result,
    ),
  };
}

function checkoutApi(store: ApiStore) {
  return ({ url, method, body }: RecordedRequest): Response => {
    if (url === "/api/test_runs/nightly.json" && method === "GET") {
      return jsonResponse(200, store.run);
    }
    if (
      url === "/api/projects/checkout.json/configurations" &&
      method === "GET"
    ) {
      return jsonResponse(200, ["chrome-linux.json"]);
    }
    if (url === "/api/configurations/chrome-linux.json" && method === "GET") {
      return jsonResponse(200, CONFIGURATION);
    }
    if (url === "/api/test_runs/nightly.json" && method === "PUT") {
      if (store.refusal) return store.refusal;
      store.puts.push(body);
      store.run = { ...store.run, ...(body as Record<string, unknown>) };
      return jsonResponse(200, { message: "Resource updated" });
    }
    if (url === "/api/test_runs/nightly.json/duplicate" && method === "POST") {
      if (store.refusal) return store.refusal;
      store.posts.push(body);
      return jsonResponse(201, {
        id: "nightly-copy.json",
        message: "Test run duplicated",
      });
    }
    if (url === "/api/test_runs/nightly.json/results" && method === "POST") {
      if (store.refusal) return store.refusal;
      const posted = body as {
        testCaseId: string;
        status: string;
        notes?: string;
        durationMs?: number;
        timestamp?: string;
      };
      store.resultPosts.push(body);
      // The API replaces the whole result rather than merging into it, so the
      // fields it did not receive are the fields the record loses.
      const kept = (
        (store.run.results as Record<string, unknown>[] | undefined) ?? []
      ).filter((result) => result.testCaseId !== posted.testCaseId);
      store.run = {
        ...store.run,
        results: [
          ...kept,
          {
            testCaseId: posted.testCaseId,
            status: posted.status,
            timestamp: posted.timestamp ?? "1789655960",
            ...(posted.notes === undefined ? {} : { notes: posted.notes }),
            ...(posted.durationMs === undefined
              ? {}
              : { durationMs: posted.durationMs }),
          },
        ],
      };
      return jsonResponse(200, { message: "Test result recorded in run" });
    }

    const linkMatch =
      /^\/api\/test_runs\/nightly\.json\/results\/([^/]+)\/defects$/.exec(url);
    if (linkMatch && method === "POST") {
      if (store.refusal) return store.refusal;
      const caseId = linkMatch[1] ?? "";
      const posted = body as {
        defectId: string;
        defectUrl: string;
        trackerType: string;
      };
      store.defectPosts.push(body);
      replaceResult(store, caseId, (result) => ({
        ...result,
        defectLinks: [
          ...((result.defectLinks as Record<string, unknown>[] | undefined) ??
            []),
          { linkId: "link-1", linkedAt: "1789655960", ...posted },
        ],
      }));
      return jsonResponse(201, {
        id: "link-1",
        message: "Defect linked to test result",
      });
    }

    const unlinkMatch =
      /^\/api\/test_runs\/nightly\.json\/results\/([^/]+)\/defects\/([^/]+)$/.exec(
        url,
      );
    if (unlinkMatch && method === "DELETE") {
      if (store.refusal) return store.refusal;
      const caseId = unlinkMatch[1] ?? "";
      const linkId = unlinkMatch[2] ?? "";
      store.deletes.push(url);
      replaceResult(store, caseId, (result) => ({
        ...result,
        defectLinks: (
          (result.defectLinks as Record<string, unknown>[] | undefined) ?? []
        ).filter((link) => link.linkId !== linkId),
      }));
      return jsonResponse(200, { message: "Defect unlinked from test result" });
    }

    if (url === "/api/test_runs/nightly.json" && method === "DELETE") {
      if (store.refusal) return store.refusal;
      store.deletes.push(url);
      return jsonResponse(200, { message: "Resource deleted" });
    }
    throw new Error(`Unexpected request: ${method} ${url}`);
  };
}

function emptyStore(run: Record<string, unknown> = RUN): ApiStore {
  return {
    run,
    puts: [],
    posts: [],
    resultPosts: [],
    defectPosts: [],
    deletes: [],
  };
}

/** A run holding two cases: the first with a result, the second without. */
function resultStore(): ApiStore {
  return emptyStore({
    ...RUN,
    testCases: [
      { testCaseId: "TC-LOGIN-1", title: "Log in" },
      { testCaseId: "TC-LOGIN-2", title: "Reject a bad password" },
    ],
    results: [{ ...RECORDED_RESULT }],
  });
}

/** `resultStore` with the recorded result already linking a defect. */
function linkedStore(): ApiStore {
  return emptyStore({
    ...RUN,
    testCases: [
      { testCaseId: "TC-LOGIN-1", title: "Log in" },
      { testCaseId: "TC-LOGIN-2", title: "Reject a bad password" },
    ],
    results: [{ ...RECORDED_RESULT, defectLinks: [DEFECT] }],
  });
}

function Harness({ runId }: { runId: string }) {
  const { selection, setSelection, announcement } = useProjectContext();

  useEffect(() => {
    setSelection({ type: "run", id: runId, projectId: "checkout.json" });
  }, [runId, setSelection]);

  return (
    <nav aria-label="Run detail probe">
      <span data-testid="announcement">{announcement?.message ?? ""}</span>
      <span data-testid="selection">
        {selection ? `${selection.type}:${selection.id}` : "none"}
      </span>
      <RunDetail runId={runId} projectId="checkout.json" />
    </nav>
  );
}

function renderDetail(runId = "nightly.json") {
  return render(
    <AuthProvider>
      <ProjectProvider>
        <Harness runId={runId} />
      </ProjectProvider>
    </AuthProvider>,
  );
}

async function openDetail(store: ApiStore) {
  const requests = mockApi(checkoutApi(store));
  const view = renderDetail();
  await screen.findByRole("heading", { name: "Nightly run" });
  return { view, requests };
}

async function openEdit() {
  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
  return screen.findByRole("form", { name: "Save changes form" });
}

afterEach(() => {
  resetTestApi();
});

describe("RunDetail", () => {
  it("renders the run document", async () => {
    const store = emptyStore();
    const { view, requests } = await openDetail(store);

    expect(screen.getByText("Run ID: nightly.json")).toBeInTheDocument();
    expect(screen.getByText("1750000000")).toBeInTheDocument();
    expect(screen.getByText("nightly")).toBeInTheDocument();
    // The run's own copy of the configuration names it, without a second read.
    expect(screen.getByText("Configuration")).toBeInTheDocument();
    expect(screen.getByText("chrome-linux")).toBeInTheDocument();
    expect(screen.getByText("Projects (1)")).toBeInTheDocument();
    expect(screen.getByText("Suites (1)")).toBeInTheDocument();
    expect(screen.getByText("Test Cases (1)")).toBeInTheDocument();
    expect(screen.getByText("Results (1)")).toBeInTheDocument();
    expect(screen.getByText("passed")).toBeInTheDocument();

    // Reading a run costs one request: the stored run carries its configuration.
    expect(requests.map((request) => request.url)).toEqual([
      "/api/test_runs/nightly.json",
    ]);

    const { default: axe } = await import("axe-core");
    const results = await axe.run(view.baseElement, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });

  it("falls back to the run id when the run carries no name", async () => {
    mockApi(checkoutApi(emptyStore({ ...RUN, name: undefined })));

    renderDetail();

    await screen.findByRole("heading", { name: "nightly.json" });
  });

  it("falls back to the listing key when the run carries no identifier", async () => {
    mockApi(
      checkoutApi(emptyStore({ ...RUN, name: undefined, testRunId: undefined })),
    );

    renderDetail();

    await screen.findByRole("heading", { name: "nightly.json" });
  });

  it("shows a loading status while the request is in flight", () => {
    mockApi(() => new Promise<Response>(() => {}));

    renderDetail();

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("shows the API error envelope", async () => {
    mockApi(({ url, method }) => {
      if (url === "/api/test_runs/nightly.json" && method === "GET") {
        return errorEnvelope(409, "conflict", "run id is ambiguous");
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    renderDetail();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("conflict");
    expect(alert).toHaveTextContent("run id is ambiguous");
  });

  it("reads the configurations only when the edit form needs them", async () => {
    const store = emptyStore();
    const { requests } = await openDetail(store);
    expect(requests).toHaveLength(1);

    const form = await openEdit();

    expect(within(form).getByLabelText("Name")).toHaveValue("Nightly run");
    expect(within(form).getByLabelText("Configuration")).toHaveValue(
      "chrome-linux.json",
    );
    // The option label comes from the configuration document, not the run.
    expect(
      within(form).getByRole("option", { name: "Chrome on Linux" }),
    ).toBeInTheDocument();
    expect(requests.map((request) => request.url)).toEqual([
      "/api/test_runs/nightly.json",
      "/api/projects/checkout.json/configurations",
      "/api/configurations/chrome-linux.json",
    ]);
  });

  it("sends only the changed fields when editing a run", async () => {
    const store = emptyStore();
    await openDetail(store);

    const form = await openEdit();
    fireEvent.change(within(form).getByLabelText("Name"), {
      target: { value: "Nightly v2" },
    });
    fireEvent.submit(form);

    await screen.findByRole("heading", { name: "Nightly v2" });
    expect(store.puts).toEqual([{ name: "Nightly v2" }]);
    expect(
      screen.queryByRole("form", { name: "Save changes form" }),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("announcement")).toHaveTextContent(
      "Resource updated",
    );
  });

  it("stores edited tags through the run form", async () => {
    const store = emptyStore();
    await openDetail(store);

    const form = await openEdit();
    // The stored tags arrive as the comma-separated field they were typed in.
    expect(within(form).getByLabelText("Tags")).toHaveValue("nightly");

    fireEvent.change(within(form).getByLabelText("Tags"), {
      target: { value: " smoke, regression, smoke " },
    });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(
        screen.queryByRole("form", { name: "Save changes form" }),
      ).not.toBeInTheDocument();
    });
    // Blank entries and repeats never reach the API.
    expect(store.puts).toEqual([{ tags: ["smoke", "regression"] }]);
    // The stored run is re-read, so the chips only repaint once that lands.
    expect(await screen.findByText("smoke")).toBeInTheDocument();
    expect(screen.getByText("regression")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText("nightly")).not.toBeInTheDocument();
    });
  });

  it("sends nothing when the edit changes no field", async () => {
    const store = emptyStore();
    const { requests } = await openDetail(store);

    const form = await openEdit();
    const reads = requests.length;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(
        screen.queryByRole("form", { name: "Save changes form" }),
      ).not.toBeInTheDocument();
    });
    expect(store.puts).toEqual([]);
    expect(
      requests.slice(reads).filter((request) => request.method !== "GET"),
    ).toEqual([]);
  });

  it("clears the linked configuration with an empty list", async () => {
    const store = emptyStore();
    await openDetail(store);

    const form = await openEdit();
    fireEvent.change(within(form).getByLabelText("Configuration"), {
      target: { value: "" },
    });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(store.puts).toEqual([{ configurations: [] }]);
    });
  });

  it("duplicates the run and selects the copy", async () => {
    const store = emptyStore();
    await openDetail(store);

    fireEvent.click(screen.getByRole("button", { name: "Duplicate" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Duplicate test run",
    });
    fireEvent.change(within(dialog).getByLabelText("New run ID"), {
      target: { value: "nightly-copy" },
    });
    fireEvent.submit(
      within(dialog).getByRole("form", { name: "Duplicate test run form" }),
    );

    await waitFor(() => {
      expect(screen.getByTestId("selection")).toHaveTextContent(
        "run:nightly-copy.json",
      );
    });
    expect(store.posts).toEqual([{ newId: "nightly-copy" }]);
    expect(screen.getByTestId("announcement")).toHaveTextContent(
      "Test run duplicated",
    );
  });

  it("deletes the run and clears the selection", async () => {
    const store = emptyStore();
    await openDetail(store);
    await waitFor(() => {
      expect(screen.getByTestId("selection")).toHaveTextContent(
        "run:nightly.json",
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Delete test run",
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete run" }));

    await waitFor(() => {
      expect(screen.getByTestId("selection")).toHaveTextContent("none");
    });
    expect(store.deletes).toEqual(["/api/test_runs/nightly.json"]);
    expect(screen.getByTestId("announcement")).toHaveTextContent(
      "Resource deleted",
    );
  });

  it("keeps the delete dialog open when the API refuses", async () => {
    const store = emptyStore();
    store.refusal = errorEnvelope(403, "forbidden", "no grant on this run");
    await openDetail(store);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Delete test run",
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete run" }));

    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent("forbidden");
    expect(
      screen.getByRole("dialog", { name: "Delete test run" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("selection")).toHaveTextContent("run:nightly.json");
    expect(store.deletes).toEqual([]);
  });

  it("has no accessibility violations with a dialog open", async () => {
    const store = emptyStore();
    const { view } = await openDetail(store);

    fireEvent.click(screen.getByRole("button", { name: "Duplicate" }));
    await screen.findByRole("dialog", { name: "Duplicate test run" });

    const { default: axe } = await import("axe-core");
    const results = await axe.run(view.baseElement, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });

  it("lists every case in the run with the result it records", async () => {
    const store = resultStore();
    const { requests } = await openDetail(store);

    expect(screen.getByText("Results (2)")).toBeInTheDocument();
    // The first case carries its recorded result…
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText("lock message missing")).toBeInTheDocument();
    expect(screen.getByText("800 ms")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit result" })).toBeInTheDocument();
    // …and the second is untested, with nothing recorded to edit.
    expect(screen.getByText("Untested")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Record result" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(3);

    // The table is built from the run document, so it costs no extra read.
    expect(requests.map((request) => request.url)).toEqual([
      "/api/test_runs/nightly.json",
    ]);
  });

  it("shows a result whose case the run no longer holds", async () => {
    mockApi(
      checkoutApi(
        emptyStore({
          ...RUN,
          testCases: [{ testCaseId: "TC-LOGIN-1", title: "Log in" }],
          results: [
            { ...RECORDED_RESULT },
            { ...RECORDED_RESULT, testCaseId: "TC-GONE-1", status: "Passed" },
          ],
        }),
      ),
    );

    renderDetail();

    await screen.findByText("TC-GONE-1");
    expect(screen.getByText("Results (2)")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(3);
  });

  it("records a result for a case that has none", async () => {
    const store = resultStore();
    await openDetail(store);

    fireEvent.click(screen.getByRole("button", { name: "Record result" }));
    const dialog = await screen.findByRole("dialog", { name: "Record result" });
    expect(
      within(dialog).queryByRole("form", { name: "Link defect form" }),
    ).not.toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText("Status"), {
      target: { value: "Passed" },
    });
    fireEvent.change(within(dialog).getByLabelText("Comment"), {
      target: { value: "  it holds  " },
    });
    fireEvent.change(within(dialog).getByLabelText("Duration (seconds)"), {
      target: { value: "2.5" },
    });
    fireEvent.submit(
      within(dialog).getByRole("form", { name: "Record result form" }),
    );

    await waitFor(() => {
      expect(store.resultPosts).toEqual([
        {
          testCaseId: "TC-LOGIN-2",
          status: "Passed",
          notes: "it holds",
          durationMs: 2500,
        },
      ]);
    });
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Record result" }),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByTestId("announcement")).toHaveTextContent(
      "Test result recorded in run",
    );
    // The run is read again, so the table reads the recorded result back.
    await screen.findByText("Passed");
  });

  it("pre-fills the form and resends every field when a result is edited", async () => {
    const store = resultStore();
    await openDetail(store);

    fireEvent.click(screen.getByRole("button", { name: "Edit result" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit result" });

    expect(within(dialog).getByLabelText("Status")).toHaveValue("Failed");
    expect(within(dialog).getByLabelText("Comment")).toHaveValue(
      "lock message missing",
    );
    expect(within(dialog).getByLabelText("Duration (seconds)")).toHaveValue(
      "0.8",
    );

    fireEvent.change(within(dialog).getByLabelText("Comment"), {
      target: { value: "the message now names the field" },
    });
    fireEvent.submit(
      within(dialog).getByRole("form", { name: "Save result form" }),
    );

    await waitFor(() => {
      expect(store.resultPosts).toEqual([
        {
          testCaseId: "TC-LOGIN-1",
          status: "Failed",
          notes: "the message now names the field",
          durationMs: 800,
          // The stored timestamp travels back, so an edit cannot re-date it.
          timestamp: "1789655960",
        },
      ]);
    });
    expect(screen.getByTestId("announcement")).toHaveTextContent(
      "Test result recorded in run",
    );
  });

  it("clears the comment and duration by leaving them out of the request", async () => {
    const store = resultStore();
    await openDetail(store);

    fireEvent.click(screen.getByRole("button", { name: "Edit result" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit result" });
    fireEvent.change(within(dialog).getByLabelText("Comment"), {
      target: { value: "  " },
    });
    fireEvent.change(within(dialog).getByLabelText("Duration (seconds)"), {
      target: { value: "" },
    });
    fireEvent.submit(
      within(dialog).getByRole("form", { name: "Save result form" }),
    );

    await waitFor(() => {
      expect(store.resultPosts).toEqual([
        {
          testCaseId: "TC-LOGIN-1",
          status: "Failed",
          timestamp: "1789655960",
        },
      ]);
    });
  });

  it("refuses a duration that is not a number of seconds", async () => {
    const store = resultStore();
    await openDetail(store);

    fireEvent.click(screen.getByRole("button", { name: "Record result" }));
    const dialog = await screen.findByRole("dialog", { name: "Record result" });
    const duration = within(dialog).getByLabelText("Duration (seconds)");
    fireEvent.change(duration, { target: { value: "2,5" } });
    fireEvent.submit(
      within(dialog).getByRole("form", { name: "Record result form" }),
    );

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Enter the duration in seconds, or leave it blank.",
    );
    expect(duration).toHaveAttribute("aria-invalid", "true");
    expect(store.resultPosts).toEqual([]);
    expect(
      screen.getByRole("dialog", { name: "Record result" }),
    ).toBeInTheDocument();
  });

  it("keeps the result form open when the API refuses to record", async () => {
    const store = resultStore();
    store.refusal = errorEnvelope(409, "conflict", "result already recorded");
    await openDetail(store);

    fireEvent.click(screen.getByRole("button", { name: "Record result" }));
    const dialog = await screen.findByRole("dialog", { name: "Record result" });
    fireEvent.submit(
      within(dialog).getByRole("form", { name: "Record result form" }),
    );

    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent("conflict");
    expect(
      screen.getByRole("dialog", { name: "Record result" }),
    ).toBeInTheDocument();
  });

  it("renders the defects a recorded result already links", async () => {
    const store = linkedStore();
    const { requests } = await openDetail(store);

    fireEvent.click(screen.getByRole("button", { name: "Edit result" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit result" });

    expect(
      within(dialog).getByRole("heading", { name: "Linked defects (1)" }),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("OPS-1")).toBeInTheDocument();
    expect(
      within(within(dialog).getByRole("listitem")).getByText("jira"),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Unlink OPS-1" }),
    ).toBeInTheDocument();
    // The links travel with the run document, so opening the form reads nothing.
    expect(requests.map((request) => request.url)).toEqual([
      "/api/test_runs/nightly.json",
    ]);
  });

  it("links a defect and reads the run again", async () => {
    const store = resultStore();
    const { requests } = await openDetail(store);

    fireEvent.click(screen.getByRole("button", { name: "Edit result" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit result" });
    const linkButton = within(dialog).getByRole("button", {
      name: "Link defect",
    });
    expect(linkButton).toBeDisabled();

    fireEvent.change(within(dialog).getByLabelText("Defect ID"), {
      target: { value: "OPS-1" },
    });
    fireEvent.change(within(dialog).getByLabelText("Defect URL"), {
      target: { value: "https://acme.atlassian.net/browse/OPS-1" },
    });
    fireEvent.click(linkButton);

    await waitFor(() => {
      expect(store.defectPosts).toEqual([
        {
          trackerType: "jira",
          defectId: "OPS-1",
          defectUrl: "https://acme.atlassian.net/browse/OPS-1",
        },
      ]);
    });
    expect(screen.getByTestId("announcement")).toHaveTextContent(
      "Defect linked to test result",
    );
    // The run is read again rather than the table being guessed at locally.
    await waitFor(() => {
      expect(
        requests.filter(
          (request) =>
            request.url === "/api/test_runs/nightly.json" &&
            request.method === "GET",
        ),
      ).toHaveLength(2);
    });
    expect(
      await within(dialog).findByRole("heading", {
        name: "Linked defects (1)",
      }),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Defect ID")).toHaveValue("");
    expect(within(dialog).getByLabelText("Defect URL")).toHaveValue("");
  });

  it("unlinks a defect by the link id it was given", async () => {
    const store = linkedStore();
    await openDetail(store);

    fireEvent.click(screen.getByRole("button", { name: "Edit result" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit result" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Unlink OPS-1" }));

    await waitFor(() => {
      expect(store.deletes).toEqual([
        "/api/test_runs/nightly.json/results/TC-LOGIN-1/defects/link-1",
      ]);
    });
    expect(screen.getByTestId("announcement")).toHaveTextContent(
      "Defect unlinked from test result",
    );
    expect(
      await within(dialog).findByRole("heading", {
        name: "Linked defects (0)",
      }),
    ).toBeInTheDocument();
  });

  it("refuses to re-record a result that holds a linked defect", async () => {
    const store = linkedStore();
    await openDetail(store);

    fireEvent.click(screen.getByRole("button", { name: "Edit result" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit result" });

    expect(
      within(dialog).getByText(/This result holds 1 linked defect\./),
    ).toBeInTheDocument();
    const save = within(dialog).getByRole("button", { name: "Save result" });
    expect(save).toBeDisabled();
    expect(save).toHaveAccessibleDescription(/TucanoTestAPI#284/);

    // A disabled button is not the only way in; the form refuses too.
    fireEvent.submit(
      within(dialog).getByRole("form", { name: "Save result form" }),
    );
    expect(store.resultPosts).toEqual([]);
  });

  it("releases the guard once the last linked defect is removed", async () => {
    const store = linkedStore();
    await openDetail(store);

    fireEvent.click(screen.getByRole("button", { name: "Edit result" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit result" });
    expect(
      within(dialog).getByRole("button", { name: "Save result" }),
    ).toBeDisabled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Unlink OPS-1" }));

    await waitFor(() => {
      expect(
        within(dialog).getByRole("button", { name: "Save result" }),
      ).toBeEnabled();
    });
    expect(
      within(dialog).queryByText(/TucanoTestAPI#284/),
    ).not.toBeInTheDocument();
  });

  it("has no accessibility violations with the result dialog open", async () => {
    const store = linkedStore();
    const { view } = await openDetail(store);

    fireEvent.click(screen.getByRole("button", { name: "Edit result" }));
    await screen.findByRole("dialog", { name: "Edit result" });

    const { default: axe } = await import("axe-core");
    const results = await axe.run(view.baseElement, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });
});
