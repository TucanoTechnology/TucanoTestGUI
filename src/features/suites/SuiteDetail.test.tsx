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
import { SuiteDetail } from "./SuiteDetail.js";

const LOGIN = {
  suiteId: "suite-login",
  name: "Login",
  description: "Sign-in flow",
  tags: ["web", "smoke"],
  testCases: [{ testCaseId: "case-signin", title: "Signs in" }],
};

/**
 * Answers the reads a suite panel makes: the suite it opened, and the copy a
 * duplicate selects, which the panel reads in turn.
 */
function suiteReader() {
  const suites: Record<string, unknown> = {
    "/api/test_suites/suite-login": LOGIN,
    "/api/test_suites/suite-login-copy.json": {
      ...LOGIN,
      suiteId: "suite-login-copy.json",
    },
  };

  return ({ url, method }: RecordedRequest) => {
    if (method === "GET" && url in suites) {
      return jsonResponse(200, suites[url]);
    }
    throw new Error(`Unexpected request: ${method} ${url}`);
  };
}

function Harness({ suiteId }: { suiteId: string }) {
  const { selection, setSelection, announcement } = useProjectContext();

  useEffect(() => {
    setSelection({ type: "suite", id: suiteId, projectId: "checkout" });
  }, [suiteId, setSelection]);

  return (
    <nav aria-label="Context probe">
      <span data-testid="announcement">{announcement?.message ?? ""}</span>
      <span data-testid="selection">
        {selection ? `${selection.type}:${selection.id}` : "none"}
      </span>
      {selection?.type === "suite" && (
        <SuiteDetail suiteId={selection.id} projectId={selection.projectId} />
      )}
    </nav>
  );
}

function renderDetail() {
  return render(
    <AuthProvider>
      <ProjectProvider>
        <Harness suiteId="suite-login" />
      </ProjectProvider>
    </AuthProvider>,
  );
}

async function openDetail() {
  const view = renderDetail();
  await screen.findByRole("heading", { name: "Login" });
  return view;
}

afterEach(() => {
  resetTestApi();
});

describe("SuiteDetail", () => {
  it("renders the suite document and selects a case from it", async () => {
    const requests = mockApi(suiteReader());

    renderDetail();

    await screen.findByRole("heading", { name: "Login" });
    expect(screen.getByText("Suite ID: suite-login")).toBeInTheDocument();
    expect(screen.getByText("Sign-in flow")).toBeInTheDocument();
    expect(screen.getByText("web")).toBeInTheDocument();
    expect(screen.getByText("Test Cases (1)")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Signs in/ }));
    expect(screen.getByTestId("selection")).toHaveTextContent(
      "case:case-signin",
    );

    expect(requests.map((request) => request.url)).toEqual([
      "/api/test_suites/suite-login",
    ]);
  });

  it("shows a loading status while the request is in flight", () => {
    mockApi(() => new Promise<Response>(() => {}));

    renderDetail();

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("shows the API error envelope when the suite cannot be read", async () => {
    mockApi(({ url, method }) => {
      if (url === "/api/test_suites/suite-login" && method === "GET") {
        return errorEnvelope(404, "not_found", "suite not found");
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    renderDetail();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("not_found");
    expect(alert).toHaveTextContent("suite not found");
  });

  it("sends only the changed fields when editing a suite", async () => {
    const requests = mockApi(({ url, method }) => {
      if (url === "/api/test_suites/suite-login" && method === "PUT") {
        return jsonResponse(200, { message: "Suite updated" });
      }
      return suiteReader()({ url, method } as RecordedRequest);
    });

    await openDetail();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    const form = await screen.findByRole("form", { name: "Save changes form" });
    fireEvent.change(within(form).getByLabelText("Name"), {
      target: { value: "Login v2" },
    });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.queryByRole("form")).not.toBeInTheDocument();
    });

    const puts = requests.filter((request) => request.method === "PUT");
    expect(puts).toHaveLength(1);
    expect(puts[0]?.url).toBe("/api/test_suites/suite-login");
    expect(puts[0]?.body).toEqual({ name: "Login v2" });
    expect(screen.getByTestId("announcement")).toHaveTextContent(
      "Suite updated",
    );
  });

  it("edits the description and tags without ever sending the suite id", async () => {
    const requests = mockApi(({ url, method }) => {
      if (url === "/api/test_suites/suite-login" && method === "PUT") {
        return jsonResponse(200, { message: "Suite updated" });
      }
      return suiteReader()({ url, method } as RecordedRequest);
    });

    await openDetail();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    const form = await screen.findByRole("form", { name: "Save changes form" });
    fireEvent.change(within(form).getByLabelText("Description"), {
      target: { value: "Sign-in and sign-out" },
    });
    fireEvent.change(within(form).getByLabelText("Tags"), {
      target: { value: "web, auth" },
    });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(
        requests.filter((request) => request.method === "PUT"),
      ).toHaveLength(1);
    });
    const [put] = requests.filter((request) => request.method === "PUT");
    expect(put?.body).toEqual({
      description: "Sign-in and sign-out",
      tags: ["web", "auth"],
    });
    expect(put?.body).not.toHaveProperty("suiteId");
  });

  it("closes the edit form without a request when nothing changed", async () => {
    const requests = mockApi(suiteReader());

    await openDetail();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    const form = await screen.findByRole("form", { name: "Save changes form" });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.queryByRole("form")).not.toBeInTheDocument();
    });
    expect(requests.filter((request) => request.method !== "GET")).toHaveLength(
      0,
    );
  });

  it("deletes a suite after confirmation and clears the selection", async () => {
    const requests = mockApi(({ url, method }) => {
      if (url === "/api/test_suites/suite-login" && method === "DELETE") {
        return jsonResponse(200, { message: "Suite deleted" });
      }
      return suiteReader()({ url, method } as RecordedRequest);
    });

    await openDetail();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    const dialog = await screen.findByRole("dialog", { name: "Delete suite" });
    expect(dialog).toHaveTextContent("Login");
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete suite" }));

    await waitFor(() => {
      expect(screen.getByTestId("selection").textContent).toBe("none");
    });

    const deletes = requests.filter((request) => request.method === "DELETE");
    expect(deletes).toHaveLength(1);
    expect(deletes[0]?.url).toBe("/api/test_suites/suite-login");
    expect(screen.getByTestId("announcement")).toHaveTextContent(
      "Suite deleted",
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("duplicates a suite under a new id and name and selects the copy", async () => {
    const requests = mockApi(({ url, method }) => {
      if (url === "/api/test_suites/suite-login/duplicate" && method === "POST") {
        return jsonResponse(201, {
          message: "Suite duplicated",
          id: "suite-login-copy.json",
        });
      }
      return suiteReader()({ url, method } as RecordedRequest);
    });

    await openDetail();
    fireEvent.click(screen.getByRole("button", { name: "Duplicate" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Duplicate suite",
    });
    const form = within(dialog).getByRole("form", {
      name: "Duplicate suite form",
    });
    // The API rejects an id that is not one .json name and answers only
    // `invalid_request` when it does, so the field states the rule.
    const newIdField = within(form).getByLabelText("New ID (optional)");
    expect(newIdField).toHaveAccessibleDescription(/ending in \.json/);
    fireEvent.change(newIdField, {
      target: { value: "suite-login-copy" },
    });
    fireEvent.change(within(form).getByLabelText("New name (optional)"), {
      target: { value: "Login copy" },
    });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByTestId("selection").textContent).toBe(
        "suite:suite-login-copy.json",
      );
    });

    const posts = requests.filter((request) => request.method === "POST");
    expect(posts).toHaveLength(1);
    expect(posts[0]?.url).toBe("/api/test_suites/suite-login/duplicate");
    // The suffix is added on the way out, so the id the API refuses never
    // leaves the dialog.
    expect(posts[0]?.body).toEqual({
      newId: "suite-login-copy.json",
      newName: "Login copy",
    });
    expect(screen.getByTestId("announcement")).toHaveTextContent(
      "Suite duplicated",
    );
  });

  it("leaves an id that already ends in .json alone", async () => {
    const requests = mockApi(({ url, method }) => {
      if (url === "/api/test_suites/suite-login/duplicate" && method === "POST") {
        return jsonResponse(201, {
          message: "Suite duplicated",
          id: "suite-login-copy.json",
        });
      }
      return suiteReader()({ url, method } as RecordedRequest);
    });

    await openDetail();
    fireEvent.click(screen.getByRole("button", { name: "Duplicate" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Duplicate suite",
    });
    const form = within(dialog).getByRole("form", {
      name: "Duplicate suite form",
    });
    fireEvent.change(within(form).getByLabelText("New ID (optional)"), {
      target: { value: "  suite-login-copy.json  " },
    });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(
        requests.filter((request) => request.method === "POST"),
      ).toHaveLength(1);
    });
    const [post] = requests.filter((request) => request.method === "POST");
    expect(post?.body).toEqual({ newId: "suite-login-copy.json" });
  });

  it("refuses an id the API cannot address, and sends no request", async () => {
    const requests = mockApi(suiteReader());

    await openDetail();
    fireEvent.click(screen.getByRole("button", { name: "Duplicate" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Duplicate suite",
    });
    const form = within(dialog).getByRole("form", {
      name: "Duplicate suite form",
    });
    const idField = within(form).getByLabelText("New ID (optional)");

    fireEvent.change(idField, { target: { value: "team/copy" } });

    const alert = within(dialog).getByRole("alert");
    expect(alert).toHaveTextContent("team/copy.json");
    expect(idField).toHaveAttribute("aria-invalid", "true");
    expect(idField).toHaveAccessibleDescription(/not a single path component/);
    expect(
      within(dialog).getByRole("button", { name: "Duplicate suite" }),
    ).toBeDisabled();

    // The control is disabled, but a form can be submitted without it, and the
    // API would answer the same id with an `invalid_request` the user cannot
    // act on rather than with the field's own explanation of it.
    fireEvent.submit(form);
    expect(
      screen.getByRole("dialog", { name: "Duplicate suite" }),
    ).toBeInTheDocument();
    expect(requests.filter((request) => request.method === "POST")).toHaveLength(
      0,
    );

    fireEvent.change(idField, { target: { value: "team-copy.json" } });
    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
    expect(idField).not.toHaveAttribute("aria-invalid");
    expect(
      within(dialog).getByRole("button", { name: "Duplicate suite" }),
    ).toBeEnabled();
  });

  it("omits both optional duplicate fields when they are left blank", async () => {
    const requests = mockApi(({ url, method }) => {
      if (url === "/api/test_suites/suite-login/duplicate" && method === "POST") {
        return jsonResponse(201, {
          message: "Suite duplicated",
          id: "suite-login-copy.json",
        });
      }
      return suiteReader()({ url, method } as RecordedRequest);
    });

    await openDetail();
    fireEvent.click(screen.getByRole("button", { name: "Duplicate" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Duplicate suite",
    });
    fireEvent.submit(
      within(dialog).getByRole("form", { name: "Duplicate suite form" }),
    );

    await waitFor(() => {
      expect(
        requests.filter((request) => request.method === "POST"),
      ).toHaveLength(1);
    });
    const [post] = requests.filter((request) => request.method === "POST");
    expect(post?.body).toEqual({});
  });

  it("shows the API error envelope and keeps the dialog open when deletion is rejected", async () => {
    mockApi(({ url, method }) => {
      if (url === "/api/test_suites/suite-login" && method === "DELETE") {
        return errorEnvelope(409, "conflict", "suite still has test cases");
      }
      return suiteReader()({ url, method } as RecordedRequest);
    });

    await openDetail();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    const dialog = await screen.findByRole("dialog", { name: "Delete suite" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete suite" }));

    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent("conflict");
    expect(alert).toHaveTextContent("suite still has test cases");
    expect(
      screen.getByRole("dialog", { name: "Delete suite" }),
    ).toBeInTheDocument();
  });

  it("shows the API error envelope and keeps the dialog open when duplication is rejected", async () => {
    mockApi(({ url, method }) => {
      if (url === "/api/test_suites/suite-login/duplicate" && method === "POST") {
        return errorEnvelope(400, "invalid_request", "Invalid request");
      }
      return suiteReader()({ url, method } as RecordedRequest);
    });

    await openDetail();
    fireEvent.click(screen.getByRole("button", { name: "Duplicate" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Duplicate suite",
    });
    const form = within(dialog).getByRole("form", {
      name: "Duplicate suite form",
    });
    fireEvent.change(within(form).getByLabelText("New ID (optional)"), {
      target: { value: "login-copy" },
    });
    fireEvent.submit(form);

    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent("invalid_request");
    expect(alert).toHaveTextContent("Invalid request");
    expect(
      screen.getByRole("dialog", { name: "Duplicate suite" }),
    ).toBeInTheDocument();
  });

  it("has no accessibility violations with the delete dialog open", async () => {
    mockApi(suiteReader());

    const { baseElement } = await openDetail();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await screen.findByRole("dialog", { name: "Delete suite" });

    const { default: axe } = await import("axe-core");
    const results = await axe.run(baseElement, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });

  it("has no accessibility violations with the duplicate form refusing an id", async () => {
    mockApi(suiteReader());

    const { baseElement } = await openDetail();
    fireEvent.click(screen.getByRole("button", { name: "Duplicate" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Duplicate suite",
    });
    fireEvent.change(within(dialog).getByLabelText("New ID (optional)"), {
      target: { value: "team/copy" },
    });
    await within(dialog).findByRole("alert");

    const { default: axe } = await import("axe-core");
    const results = await axe.run(baseElement, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });
});
