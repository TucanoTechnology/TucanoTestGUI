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

const FIREFOX = {
  configId: "firefox-win.json",
  name: "Firefox on Windows",
  browser: "firefox",
  os: "windows",
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

/** What the API answers an import with: imported 3, nothing left unwritten. */
const IMPORT_SUMMARY = {
  imported: 3,
  skipped: 3,
  errors: 1,
  duplicates: 2,
  summary: { passed: 2, failed: 1, blocked: 0 },
};

interface ApiStore {
  run: Record<string, unknown>;
  /** #182: the home project's inventories the membership routes offer. */
  projectCaseIds: string[];
  projectSuiteIds: string[];
  projectConfigIds: string[];
  /** Bodies posted to the add-case / add-suite / link routes, oldest first. */
  addCasePosts: unknown[];
  addSuitePosts: unknown[];
  configPosts: unknown[];
  /** Configurations unlinked, by the address the DELETE took. */
  configDeletes: string[];
  puts: unknown[];
  posts: unknown[];
  /** Bodies posted to the result route, oldest first. */
  resultPosts: unknown[];
  /** Bodies posted to the defect link route, oldest first. */
  defectPosts: unknown[];
  /** The case-level defect list #460 stores: what the defects route reads. */
  caseDefects: Record<string, unknown>[];
  /** The two import routes, oldest first, with the headers they were sent. */
  importPosts: {
    url: string;
    contentType: string | undefined;
    body: unknown;
  }[];
  deletes: string[];
  /** When set, the mutating routes answer this instead of succeeding. */
  refusal?: Response;
  /**
   * When set, reads of the run answer this instead, so a test can hold a
   * reload open and look at the panel while it is still in flight.
   */
  heldRunRead?: Promise<Response>;
}

/** Applies `update` to the result the run records for `caseId`. */

function checkoutApi(store: ApiStore) {
  return ({
    url,
    method,
    body,
    headers,
  }: RecordedRequest): Response | Promise<Response> => {
    if (/^\/api\/test_runs\/[^/]+$/.test(url) && method === "GET") {
      if (store.heldRunRead) return store.heldRunRead;
      return jsonResponse(200, store.run);
    }
    if (
      url === "/api/projects/checkout.json/configurations" &&
      method === "GET"
    ) {
      return jsonResponse(200, store.projectConfigIds);
    }
    const configMatch = /^\/api\/configurations\/([^/]+)$/.exec(url);
    if (configMatch && method === "GET") {
      return jsonResponse(
        200,
        configMatch[1] === "firefox-win.json" ? FIREFOX : CONFIGURATION,
      );
    }
    if (
      url === "/api/projects/checkout.json/test_cases" &&
      method === "GET"
    ) {
      return jsonResponse(200, store.projectCaseIds);
    }
    if (
      url === "/api/projects/checkout.json/test_suites" &&
      method === "GET"
    ) {
      return jsonResponse(200, store.projectSuiteIds);
    }
    if (url === "/api/test_runs/nightly.json/test_cases" && method === "POST") {
      const posted = body as { testCaseId: string };
      store.addCasePosts.push(body);
      store.run = {
        ...store.run,
        testCases: [
          ...(((store.run.testCases as Record<string, unknown>[]) ?? [])),
          { testCaseId: posted.testCaseId, title: `Added ${posted.testCaseId}` },
        ],
      };
      return jsonResponse(201, {
        message: "Test case added to run",
        id: posted.testCaseId,
      });
    }
    if (url === "/api/test_runs/nightly.json/test_suites" && method === "POST") {
      const posted = body as { suiteId: string };
      store.addSuitePosts.push(body);
      store.run = {
        ...store.run,
        testSuites: [
          ...(((store.run.testSuites as Record<string, unknown>[]) ?? [])),
          { suiteId: posted.suiteId, name: `Added ${posted.suiteId}` },
        ],
      };
      return jsonResponse(201, {
        message: "Test suite added to run",
        id: posted.suiteId,
      });
    }
    if (
      url === "/api/test_runs/nightly.json/configurations" &&
      method === "POST"
    ) {
      const posted = body as { configId: string };
      store.configPosts.push(body);
      store.run = {
        ...store.run,
        configurations: [
          ...(((store.run.configurations as Record<string, unknown>[]) ?? [])),
          posted.configId === "firefox-win.json" ? FIREFOX : CONFIGURATION,
        ],
      };
      return jsonResponse(201, {
        message: "Configuration linked to run",
        id: posted.configId,
      });
    }
    const configDeleteMatch =
      /^\/api\/test_runs\/nightly\.json\/configurations\/([^/]+)$/.exec(url);
    if (configDeleteMatch && method === "DELETE") {
      store.configDeletes.push(url);
      store.run = {
        ...store.run,
        configurations: (
          (store.run.configurations as Record<string, unknown>[]) ?? []
        ).filter((entry) => entry.configId !== configDeleteMatch[1]),
      };
      return jsonResponse(200, { message: "Configuration unlinked from run" });
    }
    if (url === "/api/test_runs/nightly.json" && method === "PUT") {
      if (store.refusal) return store.refusal;
      store.puts.push(body);
      store.run = { ...store.run, ...(body as Record<string, unknown>) };
      // #459: the stored document rides back.
      return jsonResponse(200, { message: "Resource updated", document: store.run });
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
      const stored = (
        (store.run.results as Record<string, unknown>[]).find(
          (result) => result.testCaseId === posted.testCaseId,
        ) ?? {}
      );
      return jsonResponse(200, {
        message: "Test result recorded in run",
        result: stored,
      });
    }

    // #460: the list lives on the case; the route reads it from there.
    const listMatch =
      /^\/api\/test_runs\/nightly\.json\/results\/([^/]+)\/defects$/.exec(url);
    if (listMatch && method === "GET") {
      return jsonResponse(200, { defects: store.caseDefects });
    }

    const linkMatch =
      /^\/api\/test_runs\/nightly\.json\/results\/([^/]+)\/defects$/.exec(url);
    if (linkMatch && method === "POST") {
      if (store.refusal) return store.refusal;
      const posted = body as {
        defectId: string;
        defectUrl: string;
        trackerType: string;
      };
      store.defectPosts.push(body);
      // The link lands on the case document, not the run (#460).
      store.caseDefects.push({
        linkId: `link-${store.caseDefects.length + 1}`,
        linkedAt: "1789655960",
        ...posted,
      });
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
      const linkId = unlinkMatch[2] ?? "";
      store.deletes.push(url);
      store.caseDefects = store.caseDefects.filter(
        (link) => link.linkId !== linkId,
      );
      return jsonResponse(200, { message: "Defect unlinked from test result" });
    }

    if (url === "/api/test_runs/nightly.json" && method === "DELETE") {
      if (store.refusal) return store.refusal;
      store.deletes.push(url);
      return jsonResponse(200, { message: "Resource deleted" });
    }

    const importMatch =
      /^\/api\/test_runs\/nightly\.json\/import\/(json|junit)$/.exec(url);
    if (importMatch && method === "POST") {
      if (store.refusal) return store.refusal;
      store.importPosts.push({
        url,
        contentType: headers["content-type"],
        body,
      });
      return jsonResponse(200, IMPORT_SUMMARY);
    }
    throw new Error(`Unexpected request: ${method} ${url}`);
  };
}

function emptyStore(run: Record<string, unknown> = RUN): ApiStore {
  return {
    run,
    projectCaseIds: ["TC-LOGIN-1", "TC-LOGIN-2"],
    projectSuiteIds: ["smoke.checkout.json", "regress.checkout.json"],
    projectConfigIds: ["chrome-linux.json", "firefox-win.json"],
    addCasePosts: [],
    addSuitePosts: [],
    configPosts: [],
    configDeletes: [],
    puts: [],
    posts: [],
    resultPosts: [],
    defectPosts: [],
    caseDefects: [],
    importPosts: [],
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

/** `resultStore` whose CASE carries a defect link (#460). */
function linkedStore(): ApiStore {
  const store = emptyStore({
    ...RUN,
    testCases: [
      { testCaseId: "TC-LOGIN-1", title: "Log in" },
      { testCaseId: "TC-LOGIN-2", title: "Reject a bad password" },
    ],
    results: [{ ...RECORDED_RESULT }],
  });
  store.caseDefects.push({ ...DEFECT });
  return store;
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

/** The detail panel splits into tabs; a section's controls exist once open. */
function openRunTab(name: "Cases" | "Import") {
  fireEvent.click(screen.getByRole("tab", { name }));
}

async function openEdit() {
  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
  return screen.findByRole("form", { name: "Save changes form" });
}

/** Picks `contents` as a file named `filename`, as a file control receives it. */
function pickFile(
  label: string,
  filename: string,
  contents: string,
  type: string,
) {
  const file = new File([contents], filename, { type });
  fireEvent.change(screen.getByLabelText(label), {
    target: { files: [file] },
  });
}

/** The import section stating the summary of the file just imported. */
async function importedSection(filename: string): Promise<HTMLElement> {
  const source = await screen.findByText(`Imported from ${filename}`);
  const section = source.closest<HTMLElement>(".import-section");
  if (!section) throw new Error("The summary is not inside an import section");
  return section;
}

/** The summary's label/value rows, in the order the section states them. */
function summaryRows(section: HTMLElement) {
  return Array.from(section.querySelectorAll(".import-summary__stat")).map(
    (stat) => [
      stat.querySelector(".import-summary__stat-label")?.textContent,
      stat.querySelector(".import-summary__stat-value")?.textContent,
    ],
  );
}

/**
 * Leaves reads of the run unanswered until the returned function runs, so a
 * test can look at the panel while a reload is still in flight. The answer is
 * built when it is released, so it carries whatever the run holds by then.
 */
function holdRunRead(store: ApiStore): () => void {
  let release = () => {};
  store.heldRunRead = new Promise<Response>((resolve) => {
    release = () => resolve(jsonResponse(200, store.run));
  });
  return release;
}

afterEach(() => {
  resetTestApi();
});

describe("RunDetail", () => {
  it("renders the run document", async () => {
    const store = emptyStore();
    const { view, requests } = await openDetail(store);

    expect(screen.getByText("Run ID: nightly.json")).toBeInTheDocument();
    // The stored epoch seconds are shown as a readable date, never raw (#162).
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
    expect(screen.getByText("nightly")).toBeInTheDocument();
    // The run's own copy of the configuration names it, without a second read.
    // #182: the field lists every linked configuration, not just the first.
    expect(screen.getByText("Configurations (1)")).toBeInTheDocument();
    // The list names what the run stored — the snapshot's own name, read
    // without re-fetching the configuration document.
    expect(screen.getByText("chrome-linux")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Unlink" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Projects (1)")).toBeInTheDocument();
    expect(screen.getByText("Suites (1)")).toBeInTheDocument();
    expect(screen.getByText("Results (1)")).toBeInTheDocument();
    expect(screen.getByText("passed")).toBeInTheDocument();

    // The run read plus the #182 membership inventories of its home project;
    // the run's own configuration is not re-read, the snapshot names it.
    expect(requests.map((request) => request.url)).toEqual([
      "/api/test_runs/nightly.json",
      "/api/projects/checkout.json/test_cases",
      "/api/projects/checkout.json/test_suites",
      "/api/projects/checkout.json/configurations",
      "/api/configurations/chrome-linux.json",
      "/api/configurations/firefox-win.json",
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

  it("reads the home project's inventories for the membership controls (#182)", async () => {
    const store = emptyStore();
    const { requests } = await openDetail(store);
    // The run read plus the three listings and the configuration documents
    // the link control offers. The table itself still costs no extra read.
    expect(requests.map((request) => request.url)).toEqual([
      "/api/test_runs/nightly.json",
      "/api/projects/checkout.json/test_cases",
      "/api/projects/checkout.json/test_suites",
      "/api/projects/checkout.json/configurations",
      "/api/configurations/chrome-linux.json",
      "/api/configurations/firefox-win.json",
    ]);

    const form = await openEdit();

    expect(within(form).getByLabelText("Name")).toHaveValue("Nightly run");
    expect(within(form).getByLabelText("Configuration")).toHaveValue(
      "chrome-linux.json",
    );
    // The option label comes from the configuration document, not the run.
    expect(
      within(form).getByRole("option", { name: "Chrome on Linux" }),
    ).toBeInTheDocument();
    // The edit form re-reads the configurations for its own select.
    expect(requests.map((request) => request.url).slice(6)).toEqual([
      "/api/projects/checkout.json/configurations",
      "/api/configurations/chrome-linux.json",
      "/api/configurations/firefox-win.json",
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
    expect(store.posts).toEqual([{ newId: "nightly-copy.json" }]);
    expect(screen.getByTestId("announcement")).toHaveTextContent(
      "Test run duplicated",
    );
  });

  it("states the .json rule and adds a missing suffix to a typed run id", async () => {
    const store = emptyStore();
    await openDetail(store);

    fireEvent.click(screen.getByRole("button", { name: "Duplicate" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Duplicate test run",
    });
    const idField = within(dialog).getByLabelText("New run ID");
    // The rule the API enforces is stated, so the field does not read as
    // "type any name".
    expect(idField).toHaveAccessibleDescription(/ending in \.json/);

    // A bare name is completed before it is sent, so it cannot be refused with
    // an opaque `Invalid request`.
    fireEvent.change(idField, { target: { value: "audit-run-sweep-copy" } });
    fireEvent.submit(
      within(dialog).getByRole("form", { name: "Duplicate test run form" }),
    );

    await waitFor(() => {
      expect(store.posts).toEqual([{ newId: "audit-run-sweep-copy.json" }]);
    });
  });

  it("leaves a run id that already ends in .json alone", async () => {
    const store = emptyStore();
    await openDetail(store);

    fireEvent.click(screen.getByRole("button", { name: "Duplicate" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Duplicate test run",
    });
    fireEvent.change(within(dialog).getByLabelText("New run ID"), {
      target: { value: " weekly-checkout.json " },
    });
    fireEvent.submit(
      within(dialog).getByRole("form", { name: "Duplicate test run form" }),
    );

    await waitFor(() => {
      expect(store.posts).toEqual([{ newId: "weekly-checkout.json" }]);
    });
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
    expect(
      screen.getByRole("combobox", { name: "Status for TC-LOGIN-1" }),
    ).toHaveValue("Failed");
    expect(screen.getByText("lock message missing")).toBeInTheDocument();
    expect(screen.getByText("800 ms")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit result" })).toBeInTheDocument();
    // …and the second is untested, with nothing recorded to edit.
    expect(
      screen.getByRole("combobox", { name: "Status for TC-LOGIN-2" }),
    ).toHaveValue("Untested");
    expect(
      screen.getByRole("button", { name: "Record result" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(3);

    // The table is built from the run document; the only other reads are
    // the #182 inventories the membership controls offer.
    expect(requests.map((request) => request.url)).toEqual([
      "/api/test_runs/nightly.json",
      "/api/projects/checkout.json/test_cases",
      "/api/projects/checkout.json/test_suites",
      "/api/projects/checkout.json/configurations",
      "/api/configurations/chrome-linux.json",
      "/api/configurations/firefox-win.json",
    ]);
  });

  it("records a status inline from the results table, preserving the fields", async () => {
    const store = resultStore();
    await openDetail(store);

    // The recorded row exposes a dropdown rather than a badge…
    const select = screen.getByRole("combobox", {
      name: "Status for TC-LOGIN-1",
    });
    fireEvent.change(select, { target: { value: "Blocked" } });

    await waitFor(() => {
      expect(store.resultPosts).toEqual([
        {
          testCaseId: "TC-LOGIN-1",
          status: "Blocked",
          notes: "lock message missing",
          durationMs: 800,
          // The stored timestamp travels back, so an inline status change
          // cannot quietly re-date the result.
          timestamp: "1789655960",
        },
      ]);
    });
    // …and the re-read shows the new status where the old one stood.
    await waitFor(() => {
      expect(
        screen.getByRole("combobox", { name: "Status for TC-LOGIN-1" }),
      ).toHaveValue("Blocked");
    });
  });

  it("keeps a status outside the recorded five visible and dialog-only", async () => {
    mockApi(
      checkoutApi(
        emptyStore({
          ...RUN,
          results: [
            { ...RECORDED_RESULT, status: "passed", defectLinks: [], attachments: [] },
          ],
        }),
      ),
    );
    renderDetail();

    await screen.findByRole("heading", { name: "Nightly run" });
    // A hand-stored value is rendered as it stands; no select misrepresents it.
    expect(screen.getByText("passed")).toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Status for TC-LOGIN-1" }),
    ).not.toBeInTheDocument();
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
    await waitFor(() => {
      expect(
        screen.getByRole("combobox", { name: "Status for TC-LOGIN-2" }),
      ).toHaveValue("Passed");
    });
  });

  it("Pass & next records Passed and moves to the next case awaiting execution", async () => {
    // #184: the dominant flow — record, and land on the next case without
    // touching the table again between the two.
    const store = resultStore();
    await openDetail(store);

    fireEvent.click(screen.getByRole("button", { name: "Edit result" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit result" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Pass & next" }));

    await waitFor(() => {
      expect(store.resultPosts).toHaveLength(1);
    });
    expect(store.resultPosts[0]).toMatchObject({
      testCaseId: "TC-LOGIN-1",
      status: "Passed",
    });

    // The dialog never closed: it is now the record form for the next case,
    // and the transition was announced.
    await waitFor(() => {
      expect(
        screen.getByRole("dialog", { name: "Record result" }),
      ).toBeInTheDocument();
    });
    expect(screen.getByTestId("announcement")).toHaveTextContent(
      "Recorded Passed for TC-LOGIN-1. Now recording TC-LOGIN-2 — Reject a bad password.",
    );
    // Focus followed the form (#184): the new case's status select holds it.
    expect(
      within(screen.getByRole("dialog", { name: "Record result" })).getByRole(
        "combobox",
        { name: "Status" },
      ),
    ).toHaveFocus();

    // One more pass empties the run: the second advance records the last
    // case and closes, announcing the end of the walk.
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "Record result" })).getByRole(
        "button",
        { name: "Pass & next" },
      ),
    );
    await waitFor(() => {
      expect(store.resultPosts).toHaveLength(2);
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(screen.getByTestId("announcement")).toHaveTextContent(
      "Recorded Passed for TC-LOGIN-2. That was the last case awaiting execution.",
    );
  });

  it("links and unlinks configurations independently of each other (#182)", async () => {
    const store = emptyStore(RUN); // RUN links chrome-linux at creation.
    await openDetail(store);

    expect(await screen.findByText("Configurations (1)")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Unlink" }));
    await waitFor(() => {
      expect(store.configDeletes).toEqual([
        "/api/test_runs/nightly.json/configurations/chrome-linux.json",
      ]);
    });
    await waitFor(() => {
      expect(screen.getByText("Configurations (0)")).toBeInTheDocument();
    });

    // The unlinked one and the project's other configuration are both now
    // linkable; linking does not go through the edit form at all.
    const select = screen.getByLabelText("Link configuration");
    expect(
      within(select).getByRole("option", { name: "Firefox on Windows" }),
    ).toBeInTheDocument();
    expect(
      within(select).getByRole("option", { name: "Chrome on Linux" }),
    ).toBeInTheDocument();
    fireEvent.change(select, { target: { value: "firefox-win.json" } });
    fireEvent.click(screen.getByRole("button", { name: "Link" }));

    await waitFor(() => {
      expect(store.configPosts).toEqual([{ configId: "firefox-win.json" }]);
    });
    await waitFor(() => {
      expect(screen.getByText("Configurations (1)")).toBeInTheDocument();
    });
    expect(screen.getByText("Firefox on Windows")).toBeInTheDocument();
    // The linked one leaves the offer; the unlinked one stays in it.
    expect(
      within(screen.getByLabelText("Link configuration")).queryByRole(
        "option",
        { name: "Firefox on Windows" },
      ),
    ).not.toBeInTheDocument();
    // The linked configuration is still announced through its own list entry.
    expect(screen.getByTestId("announcement")).toHaveTextContent(
      "firefox-win.json linked to the run.",
    );
  });

  it("adds a case and a suite from the home project without touching the snapshot", async () => {
    const store = resultStore();
    store.projectCaseIds = ["TC-LOGIN-1", "TC-LOGIN-2", "TC-PAY-1"];
    await openDetail(store);

    const caseSelect = await screen.findByLabelText("Add case");
    // Held cases (both declaration and recorded-result routes) are not
    // offered: only the project case the run has never seen.
    expect(
      within(caseSelect).queryByRole("option", { name: "TC-LOGIN-1" }),
    ).not.toBeInTheDocument();
    fireEvent.change(caseSelect, { target: { value: "TC-PAY-1" } });
    fireEvent.click(
      screen.getByRole("button", { name: "Add case to the run" }),
    );
    await waitFor(() => {
      expect(store.addCasePosts).toEqual([{ testCaseId: "TC-PAY-1" }]);
    });

    // The added case lands as an Untested row beside the existing state —
    // the recorded result on TC-LOGIN-1 survives the refresh untouched.
    await waitFor(() => {
      expect(screen.getByText("Results (3)")).toBeInTheDocument();
    });
    expect(screen.getByText("TC-PAY-1")).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Status for TC-LOGIN-1" }),
    ).toHaveValue("Failed");
    expect(screen.getByTestId("announcement")).toHaveTextContent(
      "TC-PAY-1 added to the run.",
    );
    // The held set is recomputed from the refreshed run: it is no longer
    // offered.
    expect(
      within(screen.getByLabelText("Add case")).queryByRole("option", {
        name: "TC-PAY-1",
      }),
    ).not.toBeInTheDocument();

    // Suites the same way: the run holds smoke, so regress is the offer.
    const suiteSelect = screen.getByLabelText("Add suite");
    fireEvent.change(suiteSelect, { target: { value: "regress.checkout.json" } });
    fireEvent.click(
      screen.getByRole("button", { name: "Add suite to the run" }),
    );
    await waitFor(() => {
      expect(store.addSuitePosts).toEqual([{ suiteId: "regress.checkout.json" }]);
    });
    await waitFor(() => {
      expect(screen.getByText("Suites (2)")).toBeInTheDocument();
    });
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

  it("renders the defects the CASE links, fetched when the form opens", async () => {
    const store = linkedStore();
    const { requests } = await openDetail(store);

    fireEvent.click(screen.getByRole("button", { name: "Edit result" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit result" });

    expect(
      await within(dialog).findByRole("heading", { name: "Linked defects (1)" }),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("OPS-1")).toBeInTheDocument();
    expect(
      within(within(dialog).getByRole("listitem")).getByText("jira"),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Unlink OPS-1" }),
    ).toBeInTheDocument();
    // #460: the list is the case's, fetched from the defects route; the run
    // document carries nothing to read.
    expect(
      requests.map((request) => request.url.split("/").slice(-2).join("/")),
    ).toContain("TC-LOGIN-1/defects");
  });

  it("links a defect onto the case and re-reads the list, not the run", async () => {
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
    // #460: the link wrote the case document — the defect list is what gets
    // re-read; the (much larger) run document is read exactly once.
    await waitFor(() => {
      expect(
        requests.filter(
          (request) =>
            request.url.endsWith("/defects") && request.method === "GET",
        ),
      ).toHaveLength(2);
    });
    expect(
      requests.filter(
        (request) =>
          request.url === "/api/test_runs/nightly.json" &&
          request.method === "GET",
      ),
    ).toHaveLength(1);
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

  it("records a result whose case links defects — the link lives beyond the result", async () => {
    const store = linkedStore();
    const { requests } = await openDetail(store);

    fireEvent.click(screen.getByRole("button", { name: "Edit result" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit result" });
    // #460 made the guard this replaced obsolete: a recording cannot touch
    // what no result field holds any more.
    const save = within(dialog).getByRole("button", { name: "Save result" });
    expect(save).toBeEnabled();

    fireEvent.change(within(dialog).getByLabelText("Status"), {
      target: { value: "Passed" },
    });
    fireEvent.submit(within(dialog).getByRole("form", { name: "Save result form" }));

    await waitFor(() => {
      expect(store.resultPosts).toHaveLength(1);
    });
    // The echoed result updates the row in place: the run is read exactly
    // once (the open), and the case's list stands where it was.
    expect(
      requests.filter(
        (request) =>
          request.url === "/api/test_runs/nightly.json" &&
          request.method === "GET",
      ),
    ).toHaveLength(1);
    expect(store.caseDefects).toHaveLength(1);
    expect(
      await screen.findByRole("combobox", { name: "Status for TC-LOGIN-1" }),
    ).toHaveValue("Passed");
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

  it("imports a JSON results file and states what the import wrote", async () => {
    const store = resultStore();
    const { requests } = await openDetail(store);
    openRunTab("Import");

    pickFile(
      "Import JSON results",
      "nightly-results.json",
      JSON.stringify([
        { testCaseId: "TC-LOGIN-2", status: "Passed", notes: "second run" },
      ]),
      "application/json",
    );

    await waitFor(() => {
      expect(store.importPosts).toEqual([
        {
          url: "/api/test_runs/nightly.json/import/json",
          contentType: "application/json",
          body: [
            { testCaseId: "TC-LOGIN-2", status: "Passed", notes: "second run" },
          ],
        },
      ]);
    });

    // Every count the summary carries is stated under the file it came from.
    expect(summaryRows(await importedSection("nightly-results.json"))).toEqual([
      ["Imported", "3"],
      ["Skipped", "3"],
      ["Passed", "2"],
      ["Failed", "1"],
      ["Blocked", "0"],
      ["Already recorded", "2"],
      ["Unusable", "1"],
    ]);
    expect(screen.getByTestId("announcement")).toHaveTextContent(
      "Imported 3 results: 2 passed, 1 failed, 0 blocked. Skipped 3: 2 already recorded, 1 unusable.",
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
  });

  it("posts a JUnit report to the XML route as the report stands", async () => {
    const store = resultStore();
    await openDetail(store);
    openRunTab("Import");

    const report =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<testsuite name="smoke">\n' +
      '  <testcase name="TC-LOGIN-2 &amp; co" />\n' +
      '  <testcase name="TC-LOGIN-3"><failure>timed out</failure></testcase>\n' +
      "</testsuite>";

    pickFile(
      "Import JUnit XML results",
      "nightly-junit.xml",
      report,
      "application/xml",
    );

    await waitFor(() => {
      expect(store.importPosts).toEqual([
        {
          url: "/api/test_runs/nightly.json/import/junit",
          contentType: "application/xml",
          body: report,
        },
      ]);
    });
    expect(
      await importedSection("nightly-junit.xml"),
    ).toBeInTheDocument();
  });

  it("refuses a picked file that is not JSON without reaching the API", async () => {
    const store = resultStore();
    const { requests } = await openDetail(store);
    openRunTab("Import");

    pickFile(
      "Import JSON results",
      "results.json",
      "not json",
      "application/json",
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("The file is not valid JSON.");
    // The refusal belongs to the control that caused it, not to the panel.
    expect(alert.closest(".import-section")).not.toBeNull();
    expect(requests.filter((request) => request.method === "POST")).toEqual([]);
    expect(screen.queryByText(/^Imported from /)).not.toBeInTheDocument();
  });

  it("states the API refusal in place of the summary it replaced", async () => {
    const store = resultStore();
    await openDetail(store);
    openRunTab("Import");

    pickFile(
      "Import JSON results",
      "nightly-results.json",
      "[]",
      "application/json",
    );
    await importedSection("nightly-results.json");

    store.refusal = errorEnvelope(
      400,
      "invalid_request",
      "an entry omits testCaseId",
    );
    pickFile("Import JSON results", "second.json", "[]", "application/json");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("invalid_request");
    expect(alert).toHaveTextContent("an entry omits testCaseId");
    // The counts on screen are only ever the ones an import that succeeded wrote.
    expect(
      screen.queryByText("Imported from nightly-results.json"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Imported from second.json")).not.toBeInTheDocument();
  });

  it("has no accessibility violations with an import summary on screen", async () => {
    const store = resultStore();
    const { view } = await openDetail(store);
    openRunTab("Import");

    pickFile(
      "Import JSON results",
      "nightly-results.json",
      "[]",
      "application/json",
    );
    await importedSection("nightly-results.json");

    const { default: axe } = await import("axe-core");
    const results = await axe.run(view.baseElement, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });

  it("keeps the summary on screen while the run is read again", async () => {
    const store = resultStore();
    const { requests } = await openDetail(store);
    openRunTab("Import");
    // The read an import triggers is held open, so the panel is inspected at
    // the moment a real API would still be answering it.
    const release = holdRunRead(store);
    const reads = () =>
      requests.filter(
        (request) =>
          request.url === "/api/test_runs/nightly.json" &&
          request.method === "GET",
      );

    pickFile(
      "Import JSON results",
      "nightly-results.json",
      "[]",
      "application/json",
    );

    // The reload is already under way, and the panel was not swapped for a
    // spinner: the summary a section owns is still there with the read in
    // flight, and stays there once it lands.
    await waitFor(() => expect(reads()).toHaveLength(2));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(
      screen.getByText("Imported from nightly-results.json"),
    ).toBeInTheDocument();

    // The answered read carries a renamed run, so its landing can be waited
    // for, and the state the section owns can be checked after it.
    store.run = { ...store.run, name: "Nightly run again" };
    release();
    const section = await importedSection("nightly-results.json");
    await screen.findByRole("heading", { name: "Nightly run again" });

    expect(screen.getByText("Imported from nightly-results.json")).toBeInTheDocument();
    expect(summaryRows(section)).toEqual([
      ["Imported", "3"],
      ["Skipped", "3"],
      ["Passed", "2"],
      ["Failed", "1"],
      ["Blocked", "0"],
      ["Already recorded", "2"],
      ["Unusable", "1"],
    ]);
  });

  it("blanks the panel while a different run is read", async () => {
    const store = resultStore();
    const { view } = await openDetail(store);
    const release = holdRunRead(store);

    // The detail pane keeps the component for as long as it shows this kind of
    // entity, so a run selected in its place has no document yet: the panel it
    // blanks is the previous run's, which must not stand in for the new one.
    view.rerender(
      <AuthProvider>
        <ProjectProvider>
          <Harness runId="smoke.json" />
        </ProjectProvider>
      </AuthProvider>,
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Nightly run" }),
    ).not.toBeInTheDocument();

    release();
    await screen.findByRole("heading", { name: "Nightly run" });
  });
});
