import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it } from "vitest";
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

/**
 * The case routes a detail panel reaches, over a project storing the cases the
 * test mutates, so the re-fetch after a mutation reads back what was stored.
 */
function mockCaseApi(initial: TestCase[] = [CASE]) {
  const state = { cases: initial };

  const requests = mockApi(({ url, method, body }) => {
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
    throw new Error(`Unexpected request: ${method} ${url}`);
  });

  return { requests, state };
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
    expect(screen.getByText("Major")).toBeInTheDocument();
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
});
