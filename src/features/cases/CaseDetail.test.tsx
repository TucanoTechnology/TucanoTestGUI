import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TestCase } from "../../api/generated/index.js";
import { AuthProvider } from "../../app/AuthProvider.js";
import {
  ProjectProvider,
  useProjectContext,
} from "../../app/ProjectContext.js";
import {
  errorEnvelope,
  jsonResponse,
  mockApi,
  resetTestApi,
} from "../../test-utils.js";
import { CaseDetail } from "./CaseDetail.js";

const FIRST_STEP = {
  action: "Open the sign-in page",
  expectedResult: "The form is shown",
};

const SECOND_STEP = { action: "Enter the credentials" };

/** The name the API stores an upload under: the epoch it arrived at, then the name it carried. */
function storedName(originalName: string) {
  return `1699999999999999999-${originalName}`;
}

const ATTACHMENT = {
  filename: storedName("login-notes.txt"),
  originalName: "login-notes.txt",
  mimeType: "text/plain",
  size: 1234,
};

const IMAGE_ATTACHMENT = {
  filename: storedName("login.png"),
  originalName: "login.png",
  mimeType: "image/png",
  size: 75,
};

const STEP_ATTACHMENT = {
  filename: storedName("step-notes.pdf"),
  originalName: "step-notes.pdf",
  mimeType: "application/pdf",
  size: 512,
};

const CASE: TestCase = {
  testCaseId: "TC-LOGIN-1",
  title: "Sign in with a registered account",
  description: "A registered shopper signs in.",
  preconditions: "The shopper has an account.",
  priority: "Critical",
  severity: "Major",
  tags: ["smoke", "auth"],
  steps: [FIRST_STEP],
  expectedResult: "The account page loads",
  attachments: [ATTACHMENT],
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

function projectWith(testCases: TestCase[]) {
  return {
    ...PROJECT,
    testSuites: [{ suiteId: "smoke.checkout", name: "Smoke", testCases }],
  };
}

/**
 * The detail panel follows the context selection the way the shell drives it:
 * deleting a case clears the selection, and the probe reports what the panel
 * announced and what is selected now.
 */
function Harness({ caseId, projectId }: { caseId: string; projectId?: string }) {
  const { selection, setSelection, announcement } = useProjectContext();

  useEffect(() => {
    setSelection({ type: "case", id: caseId, projectId });
  }, [caseId, projectId, setSelection]);

  return (
    <nav aria-label="Case detail probe">
      <span data-testid="announcement">{announcement?.message ?? ""}</span>
      <span data-testid="selection">
        {selection ? `${selection.type}:${selection.id}` : "none"}
      </span>
      {selection?.type === "case" && (
        <CaseDetail caseId={selection.id} projectId={selection.projectId} />
      )}
    </nav>
  );
}

function renderDetail(props: { caseId: string; projectId?: string }) {
  return render(
    <AuthProvider>
      <ProjectProvider>
        <Harness caseId={props.caseId} projectId={props.projectId} />
      </ProjectProvider>
    </AuthProvider>,
  );
}

async function openDetail(props: { caseId: string; projectId?: string }) {
  const view = renderDetail(props);
  await screen.findByRole("heading", {
    name: "Sign in with a registered account",
  });
  return view;
}

const CASE_ATTACHMENTS = "/api/test_cases/TC-LOGIN-1/attachments";
const STEP_ATTACHMENTS = "/api/test_cases/TC-LOGIN-1/steps/0/attachments";

/** The stored bytes of an attachment, labelled with the type it was stored under. */
function fileResponse(mimeType: string) {
  const magic = mimeType === "image/png" ? [137, 80, 78, 71] : [37, 80, 68, 70];
  return new Response(new Uint8Array(magic), {
    status: 200,
    headers: { "Content-Type": mimeType },
  });
}

/** The attachment an upload part carries, as the API records it. */
function uploadOf(formData?: FormData) {
  const file = formData?.get("file");
  if (!(file instanceof File)) return null;
  return {
    filename: storedName(file.name),
    originalName: file.name,
    mimeType: file.type,
    size: file.size,
  };
}

/**
 * The case routes a detail panel reaches, over a project storing the cases the
 * test mutates, so the re-fetch after a mutation reads back what was stored.
 */
function mockCaseApi(initial: TestCase[] = [CASE]) {
  const state = { cases: initial };

  const requests = mockApi(({ url, method, body, formData }) => {
    if (url === "/api/projects/checkout" && method === "GET") {
      return jsonResponse(200, projectWith(state.cases));
    }
    if (url === "/api/test_cases/TC-LOGIN-1" && method === "PUT") {
      state.cases = state.cases.map((testCase, index) =>
        index === 0
          ? ({ ...testCase, ...(body as Partial<TestCase>) } as TestCase)
          : testCase,
      );
      return jsonResponse(200, { message: "Test case updated" });
    }
    if (url === "/api/test_cases/TC-LOGIN-1" && method === "DELETE") {
      state.cases = [];
      return jsonResponse(200, { message: "Test case deleted" });
    }
    if (url === "/api/test_cases/TC-LOGIN-1/duplicate" && method === "POST") {
      const options = (body ?? {}) as { newId?: string; newTitle?: string };
      const source = state.cases[0] ?? CASE;
      const copy: TestCase = {
        ...source,
        testCaseId: options.newId ?? "TC-LOGIN-1-copy",
      };
      if (options.newTitle) copy.title = options.newTitle;
      state.cases = [...state.cases, copy];
      return jsonResponse(201, {
        message: "Test case duplicated",
        id: copy.testCaseId,
      });
    }
    if (url === CASE_ATTACHMENTS && method === "POST") {
      const attachment = uploadOf(formData);
      if (!attachment) {
        return errorEnvelope(400, "missing_file", "No file uploaded");
      }
      state.cases = state.cases.map((testCase, index) =>
        index === 0
          ? {
              ...testCase,
              attachments: [...(testCase.attachments ?? []), attachment],
            }
          : testCase,
      );
      return jsonResponse(201, {
        message: "File uploaded successfully",
        filename: attachment.filename,
        originalName: attachment.originalName,
        size: attachment.size,
      });
    }
    if (url.startsWith(`${CASE_ATTACHMENTS}/`) && method === "GET") {
      const filename = decodeURIComponent(
        url.slice(CASE_ATTACHMENTS.length + 1),
      );
      const attachment = (state.cases[0]?.attachments ?? []).find(
        (stored) => stored.filename === filename,
      );
      return attachment
        ? fileResponse(attachment.mimeType)
        : errorEnvelope(404, "not_found", "Attachment not found");
    }
    if (url.startsWith(`${CASE_ATTACHMENTS}/`) && method === "DELETE") {
      const filename = decodeURIComponent(
        url.slice(CASE_ATTACHMENTS.length + 1),
      );
      state.cases = state.cases.map((testCase, index) =>
        index === 0
          ? {
              ...testCase,
              attachments: (testCase.attachments ?? []).filter(
                (stored) => stored.filename !== filename,
              ),
            }
          : testCase,
      );
      return jsonResponse(200, { message: "File deleted successfully" });
    }
    if (url === STEP_ATTACHMENTS && method === "POST") {
      const attachment = uploadOf(formData);
      if (!attachment) {
        return errorEnvelope(400, "missing_file", "No file uploaded");
      }
      state.cases = state.cases.map((testCase, index) => {
        if (index !== 0) return testCase;
        const steps = (testCase.steps ?? []).map((step, stepIndex) =>
          stepIndex === 0 && typeof step !== "string"
            ? { ...step, attachments: [...(step.attachments ?? []), attachment] }
            : step,
        );
        return { ...testCase, steps };
      });
      return jsonResponse(201, {
        message: "File uploaded successfully",
        filename: attachment.filename,
        originalName: attachment.originalName,
        size: attachment.size,
      });
    }
    if (url.startsWith(`${STEP_ATTACHMENTS}/`) && method === "DELETE") {
      const filename = decodeURIComponent(
        url.slice(STEP_ATTACHMENTS.length + 1),
      );
      state.cases = state.cases.map((testCase, index) => {
        if (index !== 0) return testCase;
        const steps = (testCase.steps ?? []).map((step, stepIndex) =>
          stepIndex === 0 && typeof step !== "string"
            ? {
                ...step,
                attachments: (step.attachments ?? []).filter(
                  (stored) => stored.filename !== filename,
                ),
              }
            : step,
        );
        return { ...testCase, steps };
      });
      return jsonResponse(200, { message: "File deleted successfully" });
    }
    throw new Error(`Unexpected request: ${method} ${url}`);
  });

  return { requests, state };
}

/**
 * jsdom's Blob lacks `stream`, and the API client treats a multipart part as a
 * file only when it has one: without this, a picked file is sent as JSON. Every
 * real browser has it, so the gap is jsdom's, not the app's.
 */
if (typeof Blob.prototype.stream !== "function") {
  Object.assign(Blob.prototype, {
    stream(this: Blob) {
      return new ReadableStream<Uint8Array>({
        start: async (controller) => {
          controller.enqueue(new Uint8Array(await this.arrayBuffer()));
          controller.close();
        },
      });
    },
  });
}

let objectUrlCount = 0;
const createObjectURL = vi.fn((_blob: Blob) => `blob:attachment-${++objectUrlCount}`);
const revokeObjectURL = vi.fn((_url: string) => {});
/** The anchors the download path clicked; jsdom has nowhere to navigate to. */
const anchorClicks: Array<{ href: string; download: string }> = [];

beforeEach(() => {
  objectUrlCount = 0;
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
  anchorClicks.length = 0;
  // jsdom implements neither, and the bytes behind the token have to reach the
  // browser through an object URL.
  Object.assign(URL, { createObjectURL, revokeObjectURL });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    anchorClicks.push({ href: this.href, download: this.download });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
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
    expect(screen.getByText("Major")).toBeInTheDocument();
    expect(screen.getByText("smoke")).toBeInTheDocument();
    expect(screen.getByText("Open the sign-in page")).toBeInTheDocument();
    expect(screen.getByText("→ The form is shown")).toBeInTheDocument();
    expect(screen.getByText("The account page loads")).toBeInTheDocument();
    expect(screen.getByText("login-notes.txt")).toBeInTheDocument();
    expect(screen.getByText("1234 bytes · text/plain")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Upload attachment to this case"),
    ).toBeInTheDocument();

    // A non-image is listed and offered as a download: nothing is fetched until
    // the operator asks for it.
    expect(screen.getByRole("button", { name: "Download login-notes.txt" }))
      .toBeInTheDocument();

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

  it("sends only the changed fields when editing a case", async () => {
    const { requests } = mockCaseApi();

    await openDetail({ caseId: "TC-LOGIN-1", projectId: "checkout" });
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    const form = await screen.findByRole("form", { name: "Save changes form" });
    fireEvent.change(within(form).getByLabelText("Title"), {
      target: { value: "Sign in with a confirmed account" },
    });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.queryByRole("form")).not.toBeInTheDocument();
    });

    const puts = requests.filter((request) => request.method === "PUT");
    expect(puts).toHaveLength(1);
    expect(puts[0]?.url).toBe("/api/test_cases/TC-LOGIN-1");
    expect(puts[0]?.body).toEqual({
      title: "Sign in with a confirmed account",
    });
    expect(screen.getByTestId("announcement")).toHaveTextContent(
      "Test case updated",
    );

    expect(
      await screen.findByRole("heading", {
        name: "Sign in with a confirmed account",
      }),
    ).toBeInTheDocument();
  });

  it("closes the edit form without a request when nothing changed", async () => {
    const { requests } = mockCaseApi();

    await openDetail({ caseId: "TC-LOGIN-1", projectId: "checkout" });
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    const form = await screen.findByRole("form", { name: "Save changes form" });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.queryByRole("form")).not.toBeInTheDocument();
    });
    expect(
      requests.filter((request) => request.method !== "GET"),
    ).toHaveLength(0);
  });

  it("duplicates a case under a new id and title and selects the copy", async () => {
    const { requests } = mockCaseApi();

    await openDetail({ caseId: "TC-LOGIN-1", projectId: "checkout" });
    fireEvent.click(screen.getByRole("button", { name: "Duplicate" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Duplicate case",
    });
    const form = within(dialog).getByRole("form", {
      name: "Duplicate case form",
    });
    fireEvent.change(within(form).getByLabelText("New ID (optional)"), {
      target: { value: "TC-LOGIN-2" },
    });
    fireEvent.change(within(form).getByLabelText("New title (optional)"), {
      target: { value: "Sign in with a second account" },
    });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByTestId("selection").textContent).toBe(
        "case:TC-LOGIN-2",
      );
    });

    const posts = requests.filter((request) => request.method === "POST");
    expect(posts).toHaveLength(1);
    expect(posts[0]?.url).toBe("/api/test_cases/TC-LOGIN-1/duplicate");
    expect(posts[0]?.body).toEqual({
      newId: "TC-LOGIN-2",
      newTitle: "Sign in with a second account",
    });
    expect(screen.getByTestId("announcement")).toHaveTextContent(
      "Test case duplicated",
    );
    expect(
      await screen.findByRole("heading", {
        name: "Sign in with a second account",
      }),
    ).toBeInTheDocument();
  });

  it("omits both optional duplicate fields when they are left blank", async () => {
    const { requests } = mockCaseApi();

    await openDetail({ caseId: "TC-LOGIN-1", projectId: "checkout" });
    fireEvent.click(screen.getByRole("button", { name: "Duplicate" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Duplicate case",
    });
    fireEvent.submit(
      within(dialog).getByRole("form", { name: "Duplicate case form" }),
    );

    await waitFor(() => {
      expect(
        requests.filter((request) => request.method === "POST"),
      ).toHaveLength(1);
    });
    const [post] = requests.filter((request) => request.method === "POST");
    expect(post?.body).toEqual({});
  });

  it("deletes a case after confirmation and clears the selection", async () => {
    const { requests } = mockCaseApi();

    await openDetail({ caseId: "TC-LOGIN-1", projectId: "checkout" });
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    const dialog = await screen.findByRole("dialog", { name: "Delete case" });
    expect(dialog).toHaveTextContent("Sign in with a registered account");
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete case" }));

    await waitFor(() => {
      expect(screen.getByTestId("selection").textContent).toBe("none");
    });

    const deletes = requests.filter((request) => request.method === "DELETE");
    expect(deletes).toHaveLength(1);
    expect(deletes[0]?.url).toBe("/api/test_cases/TC-LOGIN-1");
    expect(screen.getByTestId("announcement")).toHaveTextContent(
      "Test case deleted",
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the dialog open and shows the envelope when deletion is rejected", async () => {
    mockApi(({ url, method }) => {
      if (url === "/api/projects/checkout" && method === "GET") {
        return jsonResponse(200, PROJECT);
      }
      if (url === "/api/test_cases/TC-LOGIN-1" && method === "DELETE") {
        return errorEnvelope(403, "forbidden", "insufficient role");
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    await openDetail({ caseId: "TC-LOGIN-1", projectId: "checkout" });
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    const dialog = await screen.findByRole("dialog", { name: "Delete case" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete case" }));

    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent("forbidden");
    expect(alert).toHaveTextContent("insufficient role");
    expect(
      screen.getByRole("dialog", { name: "Delete case" }),
    ).toBeInTheDocument();
  });

  it("adds a step by sending the whole steps array", async () => {
    const { requests } = mockCaseApi();

    const { baseElement } = await openDetail({
      caseId: "TC-LOGIN-1",
      projectId: "checkout",
    });
    fireEvent.click(screen.getByRole("button", { name: "Add step" }));

    const form = await screen.findByRole("form", { name: "Add step form" });
    fireEvent.change(within(form).getByLabelText("Action"), {
      target: { value: "Enter the credentials" },
    });
    fireEvent.change(within(form).getByLabelText("Expected result"), {
      target: { value: "The account page loads" },
    });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(
        screen.queryByRole("form", { name: "Add step form" }),
      ).not.toBeInTheDocument();
    });

    const puts = requests.filter((request) => request.method === "PUT");
    expect(puts).toHaveLength(1);
    expect(puts[0]?.url).toBe("/api/test_cases/TC-LOGIN-1");
    expect(puts[0]?.body).toEqual({
      steps: [
        {
          action: "Open the sign-in page",
          expectedResult: "The form is shown",
        },
        {
          action: "Enter the credentials",
          expectedResult: "The account page loads",
        },
      ],
    });

    expect(
      await screen.findByText("Enter the credentials"),
    ).toBeInTheDocument();
    expect(screen.getByText("Steps (2)")).toBeInTheDocument();

    const { default: axe } = await import("axe-core");
    const results = await axe.run(baseElement, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });

  it("edits a step in place", async () => {
    const { requests } = mockCaseApi();

    await openDetail({ caseId: "TC-LOGIN-1", projectId: "checkout" });
    fireEvent.click(screen.getByRole("button", { name: "Edit step 1" }));

    const form = await screen.findByRole("form", { name: "Edit step form" });
    expect(within(form).getByLabelText("Action")).toHaveValue(
      "Open the sign-in page",
    );
    expect(within(form).getByLabelText("Expected result")).toHaveValue(
      "The form is shown",
    );
    fireEvent.change(within(form).getByLabelText("Expected result"), {
      target: { value: "The sign-in form is shown" },
    });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(
        screen.queryByRole("form", { name: "Edit step form" }),
      ).not.toBeInTheDocument();
    });

    const puts = requests.filter((request) => request.method === "PUT");
    expect(puts).toHaveLength(1);
    expect(puts[0]?.body).toEqual({
      steps: [
        {
          action: "Open the sign-in page",
          expectedResult: "The sign-in form is shown",
        },
      ],
    });
    expect(
      await screen.findByText("→ The sign-in form is shown"),
    ).toBeInTheDocument();
  });

  it("moves a step up or down", async () => {
    const { requests } = mockCaseApi([
      { ...CASE, steps: [FIRST_STEP, SECOND_STEP] },
    ]);

    await openDetail({ caseId: "TC-LOGIN-1", projectId: "checkout" });
    expect(
      screen.getByRole("button", { name: "Move step 1 up" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Move step 2 down" }),
    ).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Move step 2 up" }));

    await waitFor(() => {
      expect(
        requests.filter((request) => request.method === "PUT"),
      ).toHaveLength(1);
    });
    const [put] = requests.filter((request) => request.method === "PUT");
    expect(put?.body).toEqual({
      steps: [
        { action: "Enter the credentials" },
        {
          action: "Open the sign-in page",
          expectedResult: "The form is shown",
        },
      ],
    });

    const list = await screen.findByRole("list", { name: "Test steps" });
    expect(
      within(list)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual([
      expect.stringContaining("Enter the credentials"),
      expect.stringContaining("Open the sign-in page"),
    ]);
  });

  it("deletes a step after confirmation", async () => {
    const { requests } = mockCaseApi([
      { ...CASE, steps: [FIRST_STEP, SECOND_STEP] },
    ]);

    await openDetail({ caseId: "TC-LOGIN-1", projectId: "checkout" });
    fireEvent.click(screen.getByRole("button", { name: "Delete step 2" }));

    const dialog = await screen.findByRole("dialog", { name: "Delete step" });
    expect(dialog).toHaveTextContent("Delete step 2 of 2");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Delete step" }),
    );

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    const puts = requests.filter((request) => request.method === "PUT");
    expect(puts).toHaveLength(1);
    expect(puts[0]?.body).toEqual({
      steps: [
        {
          action: "Open the sign-in page",
          expectedResult: "The form is shown",
        },
      ],
    });
    expect(await screen.findByText("Open the sign-in page")).toBeInTheDocument();
    expect(screen.queryByText("Enter the credentials")).not.toBeInTheDocument();
  });

  it("offers the step editor for a case with no steps", async () => {
    mockApi(({ url, method }) => {
      if (url === "/api/projects/checkout" && method === "GET") {
        return jsonResponse(200, projectWith([{ ...CASE, steps: [] }]));
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    await openDetail({ caseId: "TC-LOGIN-1", projectId: "checkout" });

    expect(screen.getByText("Steps (0)")).toBeInTheDocument();
    expect(screen.getByText("No steps recorded.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add step" })).toBeEnabled();
  });

  it("uploads a case attachment as the part the case route expects", async () => {
    const { requests } = mockCaseApi();

    const { baseElement } = await openDetail({
      caseId: "TC-LOGIN-1",
      projectId: "checkout",
    });
    const file = new File(["evidence"], "evidence.txt", { type: "text/plain" });
    fireEvent.change(screen.getByLabelText("Upload attachment to this case"), {
      target: { files: [file] },
    });

    expect(await screen.findByText("evidence.txt")).toBeInTheDocument();
    expect(screen.getByText("8 bytes · text/plain")).toBeInTheDocument();

    const posts = requests.filter((request) => request.method === "POST");
    expect(posts).toHaveLength(1);
    expect(posts[0]?.url).toBe(CASE_ATTACHMENTS);
    expect(posts[0]?.formData?.get("file")).toBe(file);
    // The boundary belongs to the browser: a Content-Type set by hand would
    // describe a body without one.
    expect(posts[0]?.headers["content-type"]).toBeUndefined();

    // The stored name comes from the API, so the case is read back.
    expect(
      requests.filter((request) => request.url === "/api/projects/checkout"),
    ).toHaveLength(2);
    expect(screen.getByTestId("announcement")).toHaveTextContent(
      "File uploaded successfully",
    );

    const { default: axe } = await import("axe-core");
    const results = await axe.run(baseElement, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });

  it("previews an image attachment inline", async () => {
    const { requests } = mockCaseApi([
      { ...CASE, attachments: [IMAGE_ATTACHMENT] },
    ]);

    const { container } = await openDetail({
      caseId: "TC-LOGIN-1",
      projectId: "checkout",
    });

    const image = await waitFor(() => {
      const preview = container.querySelector("img.attachment__preview");
      if (!preview) throw new Error("the preview has not rendered yet");
      return preview;
    });
    expect(image).toHaveAttribute("src", createObjectURL.mock.results[0]?.value);
    expect(requests.map((request) => request.url)).toEqual([
      "/api/projects/checkout",
      `${CASE_ATTACHMENTS}/${IMAGE_ATTACHMENT.filename}`,
    ]);
    // An image is its own preview, so the row carries no download control.
    expect(
      screen.queryByRole("button", { name: "Download login.png" }),
    ).toBeNull();
  });

  it("downloads a non-image attachment under its original name", async () => {
    const manual = {
      filename: storedName("manual.pdf"),
      originalName: "manual.pdf",
      mimeType: "application/pdf",
      size: 700,
    };
    const { requests } = mockCaseApi([{ ...CASE, attachments: [manual] }]);

    await openDetail({ caseId: "TC-LOGIN-1", projectId: "checkout" });
    fireEvent.click(screen.getByRole("button", { name: "Download manual.pdf" }));

    await waitFor(() => {
      expect(anchorClicks).toEqual([
        {
          href: createObjectURL.mock.results[0]?.value,
          download: "manual.pdf",
        },
      ]);
    });
    expect(requests.map((request) => request.url)).toEqual([
      "/api/projects/checkout",
      `${CASE_ATTACHMENTS}/${manual.filename}`,
    ]);
    // The object URL outlives the click, so it is released on the next task.
    const url = createObjectURL.mock.results[0]?.value;
    await waitFor(() => {
      expect(revokeObjectURL).toHaveBeenCalledWith(url);
    });
  });

  it("downloads a text attachment as bytes rather than a decoded string", async () => {
    mockCaseApi([{ ...CASE, attachments: [ATTACHMENT] }]);

    await openDetail({ caseId: "TC-LOGIN-1", projectId: "checkout" });
    fireEvent.click(
      screen.getByRole("button", { name: "Download login-notes.txt" }),
    );

    await waitFor(() => {
      expect(anchorClicks).toEqual([
        {
          href: createObjectURL.mock.results[0]?.value,
          download: "login-notes.txt",
        },
      ]);
    });
    // The deployment replays the stored media type, so a .txt arrives as
    // text/plain even though the operation promises a Blob. A decoded string
    // would be rejected by createObjectURL and the download would never start.
    const [blob] = createObjectURL.mock.calls[0] ?? [];
    if (!(blob instanceof Blob)) {
      throw new Error("the download handed createObjectURL something else");
    }
    expect(await blob.text()).toBe("%PDF");
  });

  it("deletes a case attachment after confirmation", async () => {
    const { requests } = mockCaseApi();

    await openDetail({ caseId: "TC-LOGIN-1", projectId: "checkout" });
    fireEvent.click(
      screen.getByRole("button", {
        name: "Delete login-notes.txt from this case",
      }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Delete attachment",
    });
    expect(dialog).toHaveTextContent(
      "Delete “login-notes.txt” from this case?",
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Delete attachment" }),
    );

    await waitFor(() => {
      expect(screen.queryByText("login-notes.txt")).not.toBeInTheDocument();
    });
    const deletes = requests.filter((request) => request.method === "DELETE");
    expect(deletes).toHaveLength(1);
    expect(deletes[0]?.url).toBe(`${CASE_ATTACHMENTS}/${ATTACHMENT.filename}`);
    const caseSection = screen
      .getByLabelText("Upload attachment to this case")
      .closest(".attachment-section") as HTMLElement;
    expect(within(caseSection).getByText("Attachments (0)")).toBeInTheDocument();
    expect(screen.getByTestId("announcement")).toHaveTextContent(
      "File deleted successfully",
    );
  });

  it("shows a rejected upload next to the picker and keeps the list", async () => {
    const requests = mockApi(({ url, method }) => {
      if (url === "/api/projects/checkout" && method === "GET") {
        return jsonResponse(200, PROJECT);
      }
      if (url === CASE_ATTACHMENTS && method === "POST") {
        return errorEnvelope(400, "missing_file", "No file uploaded");
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    await openDetail({ caseId: "TC-LOGIN-1", projectId: "checkout" });
    const file = new File(["evidence"], "evidence.txt", { type: "text/plain" });
    fireEvent.change(screen.getByLabelText("Upload attachment to this case"), {
      target: { files: [file] },
    });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("missing_file");
    expect(alert).toHaveTextContent("No file uploaded");
    // The error belongs to the section that started the action, not the case.
    expect(alert.closest(".attachment-section")).not.toBeNull();
    expect(screen.queryByText("evidence.txt")).not.toBeInTheDocument();
    expect(screen.getByText("Attachments (1)")).toBeInTheDocument();
    expect(requests.filter((request) => request.method === "POST")).toHaveLength(
      1,
    );
  });

  it("uploads and deletes a step attachment on the step's own route", async () => {
    const { requests } = mockCaseApi();

    await openDetail({ caseId: "TC-LOGIN-1", projectId: "checkout" });
    const stepSection = screen
      .getByLabelText("Upload attachment to step 1")
      .closest(".attachment-section") as HTMLElement;
    expect(stepSection).not.toBeNull();
    // The contract answers the step download route with 405, so a step row
    // offers neither a preview nor a download.
    expect(
      within(stepSection).queryByRole("button", { name: /Download/ }),
    ).toBeNull();

    const file = new File(["notes"], "step-notes.pdf", {
      type: "application/pdf",
    });
    fireEvent.change(screen.getByLabelText("Upload attachment to step 1"), {
      target: { files: [file] },
    });

    expect(await screen.findByText("step-notes.pdf")).toBeInTheDocument();
    const posts = requests.filter((request) => request.method === "POST");
    expect(posts).toHaveLength(1);
    expect(posts[0]?.url).toBe(STEP_ATTACHMENTS);
    expect(posts[0]?.formData?.get("file")).toBe(file);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Delete step-notes.pdf from step 1",
      }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Delete attachment",
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Delete attachment" }),
    );

    await waitFor(() => {
      expect(screen.queryByText("step-notes.pdf")).not.toBeInTheDocument();
    });
    const deletes = requests.filter((request) => request.method === "DELETE");
    expect(deletes).toHaveLength(1);
    expect(deletes[0]?.url).toBe(
      `${STEP_ATTACHMENTS}/${storedName("step-notes.pdf")}`,
    );
  });

  it("keeps a step's attachments when the step is edited", async () => {
    const { requests } = mockCaseApi([
      { ...CASE, steps: [{ ...FIRST_STEP, attachments: [STEP_ATTACHMENT] }] },
    ]);

    await openDetail({ caseId: "TC-LOGIN-1", projectId: "checkout" });
    expect(screen.getByText("step-notes.pdf")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit step 1" }));
    const form = await screen.findByRole("form", { name: "Edit step form" });
    fireEvent.change(within(form).getByLabelText("Expected result"), {
      target: { value: "The sign-in form is shown" },
    });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(
        requests.filter((request) => request.method === "PUT"),
      ).toHaveLength(1);
    });
    const [put] = requests.filter((request) => request.method === "PUT");
    // A steps PUT replaces the whole array: a dropped attachment is a deletion.
    expect(put?.body).toEqual({
      steps: [
        {
          action: "Open the sign-in page",
          expectedResult: "The sign-in form is shown",
          attachments: [STEP_ATTACHMENT],
        },
      ],
    });
  });
});
