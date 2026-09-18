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

interface ApiStore {
  run: Record<string, unknown>;
  puts: unknown[];
  posts: unknown[];
  deletes: string[];
  /** When set, the mutating routes answer this instead of succeeding. */
  refusal?: Response;
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
    if (url === "/api/test_runs/nightly.json" && method === "DELETE") {
      if (store.refusal) return store.refusal;
      store.deletes.push(url);
      return jsonResponse(200, { message: "Resource deleted" });
    }
    throw new Error(`Unexpected request: ${method} ${url}`);
  };
}

function emptyStore(run: Record<string, unknown> = RUN): ApiStore {
  return { run, puts: [], posts: [], deletes: [] };
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
});
